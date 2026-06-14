---
date: 2026-06-13
agent: Claude (Claude Code, Opus 4.8)
branch: main
task: GitHub Actions deploy-on-push + provision the real server (readyidc)
status: WORKING — CI deploy green end-to-end
---

# Deploy pipeline LIVE + server provisioned

## Result
**Push to `main` → GitHub Actions builds + ships to the server, runs migrate + restarts services. First green run done.** Last workflow commit: `1759aa1` (added caching). The app is deployed at `/var/www/html/sanamspace` on the server but NOT yet publicly reachable (DNS + TLS for the app domain still pending — see below).

## The server (IMPORTANT — shared box with OTHER live projects)
- Host: `ssh.semitennis.com` = **157.85.97.241**, login `root` (password auth; user enters it).
- OS **Debian 12 (bookworm)**, hostname `readyidc`. **No control panel** (nginx/apache configured by hand).
- **nginx** front on :80/:443  →  **apache** on :8080 (other PHP projects). **MariaDB 10.11**. **Node 24**. Default PHP was **8.2**.
- DNS for `semitennis.com` is on **Cloudflare**. `backend.semitennis.com` (157.85.97.241, grey/DNS-only, has certbot TLS) **belongs to ANOTHER project — do NOT touch it.** Other existing vhosts: `admin`, `mysql`, `default`.
- ⚠️ Because other sites are live here: never run the generic `provision.sh` on this box (it would rm nginx default + install MariaDB over the existing one). Only additive changes.

## What was set up ON the server (one-time, via infra/deploy/setup-readyidc.sh)
- **php8.4-fpm** installed via **Sury** repo (coexists with 8.2; Laravel 13 requires php ^8.3). Socket `/var/run/php/php8.4-fpm.sock`.
- MariaDB DB **`sanamspace`** + user `sanamspace`@localhost (password = the DB_PASS the user chose; written into backend/.env).
- `${DEPLOY_PATH}=/var/www/html/sanamspace` with `backend/` + `frontend/` + storage skeleton + **backend/.env** (APP_KEY generated; APP_URL=https://sanam.semitennis.com; same-origin so CORS scoped to app domain).
- **systemd**: `sanamspace-frontend` (Next standalone: `node server.js`, 127.0.0.1:3000) + `sanamspace-queue` (php8.4 artisan queue:work). Enabled.
- **NEW nginx vhost** `sanam.semitennis.com` (same-origin): `/api`,`/up`,`/sanctum` → php8.4-fpm at backend/public; `/storage/` static; everything else → Next :3000. HTTP :80 only so far.
- One-time fix done by hand: DB already had tables (from an earlier schema.sql/partial migrate) → ran `php8.4 artisan migrate:fresh --force` once to let Laravel migrations own the schema. (CI uses plain `migrate --force` going forward — do NOT change it to fresh.)

## The CI workflow (.github/workflows/deploy.yml)
Style: **appleboy** (user's preference, from a previous project). Password auth.
- Build **Next standalone** on the runner (NEXT_PUBLIC_API_URL defaults `/api/v1`, same-origin) → assemble `_stage/frontend` (server.js + bundled node_modules + .next/static + public).
- `composer install --no-dev` on the runner (php 8.4) → `_stage/backend` (rsync-excludes .env/storage/tests/node_modules).
- `appleboy/scp-action` ships `_stage/{backend,frontend}` with `strip_components:1` → `${DEPLOY_PATH}/{backend,frontend}`.
- `appleboy/ssh-action` post-deploy: `php8.4 artisan migrate --force` + storage:link + config/route/view cache + chown www-data (storage, bootstrap/cache, frontend) + restart sanamspace-frontend/queue + reload php8.4-fpm.
- **Caching** added (commit 1759aa1): npm (setup-node), Next `.next/cache`, composer `backend/vendor`.

## GitHub Secrets set by user (4)
`SERVER_HOST=ssh.semitennis.com` · `SERVER_USER=root` · `SERVER_PASSWORD=****` · `DEPLOY_PATH=/var/www/html/sanamspace`. (NEXT_PUBLIC_API_URL not set — default `/api/v1` is correct for same-origin.)

## STILL TODO to make it publicly reachable
1. **Cloudflare DNS**: add A record `sanam` → `157.85.97.241`, **DNS only (grey cloud)** (so certbot HTTP-01 works, like backend.*).
2. On server: `certbot --nginx -d sanam.semitennis.com` (adds 443 + redirect to the sanam vhost).
3. Then https://sanam.semitennis.com/  → web (Next),  /api/v1/* → Laravel. Verify `curl https://sanam.semitennis.com/up`.
4. (optional) `php8.4 artisan db:seed --force` for demo data; rotate/remove demo users before real launch.
5. Remaining real-integration TODOs (unchanged): LINE LIFF, payment gateway (PromptPay/Omise), R2/S3 for slips.

## Gotchas learned
- Server php CLI default is 8.2 → CI + systemd call **php8.4** explicitly (Laravel 13 won't run on 8.2).
- DEPLOY_PATH layout must match: scp lands backend/ + frontend/ under it; nginx root = backend/public; Next run dir = frontend/.
- Speed: the cost is the Next build (whole-app compile every push), not the upload. Caching is the main lever; rsync-delta transfer not worth it (Next output hashes change each build).

## Files added/changed this session (all pushed to main)
- `.github/workflows/deploy.yml` (appleboy build+ship+migrate+restart, php8.4, caching)
- `infra/deploy/setup-readyidc.sh` (tailored, same-origin, coexists with other sites)
- `infra/deploy/provision.sh` (generic clean-VPS provisioner — Debian/Ubuntu aware; NOT for this box)
- `infra/deploy/remote-build.sh` (alt rsync-flow build, standalone), `DEPLOYMENT.md` (Path C)
