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

## Path C — Auto-deploy on push (GitHub Actions)

`.github/workflows/deploy.yml` deploys on every push to `main`. The runner **rsyncs the
source to the server** (so the server never needs GitHub access — safe for a private repo),
then runs `infra/deploy/remote-build.sh` over SSH (composer + migrate + npm build + restart
systemd services).

**Prerequisite — provision the box once.** Easiest is the self-contained provisioner (no repo
needed on the server first; CI delivers the code):

```bash
scp infra/deploy/provision.sh root@ssh.semitennis.com:/root/
ssh root@ssh.semitennis.com 'APP_DOMAIN=semitennis.com bash /root/provision.sh'
# installs PHP-FPM/Composer/Node/MySQL/Nginx/rsync + systemd units + nginx site,
# creates the DB and backend/.env (with APP_KEY). Prints the generated DB password.
# Optional: ENABLE_TLS=yes TLS_EMAIL=you@x.com  (DNS must already point here)
#           DEPLOY_PUBKEY="$(cat ~/.ssh/sanamspace_deploy.pub)"  (authorize CI key)
```

(Or do it manually via **Path B**.) CI then only updates code + rebuilds — it does not bootstrap a bare box.

**One-time setup**

1. Add the CI public key to the server (run on your machine — needs your normal server login):
   ```bash
   ssh-copy-id -i ~/.ssh/sanamspace_deploy.pub root@ssh.semitennis.com
   # or paste ~/.ssh/sanamspace_deploy.pub into /root/.ssh/authorized_keys manually
   ```
2. Let the deploy user restart services without a TTY password. Logging in as `root` already
   works; for a non-root deploy user add a sudoers rule:
   ```
   deployuser ALL=(root) NOPASSWD: /bin/systemctl restart php8.4-fpm sanamspace-frontend sanamspace-queue
   ```
3. Add repository secrets (GitHub → Settings → Secrets and variables → Actions):
   - `DEPLOY_SSH_KEY` — contents of the **private** key `~/.ssh/sanamspace_deploy`
   - `SSH_HOST` — `ssh.semitennis.com`
   - `SSH_USER` — `root`
   - `DEPLOY_PATH` — e.g. `/var/www/sanamspace`
   - `SSH_PORT` — optional, defaults to `22`
4. Push to `main` (or run the workflow manually from the **Actions** tab → *Deploy to server* →
   *Run workflow*). Watch the run; first deploy validates SSH + build.

> Building the Next app on the server needs ~1–2 GB free RAM. If the box is small, add swap
> or switch to building on the runner.

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
