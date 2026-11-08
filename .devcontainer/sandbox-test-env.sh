#!/bin/bash
# fr-sandbox-setup.sh — rev10 (idempotent)
# بازسازی محیط اجرای «فردای روشن» پس از خالی‌شدن سندباکس:
#   bash /home/user/fr-sandbox-setup.sh
set -u
T=/tmp/tools
REPO=/home/user/Farday-Roshan-Building-Materials-Company
PHPBIN=$T/php83/native/php/php
MYSQLD=$T/mariadb/bin/mysqld
step() { printf '\n▶ %s\n' "$1"; }
mkdir -p "$T" /home/user/tools "$T/sessions"

# ۰) مخزن → آخرین کامیت برنچ
cd "$REPO" || exit 1
if [ "$(git log --oneline -1 | awk '{print $1}')" != "4408335" ]; then
  step 'بازگرداندن مخزن به آخرین کامیت'
  git fetch origin "+refs/heads/arena/01a0d1e2-farday-roshan-building-materia:refs/remotes/origin/arena/01a0d1e2-farday-roshan-building-materia" >/dev/null 2>&1
  git reset -q --mixed origin/arena/01a0d1e2-farday-roshan-building-materia
  echo "✔ HEAD: $(git log --oneline -1)"
fi

# ۱) PHP 8.3.8
if [ ! -x "$PHPBIN" ]; then
  step 'نصب PHP 8.3'
  cd "$T" || exit 1
  npm pack @libphp/amazon-linux-2-v83@0.0.14 >/dev/null 2>&1 || { echo '✖ npm pack'; exit 1; }
  tar xzf libphp-amazon-linux-2-v83-0.0.14.tgz && rm -rf php83 && mv package php83
  chmod +x php83/native/php/php php83/native/php/php-cgi php83/native/php/composer 2>/dev/null
  rm -f libphp-amazon-linux-2-v83-0.0.14.tgz
fi
if [ ! -f "$T/php.ini" ]; then
cat > "$T/php.ini" <<'INI'
[PHP]
extension_dir=/tmp/tools/php83/native/php/modules
display_errors=Off
log_errors=On
error_reporting=E_ALL & ~E_DEPRECATED & ~E_NOTICE
date.timezone=Asia/Kabul
default_charset=UTF-8
memory_limit=256M
max_execution_time=120
post_max_size=64M
upload_max_filesize=64M
session.save_path=/tmp/tools/sessions
expose_php=Off
extension=mysqlnd.so
extension=pdo.so
extension=pdo_mysql.so
extension=mbstring.so
extension=iconv.so
extension=fileinfo.so
extension=ctype.so
extension=tokenizer.so
extension=zip.so
zend_extension=opcache.so
opcache.enable=1
opcache.memory_consumption=128
opcache.validate_timestamps=1
opcache.revalidate_freq=0
opcache.enable_cli=1
[Session]
session.cookie_httponly=1
session.use_strict_mode=1
INI
fi
printf '%s\n' '#!/bin/bash' 'export LD_LIBRARY_PATH=/tmp/tools/php83/native/lib' \
  'exec /tmp/tools/php83/native/php/php -c /tmp/tools/php.ini "$@"' > /home/user/tools/php
chmod +x /home/user/tools/php
echo "✔ PHP: $(/home/user/tools/php -r 'echo PHP_VERSION;')"

# ۲) MariaDB 10.2.11
if [ ! -x "$MYSQLD" ]; then
  step 'نصب MariaDB 10.2.11'
  cd "$T" || exit 1
  curl -sL -H "Accept: application/vnd.github.raw" -o mariadb.zip \
    "https://api.github.com/repos/MariaDB4j/MariaDB4j/git/blobs/74337591cafff35911cf0eba10fea8b800d7c847" || { echo '✖ دانلود'; exit 1; }
  unzip -q -o mariadb.zip -d mariadb || exit 1
  chmod +x mariadb/bin/* mariadb/scripts/* 2>/dev/null   # ضروری: با حالت ۶۴۴ می‌آید
  rm -f mariadb.zip
fi
if [ ! -d "$T/mydata/mysql" ]; then
  step 'ساخت دیتادایرکتوری'
  cd "$T/mariadb/scripts" || exit 1
  LD_LIBRARY_PATH="$T/mariadb/libs:$T/mariadb/lib" ./mysql_install_db \
    --basedir="$T/mariadb" --datadir="$T/mydata" --auth-root-authentication-method=normal >/dev/null 2>&1 \
    && echo '✔ دیتادایرکتوری ساخته شد' || { echo '✖ mysql_install_db'; exit 1; }
fi

# ۳) dbq.php
if [ ! -f /home/user/tools/dbq.php ]; then
  step 'ساخت dbq.php'
  cat > /home/user/tools/dbq.php <<'PHP'
<?php
$sql = $argv[1] ?? ''; if ($sql === '') { fwrite(STDERR, "usage: dbq.php \"<sql>\"\n"); exit(2); }
$db = getenv('FR_DB'); if ($db === false) $db = 'farday_roshan';
$dsn = 'mysql:unix_socket=/tmp/tools/mysql.sock;charset=utf8mb4';
if ($db !== '-' && $db !== '') $dsn .= ';dbname=' . $db;
try { $pdo = new PDO($dsn, 'root', '', [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]); }
catch (Throwable $e) { fwrite(STDERR, 'ERR: ' . $e->getMessage() . "\n"); exit(1); }
try {
  $st = $pdo->query($sql);
  if ($st->columnCount() > 0) {
    $rows = $st->fetchAll(PDO::FETCH_ASSOC);
    if (!$rows) { echo "(0 rows)\n"; exit(0); }
    echo implode("\t", array_keys($rows[0])), "\n";
    foreach ($rows as $r) echo implode("\t", array_map(fn($v) => $v === null ? 'NULL' : $v, $r)), "\n";
  } else echo 'OK (affected: ' . $st->rowCount() . ")\n";
} catch (Throwable $e) { fwrite(STDERR, 'ERR: ' . $e->getMessage() . "\n"); exit(1); }
PHP
fi

# ۴) راه‌اندازی MariaDB
if [ ! -S "$T/mysql.sock" ]; then
  step 'راه‌اندازی MariaDB'
  nohup env LD_LIBRARY_PATH="$T/mariadb/libs:$T/mariadb/lib" "$MYSQLD" \
    --basedir="$T/mariadb" --datadir="$T/mydata" --socket="$T/mysql.sock" --port=3306 \
    --bind-address=127.0.0.1 --pid-file="$T/mysqld.pid" --skip-name-resolve \
    >"$T/mysqld.log" 2>&1 &
  for i in $(seq 1 40); do [ -S "$T/mysql.sock" ] && break; sleep 0.5; done
  [ -S "$T/mysql.sock" ] && echo '✔ MariaDB آماده' || { echo '✖ MariaDB بالا نیامد'; tail -5 "$T/mysqld.log"; exit 1; }
else echo '✔ MariaDB از قبل روشن است'; fi

# ۵) دیتابیس + config.local.php
FR_DB=- /home/user/tools/php /home/user/tools/dbq.php \
  "CREATE DATABASE IF NOT EXISTS farday_roshan CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci" >/dev/null
cd "$REPO" && /home/user/tools/php install_cli.php --write-config >/dev/null 2>&1 && echo '✔ دیتابیس و config.local.php آماده است'
echo; echo '✔ آماده.  وب: /home/user/tools/php -S 0.0.0.0:8080 -t /home/user/Farday-Roshan-Building-Materials-Company'
