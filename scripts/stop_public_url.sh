#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNTIME_DIR="$ROOT_DIR/.runtime"
URL_FILE="$RUNTIME_DIR/public_url.txt"
SESSION_NAME="paintflow_tunnel"

tmux kill-session -t "$SESSION_NAME" >/dev/null 2>&1 || true
pkill -f "cloudflared tunnel --url http://localhost:5173" >/dev/null 2>&1 || true
: > "$URL_FILE"

echo "[OK] Public tunnel stopped"
