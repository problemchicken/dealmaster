#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ARTIFACT_DIR="$ROOT_DIR/artifacts/e2e-smoke"
rm -rf "$ARTIFACT_DIR"
mkdir -p "$ARTIFACT_DIR"

export SPEECH_E2E_ARTIFACT_DIR="$ARTIFACT_DIR"
export SPEECH_E2E_PORT="${SPEECH_E2E_PORT:-4111}"
export SPEECH_E2E_SKIP_SIMCTL=1

bash "$ROOT_DIR/scripts/e2e-local.sh"
