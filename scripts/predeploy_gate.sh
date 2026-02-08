#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${1:-$ROOT_DIR/.env}"
COMPOSE_FILE="$ROOT_DIR/docker-compose.prod.yml"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "[ERROR] Env file not found: $ENV_FILE"
  exit 1
fi

for cmd in docker; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "[ERROR] Missing required command: $cmd"
    exit 1
  fi
done

if ! docker compose version >/dev/null 2>&1; then
  echo "[ERROR] docker compose plugin is not available"
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "[ERROR] Docker daemon is not running"
  exit 1
fi

required_vars=(
  APP_ENV
  JWT_SECRET
  JWT_REFRESH_SECRET
  CORS_ALLOWED_ORIGINS
  POSTGRES_DB
  POSTGRES_USER
  POSTGRES_PASSWORD
  BOOTSTRAP_ADMIN_EMAIL
  BOOTSTRAP_ADMIN_PASSWORD
  DOMAIN
  ACME_EMAIL
)

for key in "${required_vars[@]}"; do
  value="$(grep -E "^${key}=" "$ENV_FILE" | tail -n1 | cut -d= -f2- || true)"
  if [[ -z "$value" ]]; then
    echo "[ERROR] Missing required env var in $ENV_FILE: $key"
    exit 1
  fi

  shopt -s nocasematch
  if [[ "$value" == *"replace-with"* || "$value" == *"changeme"* || "$value" == *"yourcompany"* ]]; then
    echo "[ERROR] Placeholder value detected for $key"
    exit 1
  fi
  shopt -u nocasematch
done

if [[ "$(grep -E '^APP_ENV=' "$ENV_FILE" | cut -d= -f2-)" != "production" ]]; then
  echo "[ERROR] APP_ENV must be production for public deploy"
  exit 1
fi

domain="$(grep -E '^DOMAIN=' "$ENV_FILE" | tail -n1 | cut -d= -f2- || true)"
cors_origins="$(grep -E '^CORS_ALLOWED_ORIGINS=' "$ENV_FILE" | tail -n1 | cut -d= -f2- || true)"
if [[ "$cors_origins" != *"https://$domain"* ]]; then
  echo "[ERROR] CORS_ALLOWED_ORIGINS must include https://$domain"
  exit 1
fi

echo "[INFO] Compose syntax validation"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" config -q

echo "[INFO] Docker image build"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" build backend frontend

echo "[OK] Pre-deploy gate passed"
