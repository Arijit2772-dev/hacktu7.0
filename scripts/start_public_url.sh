#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNTIME_DIR="$ROOT_DIR/.runtime"
LOG_FILE="$RUNTIME_DIR/cloudflared-host.log"
URL_FILE="$RUNTIME_DIR/public_url.txt"
SESSION_NAME="paintflow_tunnel"

mkdir -p "$RUNTIME_DIR"

if ! command -v cloudflared >/dev/null 2>&1; then
  echo "[ERROR] cloudflared is not installed"
  exit 1
fi

if ! command -v tmux >/dev/null 2>&1; then
  echo "[ERROR] tmux is not installed"
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "[ERROR] Docker daemon is not running"
  exit 1
fi

cd "$ROOT_DIR"
echo "[INFO] Ensuring app services are running"
docker compose up -d db backend frontend >/dev/null

# Stop previous session/process if present
tmux kill-session -t "$SESSION_NAME" >/dev/null 2>&1 || true
pkill -f "cloudflared tunnel --url http://localhost:5173" >/dev/null 2>&1 || true

: > "$LOG_FILE"
: > "$URL_FILE"

echo "[INFO] Starting Cloudflare quick tunnel"
tmux new-session -d -s "$SESSION_NAME" \
  "cloudflared tunnel --url http://localhost:5173 --no-autoupdate --loglevel info 2>&1 | tee '$LOG_FILE'"

url=""
for _ in $(seq 1 90); do
  if ! pgrep -f "cloudflared tunnel --url http://localhost:5173" >/dev/null 2>&1; then
    echo "[ERROR] cloudflared exited unexpectedly"
    tail -n 80 "$LOG_FILE" || true
    exit 1
  fi

  url="$(grep -Eo 'https://[-a-z0-9]+\.trycloudflare\.com' "$LOG_FILE" | tail -n1 || true)"
  if [[ -n "$url" ]]; then
    break
  fi
  sleep 1
done

if [[ -z "$url" ]]; then
  echo "[ERROR] Timed out waiting for public URL"
  tail -n 120 "$LOG_FILE" || true
  exit 1
fi

echo "$url" > "$URL_FILE"
echo "[OK] Public URL is live: $url"
