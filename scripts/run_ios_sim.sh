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

IFS='|' read -r DEVICE_NAME DEVICE_IDENTIFIER FALLBACK_FLAG DEVICE_STATUS <<'PY'
import json, os

desired_name = "iPhone 17 Pro"
desired_identifier = "com.apple.CoreSimulator.SimDeviceType.iPhone-17-Pro"
with open(os.environ["DEVICETYPE_JSON"]) as f:
    data = json.load(f)["devicetypes"]

device = next((d for d in data if d["identifier"] == desired_identifier), None)
if device:
    print("|".join([device["name"], device["identifier"], "0", "ok"]))
else:
    fallback = next((d for d in data if "iPhone" in d["name"]), None)
    if fallback:
        print("|".join([fallback["name"], fallback["identifier"], "1", "ok"]))
    else:
        print("|||error")
PY
PY

if [ "${DEVICE_STATUS}" = "error" ] || [ -z "${DEVICE_NAME:-}" ] || [ -z "${DEVICE_IDENTIFIER:-}" ]; then
  error "系統內沒有可用的 iPhone 模擬器裝置類型，請先透過 Xcode 安裝模擬器。"
  exit 1
fi

if [ "$FALLBACK_FLAG" = "1" ]; then
  log "指定的 iPhone 17 Pro 裝置類型不存在，將改用 ${DEVICE_NAME}."
else
  log "使用指定的 ${DEVICE_NAME} 模擬器裝置類型。"
fi

IFS='|' read -r RUNTIME_IDENTIFIER RUNTIME_FRIENDLY RUNTIME_STATUS <<'PY'
import json, os

with open(os.environ["RUNTIME_JSON"]) as f:
    runtimes = json.load(f)["runtimes"]

available = [r for r in runtimes if r.get("isAvailable") or r.get("availability") == "(available)"]
if not available:
    available = runtimes

ios_runtimes = [r for r in available if r.get("identifier", "").startswith("com.apple.CoreSimulator.SimRuntime.iOS")]

def version_key(runtime):
    version = runtime.get("version") or runtime.get("buildversion") or "0"
    parts = []
    for token in version.replace("-", ".").split('.'):
        try:
            parts.append(int(''.join(filter(str.isdigit, token)) or 0))
        except ValueError:
            parts.append(0)
    return parts

ios_runtimes.sort(key=version_key, reverse=True)
selected = ios_runtimes[0] if ios_runtimes else None
if selected:
    print("|".join([selected["identifier"], selected["name"], "ok"]))
else:
    print("||error")
PY
PY

if [ "${RUNTIME_STATUS}" = "error" ] || [ -z "${RUNTIME_IDENTIFIER:-}" ]; then
  error "找不到可用的 iOS Runtime，請先在 Xcode 下載對應的模擬器 Runtime。"
  exit 1
fi

log "鎖定 Runtime：${RUNTIME_FRIENDLY} (${RUNTIME_IDENTIFIER})"

export TARGET_DEVICE_NAME="$DEVICE_NAME"
export DEVICES_JSON RUNTIME_JSON
read -r EXISTING_UDID EXISTING_RUNTIME_IDENTIFIER <<'PY'
import json, os, sys
name = os.environ["TARGET_DEVICE_NAME"]
with open(os.environ["DEVICES_JSON"]) as f:
    data = json.load(f)
for runtime_id, devices in data.get("devices", {}).items():
    for device in devices:
        if device.get("name") == name and device.get("isAvailable", True):
            print(f"{device['udid']} {runtime_id}")
            sys.exit(0)
print()
PY
PY

DEVICE_UDID="${EXISTING_UDID:-}"
DEVICE_RUNTIME_IDENTIFIER="${EXISTING_RUNTIME_IDENTIFIER:-$RUNTIME_IDENTIFIER}"
if [ -n "$DEVICE_UDID" ]; then
  log "已找到既有模擬器 ${DEVICE_NAME} (${DEVICE_UDID})."
else
  log "建立新的模擬器 ${DEVICE_NAME}..."
  DEVICE_UDID=$(xcrun simctl create "$DEVICE_NAME" "$DEVICE_IDENTIFIER" "$RUNTIME_IDENTIFIER")
  DEVICE_RUNTIME_IDENTIFIER="$RUNTIME_IDENTIFIER"
  log "已建立模擬器，UDID=${DEVICE_UDID}."
fi

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
