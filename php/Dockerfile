# PHP-FPM Dockerfile для Geo7
FROM php:8.2-fpm

# Встановлення системних залежностей та локалі для підтримки кирилиці
RUN apt-get update && apt-get install -y \
    libpng-dev \
    libjpeg-dev \
    libfreetype6-dev \
    curl \
    unzip \
    locales \
    && sed -i '/uk_UA.UTF-8/s/^# //g' /etc/locale.gen \
    && locale-gen \
    && rm -rf /var/lib/apt/lists/*

ENV LANG uk_UA.UTF-8
ENV LC_ALL uk_UA.UTF-8

# Встановлення PHP розширень
RUN docker-php-ext-install pdo pdo_mysql mysqli

# Налаштування PHP для продакшену
RUN mv "$PHP_INI_DIR/php.ini-production" "$PHP_INI_DIR/php.ini"

# Оновлення налаштувань PHP
RUN echo "upload_max_filesize = 20M" >> "$PHP_INI_DIR/php.ini" \
    && echo "post_max_size = 20M" >> "$PHP_INI_DIR/php.ini" \
    && echo "max_execution_time = 60" >> "$PHP_INI_DIR/php.ini" \
    && echo "memory_limit = 128M" >> "$PHP_INI_DIR/php.ini"

# Встановлення робочого каталогу
WORKDIR /var/www/html

# Запуск PHP-FPM
CMD ["php-fpm"]
