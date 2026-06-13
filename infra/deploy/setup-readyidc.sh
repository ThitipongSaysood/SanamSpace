#!/usr/bin/env bash
# =============================================================================
# SanamSpace — one-time setup for THIS server (readyidc: Debian 12, nginx +
# php-fpm + MariaDB, with other live sites). Run as root.
# -----------------------------------------------------------------------------
# Designed to COEXIST with existing sites — it only ADDS things:
#   * php8.4-fpm via Sury (keeps php8.2 for your other sites; Laravel 13 needs >=8.3)
#   * a MariaDB database + user for SanamSpace
#   * the app dir + backend/.env (with APP_KEY)
#   * a systemd Next.js service (node) + queue worker
#   * repoints the backend.semitennis.com nginx vhost to the Laravel public dir
#   * adds an nginx vhost for the frontend domain (HTTP; add TLS with certbot after)
# It backs up nginx configs and runs `nginx -t` before reloading (auto-rollback on error).
#
# Usage (copy this one file to the server, then run):
#   scp infra/deploy/setup-readyidc.sh root@ssh.semitennis.com:/root/
#   ssh root@ssh.semitennis.com
#   DB_PASS='choose-a-strong-password' FRONTEND_DOMAIN='app.semitennis.com' bash /root/setup-readyidc.sh
#
# Re-runnable (idempotent-ish). After it finishes: set GitHub secrets + push to deploy.
# =============================================================================
set -euo pipefail

### -------- config (override via env) --------
DEPLOY_PATH="${DEPLOY_PATH:-/var/www/html/sanamspace}"
BACKEND_DOMAIN="${BACKEND_DOMAIN:-backend.semitennis.com}"   # already has nginx vhost + TLS
FRONTEND_DOMAIN="${FRONTEND_DOMAIN:-app.semitennis.com}"
DB_NAME="${DB_NAME:-sanamspace}"
DB_USER="${DB_USER:-sanamspace}"
DB_PASS="${DB_PASS:?Set DB_PASS=... when running (e.g. DB_PASS='secret' bash setup-readyidc.sh)}"
PHP_VER="8.4"
PHP_SOCK="/var/run/php/php${PHP_VER}-fpm.sock"
RUN_USER="www-data"

[ "$(id -u)" -eq 0 ] || { echo "ERROR: run as root"; exit 1; }
. /etc/os-release 2>/dev/null || true
export DEBIAN_FRONTEND=noninteractive
echo "==> SanamSpace setup  backend=${BACKEND_DOMAIN}  frontend=${FRONTEND_DOMAIN}  path=${DEPLOY_PATH}"

### -------- 1) PHP 8.4-fpm via Sury (coexists with 8.2) --------
echo "==> PHP ${PHP_VER}-fpm (Sury)"
if [ ! -f /usr/share/keyrings/deb.sury.org-php.gpg ]; then
  apt-get update -y
  apt-get install -y apt-transport-https ca-certificates curl
  curl -sSLo /tmp/debsuryorg-archive-keyring.deb https://packages.sury.org/debsuryorg-archive-keyring.deb
  dpkg -i /tmp/debsuryorg-archive-keyring.deb
fi
echo "deb [signed-by=/usr/share/keyrings/deb.sury.org-php.gpg] https://packages.sury.org/php/ ${VERSION_CODENAME:-bookworm} main" \
  > /etc/apt/sources.list.d/php.list
apt-get update -y
apt-get install -y php${PHP_VER}-fpm php${PHP_VER}-cli php${PHP_VER}-mysql php${PHP_VER}-mbstring \
  php${PHP_VER}-xml php${PHP_VER}-bcmath php${PHP_VER}-intl php${PHP_VER}-zip php${PHP_VER}-curl php${PHP_VER}-gd
systemctl enable --now "php${PHP_VER}-fpm"

### -------- 2) MariaDB database + user --------
echo "==> MariaDB database ${DB_NAME}"
mysql <<SQL
CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';
ALTER USER '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';
GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'localhost';
FLUSH PRIVILEGES;
SQL

### -------- 3) directories + backend/.env --------
echo "==> directories + backend/.env"
mkdir -p "${DEPLOY_PATH}/backend/public" "${DEPLOY_PATH}/frontend"
mkdir -p "${DEPLOY_PATH}/backend/storage/app/public" \
         "${DEPLOY_PATH}/backend/storage/framework/cache" \
         "${DEPLOY_PATH}/backend/storage/framework/sessions" \
         "${DEPLOY_PATH}/backend/storage/framework/views" \
         "${DEPLOY_PATH}/backend/storage/logs" \
         "${DEPLOY_PATH}/backend/bootstrap/cache"
if [ ! -f "${DEPLOY_PATH}/backend/.env" ]; then
  cat > "${DEPLOY_PATH}/backend/.env" <<ENV
APP_NAME=SanamSpace
APP_ENV=production
APP_KEY=base64:$(openssl rand -base64 32)
APP_DEBUG=false
APP_URL=https://${BACKEND_DOMAIN}

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
CORS_ALLOWED_ORIGINS=https://${FRONTEND_DOMAIN}

LINE_CHANNEL_ID=
LINE_CHANNEL_SECRET=
LINE_LIFF_ID=
ENV
  echo "    wrote ${DEPLOY_PATH}/backend/.env"
else
  echo "    backend/.env exists -> keeping it"
fi
chown -R "${RUN_USER}:${RUN_USER}" "${DEPLOY_PATH}"

### -------- 4) systemd services (Next.js + queue) --------
echo "==> systemd services"
NODE_BIN="$(command -v node || echo /usr/bin/node)"
PHP_BIN="$(command -v php${PHP_VER} || command -v php || echo /usr/bin/php${PHP_VER})"

cat > /etc/systemd/system/sanamspace-frontend.service <<UNIT
[Unit]
Description=SanamSpace Next.js (standalone)
After=network.target

[Service]
Type=simple
WorkingDirectory=${DEPLOY_PATH}/frontend
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=HOSTNAME=127.0.0.1
ExecStart=${NODE_BIN} server.js
Restart=always
RestartSec=3
User=${RUN_USER}

[Install]
WantedBy=multi-user.target
UNIT

cat > /etc/systemd/system/sanamspace-queue.service <<UNIT
[Unit]
Description=SanamSpace queue worker (Laravel)
After=network.target mariadb.service

[Service]
Type=simple
WorkingDirectory=${DEPLOY_PATH}/backend
ExecStart=${PHP_BIN} artisan queue:work --sleep=3 --tries=3 --max-time=3600
Restart=always
RestartSec=3
User=${RUN_USER}

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable sanamspace-frontend sanamspace-queue >/dev/null 2>&1 || true
# (services start after the first CI deploy ships + builds the code)

### -------- 5) nginx: repoint backend vhost + add frontend vhost --------
echo "==> nginx vhosts (backup + test before reload)"
BK_NGINX="/etc/nginx/sites-available/${BACKEND_DOMAIN}"
FE_NGINX="/etc/nginx/sites-available/${FRONTEND_DOMAIN}"
TS="$(date +%Y%m%d-%H%M%S)"
[ -f "$BK_NGINX" ] && cp -a "$BK_NGINX" "${BK_NGINX}.bak.${TS}"

# backend.* -> Laravel public dir, served by php8.4-fpm (TLS already managed by Certbot)
cat > "$BK_NGINX" <<'NGINX'
server {
    server_name __BDOMAIN__;
    root __ROOT__;
    index index.php index.html;
    client_max_body_size 20m;

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location ~ \.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:__PHPSOCK__;
    }

    location /storage/ {
        access_log off;
        expires 7d;
    }

    listen 443 ssl; # managed by Certbot
    ssl_certificate /etc/letsencrypt/live/__BDOMAIN__/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/__BDOMAIN__/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
}

server {
    if ($host = __BDOMAIN__) {
        return 301 https://$host$request_uri;
    }
    listen 80;
    server_name __BDOMAIN__;
    return 404;
}
NGINX
sed -i "s#__BDOMAIN__#${BACKEND_DOMAIN}#g; s#__ROOT__#${DEPLOY_PATH}/backend/public#g; s#__PHPSOCK__#${PHP_SOCK}#g" "$BK_NGINX"
ln -sf "$BK_NGINX" "/etc/nginx/sites-enabled/${BACKEND_DOMAIN}"

# frontend.* -> Next.js on 127.0.0.1:3000 (HTTP only; run certbot afterwards for TLS)
cat > "$FE_NGINX" <<'NGINX'
server {
    listen 80;
    server_name __FDOMAIN__;
    client_max_body_size 20m;

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
sed -i "s#__FDOMAIN__#${FRONTEND_DOMAIN}#g" "$FE_NGINX"
ln -sf "$FE_NGINX" "/etc/nginx/sites-enabled/${FRONTEND_DOMAIN}"

# test; roll back the backend change if the whole config is now invalid
if ! nginx -t; then
  echo "!! nginx -t FAILED — rolling back changes"
  [ -f "${BK_NGINX}.bak.${TS}" ] && cp -a "${BK_NGINX}.bak.${TS}" "$BK_NGINX"
  rm -f "/etc/nginx/sites-enabled/${FRONTEND_DOMAIN}" "$FE_NGINX"
  nginx -t && systemctl reload nginx || true
  exit 1
fi
systemctl reload nginx

cat <<DONE

============================================================
 SanamSpace base setup done ✔  (existing sites untouched)
------------------------------------------------------------
 Backend (API)  : https://${BACKEND_DOMAIN}   -> ${DEPLOY_PATH}/backend/public  (php${PHP_VER}-fpm)
 Frontend       : http://${FRONTEND_DOMAIN}    -> Next.js 127.0.0.1:3000 (systemd)
 DB             : ${DB_NAME} / ${DB_USER}  (MariaDB)
------------------------------------------------------------
 Next:
 1) Point DNS A record for ${FRONTEND_DOMAIN} -> this server, then:
       certbot --nginx -d ${FRONTEND_DOMAIN}
 2) GitHub repo secrets:
       SERVER_HOST=ssh.semitennis.com  SERVER_USER=root  SERVER_PASSWORD=********
       DEPLOY_PATH=${DEPLOY_PATH}
       NEXT_PUBLIC_API_URL=https://${BACKEND_DOMAIN}/api/v1
 3) Push to main (or Actions -> Run workflow). First deploy ships code,
    runs migrate, and starts sanamspace-frontend.
 4) Verify:  curl https://${BACKEND_DOMAIN}/up   then open https://${FRONTEND_DOMAIN}/
============================================================
DONE
