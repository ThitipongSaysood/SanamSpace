#!/usr/bin/env bash
# Build + migrate + restart ON THE SERVER, after code has been synced in place
# (by the CI rsync step, or manually). Unlike deploy.sh this does NOT git pull —
# the code is already present. Run from the repo root (or set APP_DIR).
set -euo pipefail

APP_DIR=${APP_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}
RUN_USER=${RUN_USER:-www-data}
SUDO=""; [ "$(id -u)" -ne 0 ] && SUDO="sudo"

echo "==> backend"
cd "$APP_DIR/backend"
composer install --no-dev --optimize-autoloader --no-interaction
php artisan migrate --force
php artisan storage:link 2>/dev/null || true
php artisan config:cache
php artisan route:cache
php artisan view:cache

echo "==> frontend"
cd "$APP_DIR/frontend"
npm ci
npm run build

echo "==> permissions (rsync runs as root; services run as ${RUN_USER})"
$SUDO chown -R "${RUN_USER}:${RUN_USER}" \
  "$APP_DIR/backend/storage" "$APP_DIR/backend/bootstrap/cache" "$APP_DIR/frontend/.next" 2>/dev/null || true

echo "==> restart services"
$SUDO systemctl restart php8.4-fpm sanamspace-frontend sanamspace-queue

echo "==> done."
