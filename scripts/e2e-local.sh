#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ARTIFACT_DIR="${SPEECH_E2E_ARTIFACT_DIR:-$ROOT_DIR/artifacts/e2e-local}"
TMP_DIR="$ROOT_DIR/tmp"
PORT="${SPEECH_E2E_PORT:-4100}"
TARGET="http://127.0.0.1:${PORT}/api/speech-endpoint"
LOG_PATH="$ARTIFACT_DIR/run.log"
RESPONSE_PATH="$ARTIFACT_DIR/response.json"

mkdir -p "$ARTIFACT_DIR"
mkdir -p "$TMP_DIR"
>"$LOG_PATH"

export SPEECH_E2E_ARTIFACT_DIR="$ARTIFACT_DIR"
export SPEECH_E2E_PORT="$PORT"

node "$ROOT_DIR/scripts/mock-speech-server.js" >>"$LOG_PATH" 2>&1 &
SERVER_PID=$!
trap 'kill "$SERVER_PID" >/dev/null 2>&1 || true' EXIT
sleep 1

if command -v xcrun >/dev/null 2>&1 && [ "${SPEECH_E2E_SKIP_SIMCTL:-0}" != "1" ]; then
  echo "Granting simulator microphone/speech-recognition permissions..." | tee -a "$LOG_PATH"
  xcrun simctl privacy booted microphone grant com.dealmaster || true
  xcrun simctl privacy booted speech-recognition grant com.dealmaster || true
else
  echo "Skipping simulator authorization (xcrun not available)." | tee -a "$LOG_PATH"
fi

AUDIO_FIXTURE="$TMP_DIR/sample-command.wav"
node "$ROOT_DIR/scripts/make-sample-wav.js" "$AUDIO_FIXTURE" >>"$LOG_PATH" 2>&1

export SPEECH_E2E_TARGET="$TARGET"
export SPEECH_E2E_AUDIO="$AUDIO_FIXTURE"
export SPEECH_E2E_RESPONSE="$RESPONSE_PATH"

node <<'NODE'
const fs = require('fs');
const http = require('http');
const url = new URL(process.env.SPEECH_E2E_TARGET);
const audio = fs.readFileSync(process.env.SPEECH_E2E_AUDIO).toString('base64');
const payload = JSON.stringify({
  audioBase64: audio,
  metadata: {source: 'local-e2e-script'},
});

fs.writeFileSync(process.env.SPEECH_E2E_ARTIFACT_DIR + '/request.json', payload);

const options = {
  hostname: url.hostname,
  port: url.port,
  path: url.pathname,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
  },
};

const request = http.request(options, response => {
  let body = '';
  response.on('data', chunk => {
    body += chunk;
  });
  response.on('end', () => {
    fs.writeFileSync(process.env.SPEECH_E2E_RESPONSE, body || '{}');
  });
});

request.on('error', error => {
  console.error(error.message);
  process.exit(1);
});

request.write(payload);
request.end();
NODE

if [ ! -f "$RESPONSE_PATH" ]; then
  echo "No response captured" | tee -a "$LOG_PATH"
  exit 1
fi

ASR_TEXT=$(node -e "const fs=require('fs');const data=JSON.parse(fs.readFileSync('$RESPONSE_PATH','utf8'));process.stdout.write(data.transcript||'');")
STRATEGY=$(node -e "const fs=require('fs');const data=JSON.parse(fs.readFileSync('$RESPONSE_PATH','utf8'));process.stdout.write(data.strategy?data.strategy.strategy||'':'');")
EMOTION=$(node -e "const fs=require('fs');const data=JSON.parse(fs.readFileSync('$RESPONSE_PATH','utf8'));process.stdout.write(data.strategy?String(data.strategy.emotionScore||''):'' );")

TELEMETRY_FILE="$ARTIFACT_DIR/telemetry.json"
if [ ! -f "$TELEMETRY_FILE" ]; then
  echo "Telemetry file not found" | tee -a "$LOG_PATH"
  exit 1
fi

TELEMETRY_LINE=$(TELEMETRY_PATH="$TELEMETRY_FILE" node <<'NODE'
const fs = require('fs');
const path = process.env.TELEMETRY_PATH;
const events = JSON.parse(fs.readFileSync(path, 'utf8'));
const latest = events[events.length - 1] || {};
const total = latest.total_duration_ms ?? 'n/a';
const endpoint = latest.endpoint_latency_ms ?? 'n/a';
const code = latest.error_code ? ` error_code=${latest.error_code}` : '';
const event = latest.event ?? 'unknown';
process.stdout.write(`Telemetry: ${event} total_duration=${total}ms endpoint_latency=${endpoint}ms${code}`);
NODE
)

printf 'ASR final text: %s\n' "$ASR_TEXT"
printf 'Strategy: %s, EmotionScore: %s\n' "$STRATEGY" "$EMOTION"
printf '%s\n' "$TELEMETRY_LINE"
