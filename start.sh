#!/usr/bin/env bash
# ===========================================================================
#  استارت سریع سیستم فردای روشن (لینوکس / مک / WSL / GitHub Codespaces)
#  استفاده:   bash start.sh          → پورت پیش‌فرض 8080
#             bash start.sh 8090     → پورت دلخواه
#             PHP_BIN=/usr/bin/php8.3 bash start.sh
# ===========================================================================
set -u
cd "$(dirname "$0")"

PORT="${1:-8080}"

echo "══════════════════════════════════════════════════"
echo "   سیستم مدیریت فردای روشن — استارت سرور محلی"
echo "══════════════════════════════════════════════════"

# ---------- ۱) پیدا کردن PHP ----------
PHP_BIN="${PHP_BIN:-}"
if [ -z "$PHP_BIN" ] && command -v php >/dev/null 2>&1; then
  PHP_BIN="php"
fi
if [ -z "$PHP_BIN" ]; then
  for c in /usr/bin/php /usr/local/bin/php /usr/bin/php8.3 /usr/bin/php8.2 /usr/bin/php8.1 /usr/bin/php8.0 /usr/bin/php7.4 \
           /opt/homebrew/bin/php /usr/local/opt/php/bin/php \
           /Applications/XAMPP/xamppfiles/bin/php /c/xampp/php/php.exe /mnt/c/xampp/php/php.exe; do
    if [ -x "$c" ]; then PHP_BIN="$c"; break; fi
  done
fi

if [ -z "$PHP_BIN" ]; then
  echo "✖ PHP پیدا نشد."
  echo "  • اوبونتو/دبیان:  sudo apt install php php-mysql php-mbstring"
  echo "  • مک:             brew install php"
  echo "  • ویندوز:         XAMPP یا Laragon نصب کنید و از فایل start.bat استفاده کنید"
  echo "  • یا مسیر PHP را دستی بدهید:  PHP_BIN=/path/to/php bash start.sh"
  exit 1
fi
echo "✔ PHP: $("$PHP_BIN" -r 'echo PHP_VERSION;')  ($PHP_BIN)"

# ---------- ۲) افزونه‌های لازم ----------
MISSING=""
for ext in pdo pdo_mysql mbstring session; do
  "$PHP_BIN" -m | grep -qi "^${ext}$" || MISSING="$MISSING $ext"
done
if [ -n "$MISSING" ]; then
  echo "⚠ افزونه‌های زیر موجود نیست:$MISSING"
  echo "  در لینوکس: sudo apt install php-mysql php-mbstring   و بعد وب‌سرور را دوباره استارت کنید"
  echo "  در ویندوز: در فایل php.ini خطوط extension=pdo_mysql و extension=mbstring را از تعلیق خارج کنید"
fi

# ---------- ۳) پورت مصروف است؟ ----------
port_busy() {
  if command -v lsof >/dev/null 2>&1; then
    lsof -i :"$1" >/dev/null 2>&1 && return 0
  elif command -v ss >/dev/null 2>&1; then
    ss -ltn 2>/dev/null | grep -q ":$1 " && return 0
  elif command -v netstat >/dev/null 2>&1; then
    netstat -ltn 2>/dev/null | grep -q ":$1 " && return 0
  fi
  return 1
}
if port_busy "$PORT"; then
  echo "⚠ پورت $PORT مصروف است — پورت بعدی را امتحان می‌کنم..."
  PORT=$((PORT + 1))
  while port_busy "$PORT" && [ "$PORT" -lt 8200 ]; do PORT=$((PORT + 1)); done
  echo "▶ پورت جدید: $PORT"
fi

# ---------- ۴) بررسی دیتابیس ----------
if ! "$PHP_BIN" -r 'define("FR_SKIP_DB_CHECK",true); define("FR_ALLOW_DB_FAILURE",true); require "app/bootstrap.php"; exit(Db::tableExists("settings") ? 0 : 1);' >/dev/null 2>&1; then
  echo "ℹ️  دیتابیس یا جداول آماده نیست."
  echo "   بعد از استارت سرور، این آدرس را باز کنید:  http://localhost:${PORT}/install.php"
  echo "   (اگر MySQL روشن نیست، اول آن را استارت کنید: در XAMPP دکمه Start مقابل MySQL)"
fi

echo "--------------------------------------------------"
echo "▶ آدرس سیستم:        http://localhost:${PORT}/"
echo "▶ نصب (بار اول):     http://localhost:${PORT}/install.php"
echo "▶ بررسی سلامت:       http://localhost:${PORT}/doctor.php"
echo "--------------------------------------------------"
echo "  • داخل VS Code / Codespaces: تب PORTS → Forward a Port → ${PORT}"
echo "  • برای خاموش کردن: Ctrl + C"
echo ""

exec "$PHP_BIN" -S "0.0.0.0:${PORT}" -t .
