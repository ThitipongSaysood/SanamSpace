#!/usr/bin/env bash
# =============================================================================
# SanamSpace — one-time server provisioner (fresh Debian 12 / Ubuntu 22.04+, run as root)
# -----------------------------------------------------------------------------
# Self-contained: copy THIS ONE FILE to the server and run it. No repo needed —
# the GitHub Actions workflow (rsync) delivers the app code afterward.
#
#   scp infra/deploy/provision.sh root@ssh.semitennis.com:/root/
#   ssh root@ssh.semitennis.com
#   # then on the server:
#   APP_DOMAIN=semitennis.com bash /root/provision.sh
#
# Installs: PHP-FPM + ext, Composer, Node, MySQL, Nginx, rsync, systemd units,
# nginx site, cron scheduler. Creates the DB, the app .env (with APP_KEY), and
# the directory tree. Does NOT fetch app code — the first CI deploy does that.
#
# Override any default via env vars (see the config block below). Idempotent:
# safe to re-run.
# =============================================================================
set -euo pipefail

### ---------------- config (override via env) ----------------
APP_DOMAIN="${APP_DOMAIN:-_}"                 # nginx server_name; '_' = any host. Use your real domain to enable TLS.
DEPLOY_PATH="${DEPLOY_PATH:-/var/www/sanamspace}"
DB_NAME="${DB_NAME:-sanamspace}"
DB_USER="${DB_USER:-sanamspace}"
DB_PASS="${DB_PASS:-$(openssl rand -base64 18 | tr -dc 'A-Za-z0-9' | cut -c1-24)}"
PHP_VER="${PHP_VER:-8.4}"
NODE_MAJOR="${NODE_MAJOR:-20}"
RUN_USER="${RUN_USER:-www-data}"              # user the app services run as
DEPLOY_PUBKEY="${DEPLOY_PUBKEY:-}"            # optional: CI public key to authorize for root SSH
ENABLE_TLS="${ENABLE_TLS:-no}"                # 'yes' + a real APP_DOMAIN (DNS already pointing) -> runs certbot
TLS_EMAIL="${TLS_EMAIL:-}"
ENABLE_UFW="${ENABLE_UFW:-no}"                # 'yes' -> open 22/80/443 with ufw

### ---------------- preflight ----------------
[ "$(id -u)" -eq 0 ] || { echo "ERROR: run as root (sudo bash provision.sh)"; exit 1; }
. /etc/os-release 2>/dev/null || true
OS_ID="${ID:-debian}"
CODENAME="${VERSION_CODENAME:-bookworm}"
# DB engine: Debian ships MariaDB (mysql driver-compatible); Ubuntu has MySQL.
if [ "$OS_ID" = "ubuntu" ]; then DB_PKG="mysql-server"; DB_SERVICE="mysql"; DB_ENGINE="MySQL";
else DB_PKG="mariadb-server"; DB_SERVICE="mariadb"; DB_ENGINE="MariaDB"; fi
echo "==> Provisioning SanamSpace on ${PRETTY_NAME:-this server}"
echo "    domain=${APP_DOMAIN}  path=${DEPLOY_PATH}  php=${PHP_VER}  node=${NODE_MAJOR}  run_as=${RUN_USER}  db=${DB_ENGINE}"
export DEBIAN_FRONTEND=noninteractive

### ---------------- base packages ----------------
echo "==> apt base packages"
apt-get update -y
apt-get install -y ca-certificates curl gnupg lsb-release software-properties-common \
                   unzip git rsync openssl cron

### ---------------- swap (helps Next build on small boxes) ----------------
MEM_MB=$(awk '/MemTotal/{printf "%d", $2/1024}' /proc/meminfo 2>/dev/null || echo 0)
if [ "${MEM_MB:-0}" -lt 2048 ] && [ ! -f /swapfile ]; then
  echo "==> low RAM (${MEM_MB}MB) -> creating 2G swapfile"
  fallocate -l 2G /swapfile 2>/dev/null || dd if=/dev/zero of=/swapfile bs=1M count=2048
  chmod 600 /swapfile; mkswap /swapfile >/dev/null; swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

### ---------------- PHP ----------------
echo "==> PHP ${PHP_VER} + extensions (repo for ${OS_ID})"
if [ "$OS_ID" = "ubuntu" ]; then
  add-apt-repository -y ppa:ondrej/php
else
  # Debian (and derivatives): Sury repo — PPAs do not exist on Debian
  apt-get install -y apt-transport-https
  if [ ! -f /usr/share/keyrings/deb.sury.org-php.gpg ]; then
    curl -sSLo /tmp/debsuryorg-archive-keyring.deb https://packages.sury.org/debsuryorg-archive-keyring.deb
    dpkg -i /tmp/debsuryorg-archive-keyring.deb
  fi
  echo "deb [signed-by=/usr/share/keyrings/deb.sury.org-php.gpg] https://packages.sury.org/php/ ${CODENAME} main" \
    > /etc/apt/sources.list.d/php.list
fi
apt-get update -y
apt-get install -y \
  php${PHP_VER}-fpm php${PHP_VER}-cli php${PHP_VER}-mysql php${PHP_VER}-mbstring \
  php${PHP_VER}-xml php${PHP_VER}-bcmath php${PHP_VER}-intl php${PHP_VER}-zip \
  php${PHP_VER}-curl php${PHP_VER}-gd php${PHP_VER}-opcache

### ---------------- Composer ----------------
if ! command -v composer >/dev/null 2>&1; then
  echo "==> Composer"
  curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer
fi

### ---------------- Node ----------------
if ! command -v node >/dev/null 2>&1 || [ "$(node -v | cut -c2- | cut -d. -f1)" -lt "$NODE_MAJOR" ]; then
  echo "==> Node ${NODE_MAJOR}"
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y nodejs
fi

### ---------------- database (MySQL on Ubuntu / MariaDB on Debian) ----------------
echo "==> ${DB_ENGINE} (${DB_PKG})"
apt-get install -y "$DB_PKG"
systemctl enable --now "$DB_SERVICE"
mysql -uroot <<SQL
CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';
ALTER USER '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';
GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'localhost';
FLUSH PRIVILEGES;
SQL

### ---------------- Nginx ----------------
echo "==> Nginx"
apt-get install -y nginx

### ---------------- directory tree ----------------
echo "==> app directories at ${DEPLOY_PATH}"
mkdir -p "${DEPLOY_PATH}/backend" "${DEPLOY_PATH}/frontend"
mkdir -p "${DEPLOY_PATH}/backend/storage/app/public" \
         "${DEPLOY_PATH}/backend/storage/framework/cache" \
         "${DEPLOY_PATH}/backend/storage/framework/sessions" \
         "${DEPLOY_PATH}/backend/storage/framework/views" \
         "${DEPLOY_PATH}/backend/storage/logs" \
         "${DEPLOY_PATH}/backend/bootstrap/cache"
chown -R "${RUN_USER}:${RUN_USER}" "${DEPLOY_PATH}"

### ---------------- backend/.env (preserved across deploys; CI rsync excludes it) ----------------
if [ "$APP_DOMAIN" = "_" ]; then
  APP_URL="http://localhost"
else
  SCHEME="http"; [ "$ENABLE_TLS" = "yes" ] && SCHEME="https"
  APP_URL="${SCHEME}://${APP_DOMAIN}"
fi
if [ ! -f "${DEPLOY_PATH}/backend/.env" ]; then
  echo "==> writing backend/.env (new APP_KEY)"
  APP_KEY="base64:$(openssl rand -base64 32)"
  cat > "${DEPLOY_PATH}/backend/.env" <<ENV
APP_NAME=SanamSpace
APP_ENV=production
APP_KEY=${APP_KEY}
APP_DEBUG=false
APP_URL=${APP_URL}

LOG_CHANNEL=stack
LOG_LEVEL=error

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=${DB_NAME}
DB_USERNAME=${DB_USER}
DB_PASSWORD=${DB_PASS}

SESSION_DRIVER=database
CACHE_STORE=database
QUEUE_CONNECTION=database

FILESYSTEM_DISK=local
CORS_ALLOWED_ORIGINS=${APP_URL}

# LINE login (stub until real LIFF wired)
LINE_CHANNEL_ID=
LINE_CHANNEL_SECRET=
LINE_LIFF_ID=
ENV
  chown "${RUN_USER}:${RUN_USER}" "${DEPLOY_PATH}/backend/.env"
  chmod 640 "${DEPLOY_PATH}/backend/.env"
else
  echo "==> backend/.env already exists -> keeping it"
fi

### ---------------- frontend/.env.production (CI rsync excludes it) ----------------
if [ ! -f "${DEPLOY_PATH}/frontend/.env.production" ]; then
  echo "==> writing frontend/.env.production"
  echo "NEXT_PUBLIC_API_URL=/api/v1" > "${DEPLOY_PATH}/frontend/.env.production"
  chown "${RUN_USER}:${RUN_USER}" "${DEPLOY_PATH}/frontend/.env.production"
fi

### ---------------- systemd units ----------------
echo "==> systemd units"
cat > /etc/systemd/system/sanamspace-frontend.service <<UNIT
[Unit]
Description=SanamSpace Next.js (customer/owner/admin web)
After=network.target

[Service]
Type=simple
WorkingDirectory=${DEPLOY_PATH}/frontend
Environment=NODE_ENV=production
Environment=PORT=3000
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=3
User=${RUN_USER}

[Install]
WantedBy=multi-user.target
UNIT

cat > /etc/systemd/system/sanamspace-queue.service <<UNIT
[Unit]
Description=SanamSpace queue worker (Laravel)
After=network.target ${DB_SERVICE}.service

[Service]
Type=simple
WorkingDirectory=${DEPLOY_PATH}/backend
ExecStart=/usr/bin/php artisan queue:work --sleep=3 --tries=3 --max-time=3600
Restart=always
RestartSec=3
User=${RUN_USER}

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable sanamspace-frontend sanamspace-queue >/dev/null 2>&1 || true
# (app services start on the first CI deploy, once code is present & built)

### ---------------- nginx site ----------------
echo "==> nginx site"
cat > /etc/nginx/sites-available/sanamspace <<'NGINX'
server {
    listen 80;
    server_name __SERVER_NAME__;
    root __DEPLOY_PATH__/backend/public;
    index index.php;
    client_max_body_size 20m;

    # Laravel API / health / sanctum -> front controller
    location ~ ^/(api|up|sanctum) {
        try_files $uri /index.php?$query_string;
    }

    location ~ \.php$ {
        fastcgi_pass unix:/run/php/php__PHP_VER__-fpm.sock;
        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
        include fastcgi_params;
    }

    # Uploaded slips (local disk) via public/storage symlink
    location /storage/ {
        expires 7d;
        access_log off;
    }

    # Everything else -> Next.js (127.0.0.1:3000 via systemd)
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
NGINX
sed -i "s#__SERVER_NAME__#${APP_DOMAIN}#; s#__DEPLOY_PATH__#${DEPLOY_PATH}#g; s#__PHP_VER__#${PHP_VER}#g" \
    /etc/nginx/sites-available/sanamspace
ln -sf /etc/nginx/sites-available/sanamspace /etc/nginx/sites-enabled/sanamspace
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable nginx >/dev/null 2>&1 || true
systemctl restart "php${PHP_VER}-fpm" nginx

### ---------------- cron scheduler ----------------
echo "==> cron scheduler"
( crontab -l 2>/dev/null | grep -v 'artisan schedule:run'; \
  echo "* * * * * cd ${DEPLOY_PATH}/backend && /usr/bin/php artisan schedule:run >/dev/null 2>&1" ) | crontab -

### ---------------- authorize CI deploy key (optional) ----------------
if [ -n "$DEPLOY_PUBKEY" ]; then
  echo "==> authorizing CI deploy key for root"
  mkdir -p /root/.ssh; chmod 700 /root/.ssh
  touch /root/.ssh/authorized_keys; chmod 600 /root/.ssh/authorized_keys
  grep -qF "$DEPLOY_PUBKEY" /root/.ssh/authorized_keys || echo "$DEPLOY_PUBKEY" >> /root/.ssh/authorized_keys
fi

### ---------------- firewall (optional) ----------------
if [ "$ENABLE_UFW" = "yes" ]; then
  echo "==> ufw"
  apt-get install -y ufw
  ufw allow OpenSSH; ufw allow 'Nginx Full'; ufw --force enable
fi

### ---------------- TLS (optional) ----------------
if [ "$ENABLE_TLS" = "yes" ] && [ "$APP_DOMAIN" != "_" ]; then
  echo "==> certbot TLS for ${APP_DOMAIN}"
  apt-get install -y certbot python3-certbot-nginx
  certbot --nginx -d "${APP_DOMAIN}" --non-interactive --agree-tos \
    -m "${TLS_EMAIL:-admin@${APP_DOMAIN}}" --redirect \
    || echo "    certbot failed (is DNS for ${APP_DOMAIN} pointing here yet?) — re-run later"
fi

### ---------------- summary ----------------
cat <<DONE

============================================================
 SanamSpace server provisioned ✔
------------------------------------------------------------
 Path       : ${DEPLOY_PATH}
 DB         : ${DB_NAME} / ${DB_USER}
 DB pass    : ${DB_PASS}
              (also saved in ${DEPLOY_PATH}/backend/.env)
 App URL    : ${APP_URL}
------------------------------------------------------------
 Next steps:
 1) Make sure the CI deploy public key is authorized for root
    (pass DEPLOY_PUBKEY=... to this script, or run ssh-copy-id).
 2) Set GitHub repo secrets: DEPLOY_SSH_KEY, SSH_HOST, SSH_USER=root,
    DEPLOY_PATH=${DEPLOY_PATH}  (SSH_PORT optional).
 3) Push to main (or Actions -> "Deploy to server" -> Run workflow).
    The first deploy rsyncs the code, runs composer/migrate/npm build,
    and starts the app services.
 4) Verify:  curl ${APP_URL}/up   and open ${APP_URL}/
============================================================
DONE
