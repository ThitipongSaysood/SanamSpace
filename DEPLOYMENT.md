# SanamSpace — Deployment Guide

Stack: **Next.js 16** (customer + `/owner` + `/admin`) · **Laravel 13 / PHP 8.4** API (`/api/v1`) · **MySQL 8**.
Two supported paths: **Docker Compose** (recommended) and **bare Ubuntu VPS** (per the architecture).

> The app is verified on MySQL (the dev DB is SQLite; `php artisan migrate --force` runs cleanly on MySQL 8/9).
> Laravel migrations cover the live application tables (~38). `database/schema.sql` is the full 123-table
> design reference for the complete platform — not required to run the app.

---

## Prerequisites
- A domain pointing at the server, ports 80/443 open.
- **Docker path:** Docker + Docker Compose.
- **VPS path:** Ubuntu 22.04+, PHP 8.4 (+ext: pdo_mysql, mbstring, intl, zip, bcmath, opcache), Composer, Node 20, MySQL 8, Nginx, certbot.

---

## Path A — Docker Compose (recommended)

Builds 4 services: `db` (mysql), `backend` (php-fpm), `frontend` (Next standalone), `nginx` (edge → same-origin).

```bash
# 1. backend env
cp backend/.env.production.example backend/.env
#   edit backend/.env: set DB_HOST=db, DB_DATABASE/DB_USERNAME/DB_PASSWORD, APP_URL, CORS_ALLOWED_ORIGINS

# 2. db credentials for the db service (must match backend/.env)
cp .env.deploy.example .env        # set DB_DATABASE/DB_USERNAME/DB_PASSWORD/DB_ROOT_PASSWORD
#   (NEXT_PUBLIC_API_URL defaults to /api/v1 — same-origin behind nginx)

# 3. build + run
docker compose build
docker compose up -d

# 4. app key + (optional) demo data
docker compose exec backend php artisan key:generate
docker compose exec backend php artisan db:seed --force   # seeds demo orgs/users — skip for a clean prod
```

App is now on `http://<server>/` — customer at `/`, owner at `/owner`, platform admin at `/admin`.
Migrations run automatically on backend start (`docker/entrypoint.sh`).

**TLS:** terminate HTTPS at a front proxy (Caddy/Traefik) or add certbot to the nginx service. Update `APP_URL` to `https://…`.

**Notes**
- `NEXT_PUBLIC_API_URL` is **build-time** (inlined). It defaults to `/api/v1` (same-origin). To point the web at a separate API host, set the build arg and rebuild `frontend`.
- Uploaded slips use the local disk volume `backend_storage`. For real prod use **Cloudflare R2 / S3** (set `FILESYSTEM_DISK=s3` + AWS_* in `backend/.env`) so slips are durable, CDN-served absolute URLs.

---

## Path B — Bare Ubuntu VPS

```bash
sudo mkdir -p /var/www/sanamspace && sudo chown -R $USER /var/www/sanamspace
git clone <repo> /var/www/sanamspace && cd /var/www/sanamspace

# --- MySQL ---
sudo mysql -e "CREATE DATABASE sanamspace CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
sudo mysql -e "CREATE USER 'sanamspace'@'localhost' IDENTIFIED BY 'STRONG_PW'; GRANT ALL ON sanamspace.* TO 'sanamspace'@'localhost'; FLUSH PRIVILEGES;"

# --- Backend ---
cd backend
cp .env.production.example .env     # DB_HOST=127.0.0.1, DB_* creds, APP_URL, CORS_ALLOWED_ORIGINS
composer install --no-dev --optimize-autoloader
php artisan key:generate
php artisan migrate --force
php artisan db:seed --force          # optional demo data
php artisan storage:link
php artisan config:cache && php artisan route:cache && php artisan view:cache

# --- Frontend ---
cd ../frontend
cp .env.production.example .env.production   # NEXT_PUBLIC_API_URL=/api/v1 (same-origin)
npm ci && npm run build

# --- Services (systemd) ---
sudo cp ../infra/deploy/sanamspace-frontend.service /etc/systemd/system/
sudo cp ../infra/deploy/sanamspace-queue.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now sanamspace-frontend sanamspace-queue

# --- Nginx ---
sudo cp ../infra/nginx/vps.conf /etc/nginx/sites-available/sanamspace
#   edit server_name; symlink + reload
sudo ln -sf /etc/nginx/sites-available/sanamspace /etc/nginx/sites-enabled/sanamspace
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d example.com          # TLS

# --- Scheduler (cron) ---
( crontab -l 2>/dev/null; echo "* * * * * cd /var/www/sanamspace/backend && php artisan schedule:run >/dev/null 2>&1" ) | crontab -
```

**Redeploys:** `bash infra/deploy/deploy.sh` (pull → composer/npm build → migrate → optimize → restart services).

---

## Post-deploy

- **Create a real platform admin** (instead of the demo seed):
  `php artisan tinker` → `\App\Models\User::create(['name'=>'Admin','email'=>'admin@yourco.com','password'=>bcrypt('…'),'is_super_admin'=>true]);`
- Demo logins (only if you ran the seeder): owner `owner@everyday.test / password`, super admin `super@sanamspace.test / password`. **Remove/rotate before real launch.**
- Set strong `DB_PASSWORD`, unique `APP_KEY`, `APP_DEBUG=false`, real `CORS_ALLOWED_ORIGINS`.
- Switch slip/image storage to R2/S3 for production.
- LINE login is currently a stub — fill `LINE_*` and wire real LIFF before go-live.

## Verify after deploy
```bash
curl https://example.com/up                       # 200
curl https://example.com/api/v1/branches          # JSON venues
# open https://example.com/ (customer), /owner, /admin
```
