#!/bin/sh
set -e

# Runs on container start. Caches config/routes/views, applies migrations,
# links storage, then hands off to CMD (php-fpm).
php artisan config:cache
php artisan route:cache
php artisan view:cache
php artisan migrate --force
php artisan storage:link 2>/dev/null || true

exec "$@"
