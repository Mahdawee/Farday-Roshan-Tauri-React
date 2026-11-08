#!/usr/bin/env bash
# آماده‌سازی محیط Dev Container — یک بار بعد از ساخته شدن کانتینر اجرا می‌شود
set -e

cd /workspace

echo "▶ نصب افزونه‌های PHP لازم..."
sudo docker-php-ext-install -j"$(nproc)" pdo_mysql mysqli >/dev/null 2>&1 || true

echo "▶ ساخت config.local.php برای اتصال به سرویس db ..."
cat > config.local.php <<'EOF'
<?php
// این فایل به صورت خودکار توسط .devcontainer/setup.sh ساخته شده است
return [
    'db_host' => 'db',
    'db_port' => 3306,
    'db_name' => 'farday_roshan',
    'db_user' => 'root',
    'db_pass' => 'root',
];
EOF

mkdir -p backups
echo "✔ آماده‌سازی تمام شد."
echo "  مرحله بعد: تب PORTS در VS Code → Forward a Port → 8080"
echo "  و یا اجرای دستور:  php -S 0.0.0.0:8080 -t ."
