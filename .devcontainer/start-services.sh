#!/usr/bin/env bash
# هر بار که کانتینر بالا می‌آید: انتظار برای دیتابیس + آماده‌سازی جداول + استارت سرور PHP
set -e
cd /workspace

echo "▶ انتظار برای آماده شدن دیتابیس (سرویس db)..."
READY=0
for _ in $(seq 1 60); do
  if php -r '$p = @new PDO("mysql:host=db;port=3306", "root", "root"); echo "ok";' 2>/dev/null | grep -q ok; then
    echo "✔ دیتابیس آماده است."
    READY=1
    break
  fi
  sleep 2
done

if [ "$READY" = "1" ]; then
  echo "▶ آماده‌سازی جداول و معلومات اولیه (اجرای مکرر بی‌خطر است)..."
  php install_cli.php --db-host=db --db-port=3306 --db-name=farday_roshan \
      --db-user=root --db-pass=root --write-config \
    || echo "⚠ آماده‌سازی خودکار ناکام شد — یک بار install.php را در مرورگر باز کنید."
else
  echo "⚠ دیتابیس در دسترس نشد. بعد از آماده شدن آن، این را اجرا کنید:"
  echo "    php install_cli.php --db-host=db --db-user=root --db-pass=root --write-config"
fi

echo "▶ استارت سرور PHP روی پورت 8080 ..."
pkill -f "php -S 0.0.0.0:8080" 2>/dev/null || true
nohup php -S 0.0.0.0:8080 -t /workspace > /tmp/php-server.log 2>&1 &
sleep 1
echo "✔ سرور اجرا شد: http://localhost:8080"
echo "  • در VS Code: تب PORTS → پورت 8080 → Open in Browser"
echo "  • بررسی سلامت:  http://localhost:8080/doctor.php"
echo "  • گزارش سرور:   /tmp/php-server.log"
