#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Deploy PaintFlow.ai to an always-on VPS (24/7 public hosting).

Usage:
  ./scripts/deploy_24x7_vps.sh \
    --host <server_ip_or_hostname> \
    --user <ssh_user> \
    --domain <public_domain> \
    --acme-email <email_for_tls> \
    [--ssh-key <path_to_private_key>] \
    [--repo <git_repo_url>] \
    [--app-dir <remote_path>] \
    [--admin-email <bootstrap_admin_email>]

Example:
  ./scripts/deploy_24x7_vps.sh \
    --host 203.0.113.10 \
    --user ubuntu \
    --domain paintflow.ai \
    --acme-email admin@paintflow.ai \
    --ssh-key ~/.ssh/id_ed25519

Notes:
  - Requires SSH access with sudo privileges on target server.
  - DNS A record for your domain should point to the server IP.
  - Script generates strong secrets and bootstrap admin password automatically.
EOF
}

require_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "[ERROR] Missing required command: $cmd"
    exit 1
  fi
}

rand_hex() {
  local bytes="${1:?bytes required}"
  openssl rand -hex "$bytes"
}

HOST=""
USER_NAME=""
DOMAIN=""
ACME_EMAIL=""
SSH_KEY=""
REPO_URL="https://github.com/Arijit2772-dev/hacktu7.0.git"
APP_DIR="/opt/paintflow"
ADMIN_EMAIL=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --host)
      HOST="${2:-}"; shift 2 ;;
    --user)
      USER_NAME="${2:-}"; shift 2 ;;
    --domain)
      DOMAIN="${2:-}"; shift 2 ;;
    --acme-email)
      ACME_EMAIL="${2:-}"; shift 2 ;;
    --ssh-key)
      SSH_KEY="${2:-}"; shift 2 ;;
    --repo)
      REPO_URL="${2:-}"; shift 2 ;;
    --app-dir)
      APP_DIR="${2:-}"; shift 2 ;;
    --admin-email)
      ADMIN_EMAIL="${2:-}"; shift 2 ;;
    -h|--help)
      usage; exit 0 ;;
    *)
      echo "[ERROR] Unknown argument: $1"
      usage
      exit 1 ;;
  esac
done

if [[ -z "$HOST" || -z "$USER_NAME" || -z "$DOMAIN" || -z "$ACME_EMAIL" ]]; then
  echo "[ERROR] --host, --user, --domain, and --acme-email are required."
  usage
  exit 1
fi

if [[ -z "$ADMIN_EMAIL" ]]; then
  ADMIN_EMAIL="admin@${DOMAIN}"
fi

require_cmd ssh
require_cmd scp
require_cmd curl
require_cmd openssl

if [[ -n "$SSH_KEY" && ! -f "$SSH_KEY" ]]; then
  echo "[ERROR] SSH key not found: $SSH_KEY"
  exit 1
fi

SSH_ARGS=(-o StrictHostKeyChecking=accept-new)
if [[ -n "$SSH_KEY" ]]; then
  SSH_ARGS+=(-i "$SSH_KEY")
fi

JWT_SECRET="$(rand_hex 32)"
JWT_REFRESH_SECRET="$(rand_hex 32)"
POSTGRES_PASSWORD="$(rand_hex 24)"
BOOTSTRAP_ADMIN_PASSWORD="$(rand_hex 16)"

TMP_ENV="$(mktemp)"
trap 'rm -f "$TMP_ENV"' EXIT

cat >"$TMP_ENV" <<EOF
APP_ENV=production

JWT_SECRET=$JWT_SECRET
JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET

DOMAIN=$DOMAIN
ACME_EMAIL=$ACME_EMAIL
CORS_ALLOWED_ORIGINS=https://$DOMAIN,https://www.$DOMAIN

POSTGRES_DB=paintflow
POSTGRES_USER=paintflow
POSTGRES_PASSWORD=$POSTGRES_PASSWORD

BOOTSTRAP_ADMIN_EMAIL=$ADMIN_EMAIL
BOOTSTRAP_ADMIN_PASSWORD=$BOOTSTRAP_ADMIN_PASSWORD
BOOTSTRAP_ADMIN_NAME=Platform Admin

INGEST_ENABLED=true
INGEST_POLL_SECONDS=3600
EOF

echo "[INFO] Checking DNS A record for $DOMAIN"
if command -v dig >/dev/null 2>&1; then
  DNS_A="$(dig +short "$DOMAIN" A | tr '\n' ' ' | xargs || true)"
  if [[ -z "$DNS_A" ]]; then
    echo "[WARN] No A record found for $DOMAIN yet."
  else
    echo "[INFO] DNS A -> $DNS_A"
  fi
else
  echo "[WARN] dig not found locally; skipping DNS check."
fi

echo "[INFO] Bootstrapping server packages and syncing repository"
ssh "${SSH_ARGS[@]}" "$USER_NAME@$HOST" \
  "APP_DIR='$APP_DIR' REPO_URL='$REPO_URL' DEPLOY_USER='$USER_NAME' bash -s" <<'EOF'
set -euo pipefail

if ! command -v apt-get >/dev/null 2>&1; then
  echo "[ERROR] This script currently supports Debian/Ubuntu targets (apt-get required)."
  exit 1
fi

sudo apt-get update -y
sudo apt-get install -y ca-certificates curl git

if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sudo sh
fi

sudo apt-get install -y docker-compose-plugin || true
sudo usermod -aG docker "$DEPLOY_USER" || true

sudo mkdir -p "$APP_DIR"
sudo chown -R "$DEPLOY_USER:$DEPLOY_USER" "$APP_DIR"

if [[ ! -d "$APP_DIR/.git" ]]; then
  git clone "$REPO_URL" "$APP_DIR"
else
  cd "$APP_DIR"
  git fetch --all --prune
  git checkout main
  git pull --ff-only
fi
EOF

REMOTE_ENV_TMP="/tmp/paintflow.env.$RANDOM.$$"
echo "[INFO] Uploading production .env to server"
scp "${SSH_ARGS[@]}" "$TMP_ENV" "$USER_NAME@$HOST:$REMOTE_ENV_TMP"

ssh "${SSH_ARGS[@]}" "$USER_NAME@$HOST" \
  "APP_DIR='$APP_DIR' REMOTE_ENV_TMP='$REMOTE_ENV_TMP' DEPLOY_USER='$USER_NAME' bash -s" <<'EOF'
set -euo pipefail
sudo mv "$REMOTE_ENV_TMP" "$APP_DIR/.env"
sudo chown "$DEPLOY_USER:$DEPLOY_USER" "$APP_DIR/.env"
chmod 600 "$APP_DIR/.env"
EOF

echo "[INFO] Deploying production stack on server"
ssh "${SSH_ARGS[@]}" "$USER_NAME@$HOST" \
  "APP_DIR='$APP_DIR' bash -s" <<'EOF'
set -euo pipefail
cd "$APP_DIR"
sudo docker compose -f docker-compose.prod.yml --env-file .env config -q
sudo docker compose -f docker-compose.prod.yml --env-file .env up -d --build
sudo docker compose -f docker-compose.prod.yml --env-file .env ps
EOF

echo "[INFO] Waiting for HTTPS health endpoint"
HEALTH_URL="https://${DOMAIN}/api/health/live"
READY_URL="https://${DOMAIN}/api/health/ready"
HEALTH_OK="no"
for _ in $(seq 1 40); do
  CODE="$(curl -s -o /dev/null -w '%{http_code}' "$HEALTH_URL" || true)"
  if [[ "$CODE" == "200" ]]; then
    HEALTH_OK="yes"
    break
  fi
  sleep 5
done

echo
echo "================ DEPLOY RESULT ================"
echo "Domain: https://$DOMAIN"
echo "Health: $HEALTH_URL"
echo "Ready:  $READY_URL"
if [[ "$HEALTH_OK" == "yes" ]]; then
  echo "Status: LIVE"
else
  echo "Status: DEPLOYED (health not confirmed yet; check DNS/SSL propagation)"
fi
echo
echo "Bootstrap admin credentials:"
echo "  Email:    $ADMIN_EMAIL"
echo "  Password: $BOOTSTRAP_ADMIN_PASSWORD"
echo
echo "IMPORTANT: Save this password securely and rotate after first login."
echo "==============================================="
