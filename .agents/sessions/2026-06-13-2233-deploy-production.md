---
date: 2026-06-13
agent: Claude (Claude Code)
branch: main
task: เตรียม deploy production (Docker + VPS)
status: done
---

# Production deploy preparation

## Verified
- **Laravel runs on MySQL**: `migrate:fresh --seed` clean on local MySQL 9.6 (38 app tables, seed correct).
  dev stays SQLite; prod = MySQL via .env. (schema.sql = 123-table design, not needed to run app)
- **Next standalone build**: `output:"standalone"` → `.next/standalone/server.js` builds OK.

## Artifacts (commit d593b3a)
- backend: `config/cors.php` (env CORS_ALLOWED_ORIGINS), `.env.production.example` (MySQL/queue/R2/LINE placeholders),
  `Dockerfile` (php8.4-fpm-alpine + pdo_mysql/intl/zip/bcmath/opcache), `docker/entrypoint.sh` (config/route/view cache + migrate --force + storage:link), `.dockerignore`
- frontend: `next.config.ts` output standalone, `Dockerfile` (multi-stage standalone, NEXT_PUBLIC_API_URL build arg), `.env.production.example` (/api/v1 same-origin), `.dockerignore`, gitignore negation to keep the example
- infra: `docker-compose.yml` (db+backend+frontend+nginx), `infra/nginx/default.conf` (edge: /api,/up,/sanctum→php-fpm, /→next, /storage), `infra/nginx/vps.conf` (bare VPS), `infra/deploy/deploy.sh`, systemd units (frontend + queue)
- `.env.deploy.example` (compose db creds), root `.gitignore` adds `/.env`
- `DEPLOYMENT.md` — Docker path + Ubuntu VPS path + post-deploy (real admin, R2, LINE, TLS) + verify

## Notes / not done
- Docker images NOT built locally (docker not installed in this env) — user verifies on server.
- Same-origin design (nginx edge) → NEXT_PUBLIC_API_URL=/api/v1, CORS moot; split-host needs CORS_ALLOWED_ORIGINS.
- Prod TODO before launch: real APP_KEY/DB_PASSWORD, APP_DEBUG=false, remove demo seed users, R2 storage, LINE LIFF real, payment gateway, TLS (certbot).

## For the next agent
- run prod locally-ish: `docker compose build && up -d` (needs docker) ; or VPS per DEPLOYMENT.md
- backend MySQL switch already proven; migrations are the source of truth (not schema.sql)
- 3 portals same-origin behind nginx: / (customer), /owner, /admin
