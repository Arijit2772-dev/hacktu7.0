# Public Deployment Runbook (Docker + Caddy + HTTPS)

This runbook deploys PaintFlow.ai on a single Linux VM with automatic TLS via Caddy.

## 1. Target Architecture

- `caddy` (public): terminates HTTPS on ports `80/443`
- `frontend` (private): serves React build via Nginx
- `backend` (private): FastAPI + Alembic migration on startup
- `db` (private): PostgreSQL with persistent volume

Only Caddy is internet-facing. Backend and DB are not exposed publicly.

## 2. Prerequisites

- Linux VM (Ubuntu 22.04/24.04 recommended), minimum `2 vCPU / 4 GB RAM`
- Domain with DNS control
- Docker + Docker Compose plugin installed
- Ports open: `80`, `443` (and `22` for SSH)

## 3. DNS Setup

Create DNS records pointing to the VM public IP:

- `A` record: `paintflow.ai -> <SERVER_PUBLIC_IP>`
- Optional: `A` record: `www.paintflow.ai -> <SERVER_PUBLIC_IP>`

## 4. Server Bootstrap (one-time)

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl git

# Install Docker (official convenience script)
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
newgrp docker

docker --version
docker compose version
```

## 5. Project Setup

```bash
git clone <your-repo-url> paintflow
cd paintflow
cp .env.production.example .env
```

Edit `.env` with real values:

- `DOMAIN`
- `ACME_EMAIL`
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `POSTGRES_PASSWORD`
- `BOOTSTRAP_ADMIN_EMAIL`
- `BOOTSTRAP_ADMIN_PASSWORD`
- `CORS_ALLOWED_ORIGINS` (must include your real domain)

## 6. Pre-Deploy Gate

Run the built-in gate:

```bash
./scripts/predeploy_gate.sh ./.env
```

This validates env completeness/placeholders and builds images using `docker-compose.prod.yml`.

## 7. Deploy Public Stack

```bash
./scripts/deploy_public.sh ./.env
```

Or manually:

```bash
docker compose -f docker-compose.prod.yml --env-file .env up -d --build
```

## 8. Verify Go-Live

```bash
docker compose -f docker-compose.prod.yml --env-file .env ps
curl -fsS https://paintflow.ai/api/health/live
curl -fsS https://paintflow.ai/api/health/ready
```

Open in browser:

- `https://paintflow.ai`

## 9. Operate / Update

```bash
git pull
./scripts/deploy_public.sh ./.env
```

View logs:

```bash
docker compose -f docker-compose.prod.yml --env-file .env logs -f caddy
docker compose -f docker-compose.prod.yml --env-file .env logs -f backend
docker compose -f docker-compose.prod.yml --env-file .env logs -f frontend
```

## 10. Optional CI/CD (GitHub Actions)

Workflow file: `.github/workflows/deploy-prod.yml`

It deploys on every push to `main` (and manual trigger) by SSH-ing into your VM and running `./scripts/deploy_public.sh`.

Required repository secrets:

- `PROD_SSH_HOST`
- `PROD_SSH_USER`
- `PROD_SSH_KEY`
- `PROD_APP_DIR` (absolute path to repo on server)

## 11. Rollback

Fast rollback to previous git revision:

```bash
git log --oneline -n 5
git checkout <last-known-good-commit>
./scripts/deploy_public.sh ./.env
```

## 12. Must-Do Post-Deploy Hardening

- Enable VM firewall (allow only `22`, `80`, `443`)
- Restrict SSH (key auth only, disable password login)
- Turn on automatic security updates
- Set external uptime monitoring for:
  - `https://paintflow.ai/api/health/live`
  - `https://paintflow.ai/api/health/ready`
- Backup DB volume on schedule (`pg_dump` daily)

## 13. Notes

- First TLS certificate issuance requires DNS to be fully propagated.
- If HTTPS check fails immediately after deploy, wait a few minutes and retry.
- Backend docs endpoints are proxied through Caddy (`/docs`, `/redoc`, `/openapi.json`).
