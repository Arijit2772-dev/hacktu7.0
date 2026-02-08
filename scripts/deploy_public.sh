#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${1:-$ROOT_DIR/.env}"
COMPOSE_FILE="$ROOT_DIR/docker-compose.prod.yml"

"$ROOT_DIR/scripts/predeploy_gate.sh" "$ENV_FILE"

echo "[INFO] Starting/updating public stack"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --build

echo "[INFO] Waiting for services"
sleep 8

docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps

DOMAIN="$(grep -E '^DOMAIN=' "$ENV_FILE" | tail -n1 | cut -d= -f2- || true)"
if [[ -n "$DOMAIN" ]]; then
  echo "[INFO] Probing https://$DOMAIN/api/health/live"
  if curl -fsS --max-time 10 "https://$DOMAIN/api/health/live" >/dev/null 2>&1; then
    echo "[OK] Public health probe passed"
  else
    echo "[WARN] Public health probe failed (DNS/SSL propagation may still be in progress)"
  fi
fi

echo "[OK] Deploy command finished"
