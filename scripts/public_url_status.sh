#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNTIME_DIR="$ROOT_DIR/.runtime"
LOG_FILE="$RUNTIME_DIR/cloudflared-host.log"
URL_FILE="$RUNTIME_DIR/public_url.txt"
SESSION_NAME="paintflow_tunnel"

running="no"
if pgrep -f "cloudflared tunnel --url http://localhost:5173" >/dev/null 2>&1; then
  running="yes"
fi

echo "running=$running"
if tmux has-session -t "$SESSION_NAME" >/dev/null 2>&1; then
  echo "session=$SESSION_NAME"
fi

url=""
if [[ -f "$URL_FILE" ]]; then
  url="$(cat "$URL_FILE" 2>/dev/null || true)"
fi
if [[ -z "$url" && -f "$LOG_FILE" ]]; then
  url="$(grep -Eo 'https://[-a-z0-9]+\.trycloudflare\.com' "$LOG_FILE" | tail -n1 || true)"
fi

if [[ -n "$url" ]]; then
  echo "url=$url"
  code="$(curl -s -o /dev/null -w '%{http_code}' "$url" || true)"
  echo "url_http_status=$code"
fi

if [[ -f "$LOG_FILE" ]]; then
  echo "log=$LOG_FILE"
fi
