#!/usr/bin/env bash
set -euo pipefail

log() {
  printf "[%s] %s\n" "$(date '+%Y-%m-%d %H:%M:%S')" "$*"
}

error() {
  printf "Error: %s\n" "$*" >&2
}

XCODE_PATH=""
if XCODE_PATH=$(xcode-select -p 2>/dev/null); then
  log "Xcode path: ${XCODE_PATH}"
else
  error "找不到 Xcode 開發者工具，請先在此機器上安裝或執行 'xcode-select --switch <Xcode.app>/Contents/Developer'."
  exit 1
fi

if command -v xcodebuild >/dev/null 2>&1; then
  log "$(xcodebuild -version | tr '\n' ' ' | sed 's/ $//')"
else
  error "找不到 xcodebuild 指令，請確認 Xcode 已完整安裝。"
  exit 1
fi

log "準備模擬器裝置資訊..."
DEVICETYPE_JSON=$(mktemp)
RUNTIME_JSON=$(mktemp)
DEVICES_JSON=$(mktemp)
trap 'rm -f "$DEVICETYPE_JSON" "$RUNTIME_JSON" "$DEVICES_JSON"' EXIT

xcrun simctl list devicetypes --json >"$DEVICETYPE_JSON"
xcrun simctl list runtimes --json >"$RUNTIME_JSON"
xcrun simctl list devices --json >"$DEVICES_JSON"

IFS='|' read -r DEVICE_NAME DEVICE_IDENTIFIER RUNTIME_IDENTIFIER RUNTIME_FRIENDLY DEVICE_UDID SELECTION_STATUS <<'PY'
import json
import os
import re
from functools import cmp_to_key

desired_name = "iPhone 17 Pro"
desired_identifier = "com.apple.CoreSimulator.SimDeviceType.iPhone-17-Pro"

with open(os.environ["DEVICETYPE_JSON"]) as f:
    device_types = json.load(f).get("devicetypes", [])

with open(os.environ["RUNTIME_JSON"]) as f:
    runtimes = json.load(f).get("runtimes", [])

with open(os.environ["DEVICES_JSON"]) as f:
    devices = json.load(f).get("devices", {})

def extract_numbers(value: str):
    numbers = [int(x) for x in re.findall(r"\d+", value or "")]
    return tuple(numbers) if numbers else (0,)

def runtime_lookup_map(runtimes_list):
    lookup = {}
    for runtime in runtimes_list:
        identifier = runtime.get("identifier")
        if identifier:
            lookup[identifier] = runtime
    return lookup

runtime_lookup = runtime_lookup_map(runtimes)

available_runtimes = [
    r for r in runtimes
    if r.get("identifier", "").startswith("com.apple.CoreSimulator.SimRuntime.iOS")
    and (r.get("isAvailable") or r.get("availability") == "(available)")
]
if not available_runtimes:
    available_runtimes = [
        r for r in runtimes
        if r.get("identifier", "").startswith("com.apple.CoreSimulator.SimRuntime.iOS")
    ]

def compare_runtimes(a, b):
    a_numbers = extract_numbers(a.get("version") or a.get("name") or a.get("identifier", ""))
    b_numbers = extract_numbers(b.get("version") or b.get("name") or b.get("identifier", ""))
    if a_numbers != b_numbers:
        return -1 if a_numbers > b_numbers else 1
    return (a.get("name") > b.get("name")) - (a.get("name") < b.get("name"))

available_runtimes.sort(key=cmp_to_key(compare_runtimes))

runtime_order = [r.get("identifier") for r in available_runtimes if r.get("identifier")]

device_type_by_name = {d.get("name"): d.get("identifier") for d in device_types if d.get("name") and d.get("identifier")}
device_type_by_id = {d.get("identifier"): d for d in device_types if d.get("identifier")}

available_devices = []
for runtime_id, runtime_devices in devices.items():
    runtime = runtime_lookup.get(runtime_id)
    if not runtime or runtime_id not in runtime_order:
        continue
    for device in runtime_devices:
        if not device.get("isAvailable", True):
            continue
        if device.get("availabilityError"):
            continue
        name = device.get("name")
        if not name or "iPhone" not in name:
            continue
        available_devices.append(
            {
                "name": name,
                "udid": device.get("udid", ""),
                "runtime_id": runtime_id,
                "runtime_name": runtime.get("name", runtime_id),
                "device_type_id": device.get("deviceTypeIdentifier") or device_type_by_name.get(name, ""),
                "version_tuple": extract_numbers(runtime.get("version") or runtime.get("name") or runtime_id),
            }
        )

def compare_devices(a, b):
    if (a["name"] == desired_name) != (b["name"] == desired_name):
        return -1 if a["name"] == desired_name else 1
    if a["version_tuple"] != b["version_tuple"]:
        return -1 if a["version_tuple"] > b["version_tuple"] else 1
    return (a["name"] > b["name"]) - (a["name"] < b["name"])

available_devices.sort(key=cmp_to_key(compare_devices))

if available_devices:
    best_device = available_devices[0]
    status = "existing_desired" if best_device["name"] == desired_name else "existing_fallback"
    device_type_id = best_device["device_type_id"]
    if not device_type_id:
        device_type_id = device_type_by_name.get(best_device["name"], "")
    if not device_type_id:
        print("|||||error:no_device_type_for_existing")
    else:
        print(
            "|".join(
                [
                    best_device["name"],
                    device_type_id,
                    best_device["runtime_id"],
                    best_device["runtime_name"],
                    best_device["udid"],
                    status,
                ]
            )
        )
    raise SystemExit

# 若沒有現成裝置，嘗試建立新的模擬器

def compare_device_types(a, b):
    if (a.get("name") == desired_name) != (b.get("name") == desired_name):
        return -1 if a.get("name") == desired_name else 1
    a_numbers = extract_numbers(a.get("name", ""))
    b_numbers = extract_numbers(b.get("name", ""))
    if a_numbers != b_numbers:
        return -1 if a_numbers > b_numbers else 1
    return (a.get("name") > b.get("name")) - (a.get("name") < b.get("name"))

iphone_device_types = [d for d in device_types if "iPhone" in (d.get("name") or "")]
iphone_device_types.sort(key=cmp_to_key(compare_device_types))

if not runtime_order:
    print("|||||error:no_runtime")
    raise SystemExit

runtime_id = runtime_order[0]
runtime = runtime_lookup.get(runtime_id, {})
runtime_name = runtime.get("name", runtime_id)

if not iphone_device_types:
    print("|||||error:no_device_type")
    raise SystemExit

selected_type = iphone_device_types[0]
status = "new_desired" if selected_type.get("name") == desired_name else "new_fallback"

print(
    "|".join(
        [
            selected_type.get("name", desired_name),
            selected_type.get("identifier", desired_identifier),
            runtime_id,
            runtime_name,
            "",
            status,
        ]
    )
)
PY
PY

case "$SELECTION_STATUS" in
  error:*)
    error "系統內沒有可用的 iPhone 模擬器或 iOS Runtime，請先透過 Xcode 安裝對應資源 (${SELECTION_STATUS#error:})."
    exit 1
    ;;
  existing_fallback)
    log "指定的 iPhone 17 Pro 不可用，改用已存在的 ${DEVICE_NAME} 模擬器。"
    ;;
  existing_desired)
    log "使用已存在的 ${DEVICE_NAME} 模擬器。"
    ;;
  new_fallback)
    log "指定的 iPhone 17 Pro 裝置類型不存在，將改用 ${DEVICE_NAME} 並建立新的模擬器。"
    ;;
  new_desired)
    log "將建立新的 ${DEVICE_NAME} 模擬器。"
    ;;
  *)
    log "使用 ${DEVICE_NAME} 模擬器。"
    ;;
esac

DEVICE_RUNTIME_IDENTIFIER="$RUNTIME_IDENTIFIER"
if [ -n "$DEVICE_UDID" ]; then
  log "已找到既有模擬器 ${DEVICE_NAME} (${DEVICE_UDID})."
else
  log "建立新的模擬器 ${DEVICE_NAME}..."
  DEVICE_UDID=$(xcrun simctl create "$DEVICE_NAME" "$DEVICE_IDENTIFIER" "$RUNTIME_IDENTIFIER")
  log "已建立模擬器，UDID=${DEVICE_UDID}."
fi

log "鎖定 Runtime：${RUNTIME_FRIENDLY} (${RUNTIME_IDENTIFIER})"

log "啟動模擬器 ${DEVICE_NAME} (${DEVICE_UDID})..."
xcrun simctl boot "$DEVICE_UDID" >/dev/null 2>&1 || true
xcrun simctl bootstatus "$DEVICE_UDID" -b
log "模擬器已啟動。"

# 推得使用中的 runtime 名稱
export DEVICE_RUNTIME_IDENTIFIER
read -r DEVICE_RUNTIME_NAME <<'PY'
import json, os
runtime_id = os.environ.get("DEVICE_RUNTIME_IDENTIFIER", "")
with open(os.environ["RUNTIME_JSON"]) as f:
    runtimes = json.load(f)["runtimes"]
name = next((r.get("name") for r in runtimes if r.get("identifier") == runtime_id), runtime_id)
print(name)
PY
PY

log "開始以 Debug 組態編譯 App..."
BUILD_DIR=".build"
set +e
xcodebuild \
  -workspace ios/DealMaster.xcworkspace \
  -scheme DealMaster \
  -configuration Debug \
  -destination "platform=iOS Simulator,name=${DEVICE_NAME}" \
  -derivedDataPath "$BUILD_DIR" \
  build
XCODEBUILD_STATUS=$?
set -e

if [ $XCODEBUILD_STATUS -ne 0 ]; then
  error "xcodebuild 編譯失敗，請檢查 scheme、workspace 是否存在或使用 'xcodebuild -list' 驗證設定。"
  exit $XCODEBUILD_STATUS
fi

log "編譯完成，尋找輸出的 .app..."
APP_PATH=""
if [ -d "$BUILD_DIR/Build/Products" ]; then
  APP_PATH=$(find "$BUILD_DIR/Build/Products" -type d -name '*.app' -path '*/Debug-iphonesimulator/*' -print -quit)
fi

if [ -z "$APP_PATH" ]; then
  error "找不到 Debug-iphonesimulator 的 .app 檔案，請確認 scheme 的目標是 iOS Simulator，或清理後重新編譯。"
  exit 1
fi

log "找到 App：${APP_PATH}"

if ! command -v defaults >/dev/null 2>&1; then
  error "找不到 defaults 指令，無法讀取 Info.plist。"
  exit 1
fi

BUNDLE_ID=$(defaults read "${APP_PATH}/Info" CFBundleIdentifier 2>/dev/null || true)
if [ -z "$BUNDLE_ID" ]; then
  error "無法從 Info.plist 讀取 CFBundleIdentifier，請確認專案設定。"
  exit 1
fi

log "Bundle Identifier: ${BUNDLE_ID}"

INSTALL_SUCCESS=0
LAUNCH_SUCCESS=0
LAUNCH_METHOD=""

set +e
xcrun simctl install "$DEVICE_UDID" "$APP_PATH"
INSTALL_STATUS=$?
set -e
if [ $INSTALL_STATUS -ne 0 ]; then
  error "安裝 App 失敗，常見原因：模擬器未啟動、Bundle Identifier 不正確或舊版 App 殘留。"
else
  INSTALL_SUCCESS=1
  log "App 已成功安裝。"
fi

if [ $INSTALL_SUCCESS -eq 1 ]; then
  set +e
  if xcrun simctl openurl "$DEVICE_UDID" "dealmaster://debug" >/dev/null 2>&1; then
    LAUNCH_SUCCESS=1
    LAUNCH_METHOD="透過 deep link dealmaster://debug 啟動"
  else
    if xcrun simctl launch "$DEVICE_UDID" "$BUNDLE_ID" --args debugqa=1 >/dev/null 2>&1; then
      LAUNCH_SUCCESS=1
      LAUNCH_METHOD="使用 --args debugqa=1 啟動"
    else
      if xcrun simctl launch "$DEVICE_UDID" "$BUNDLE_ID" >/dev/null 2>&1; then
        LAUNCH_SUCCESS=1
        LAUNCH_METHOD="以預設參數啟動"
      else
        LAUNCH_METHOD="啟動指令執行失敗，請檢查 Bundle Identifier 或執行記錄。"
      fi
    fi
  fi
  set -e
fi

log "------ 執行結果摘要 ------"
log "模擬器：${DEVICE_NAME} (${DEVICE_RUNTIME_NAME})"
if [ $INSTALL_SUCCESS -eq 1 ]; then
  log "App 安裝：成功"
else
  log "App 安裝：失敗"
fi
if [ $LAUNCH_SUCCESS -eq 1 ]; then
  log "App 啟動：成功 (${LAUNCH_METHOD})"
else
  log "App 啟動：失敗 (${LAUNCH_METHOD:-'請確認 xcrun simctl launch 指令與 Bundle Identifier'})"
fi

if [ $INSTALL_SUCCESS -ne 1 ] || [ $LAUNCH_SUCCESS -ne 1 ]; then
  log "排錯建議：確認 workspace/scheme 是否存在、Bundle Identifier 是否正確、.app 是否成功產出以及模擬器裝置是否已下載。"
fi

if [ $INSTALL_SUCCESS -eq 1 ] && [ $LAUNCH_SUCCESS -eq 1 ]; then
  exit 0
else
  exit 1
fi
