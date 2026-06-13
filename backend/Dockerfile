# SanamSpace API — PHP 8.4 / Laravel (php-fpm)
FROM php:8.4-fpm-alpine

# System + PHP extensions (pdo_mysql for prod DB, intl/zip/bcmath, opcache)
RUN apk add --no-cache git icu-dev oniguruma-dev libzip-dev $PHPIZE_DEPS \
    && docker-php-ext-install pdo_mysql bcmath intl zip opcache \
    && apk del $PHPIZE_DEPS

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

# Install PHP deps first (better layer caching)
COPY composer.json composer.lock ./
RUN composer install --no-dev --no-scripts --no-autoloader --prefer-dist --no-interaction

# App code
COPY . .
RUN composer dump-autoload --optimize --no-dev --no-interaction \
    && mkdir -p storage/framework/cache storage/framework/sessions storage/framework/views bootstrap/cache \
    && chown -R www-data:www-data storage bootstrap/cache

COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 9000
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["php-fpm"]
