#!/usr/bin/env bash
# Pull + build + migrate + restart on a bare VPS. Run from the repo root (or set APP_DIR).
set -euo pipefail

APP_DIR=${APP_DIR:-/var/www/sanamspace}
cd "$APP_DIR"

echo "==> git pull"
git pull --ff-only

echo "==> backend"
cd "$APP_DIR/backend"
composer install --no-dev --optimize-autoloader --no-interaction
php artisan migrate --force
php artisan config:cache
php artisan route:cache
php artisan view:cache
php artisan storage:link 2>/dev/null || true

echo "==> frontend"
cd "$APP_DIR/frontend"
npm ci
npm run build

echo "==> restart services"
sudo systemctl restart php8.4-fpm sanamspace-frontend sanamspace-queue

echo "==> done."
