<?php
/**
 * نصب از خط فرمان (برای Dev Container، Codespaces، اسکریپت‌های خودکار و …)
 *
 * مثال‌ها:
 *     php install_cli.php                          → نصب با تنظیمات config.php / config.local.php
 *     php install_cli.php --demo                   → همراه با معلومات نمونه
 *     php install_cli.php --db-host=db --db-name=farday_roshan --db-user=root --db-pass=root --write-config
 *     php install_cli.php --admin-pass=MySecret123 --write-config
 *
 * نکته: این اسکریپت جداول را می‌سازد و معلومات اولیه را وارد می‌کند؛
 *       داده‌های موجود پاک نمی‌شوند (CREATE TABLE IF NOT EXISTS).
 */
if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit('این فایل فقط از خط فرمان اجرا می‌شود. برای نصب از مرورگر، صفحه install.php را باز کنید.');
}

define('FR_SKIP_DB_CHECK', true);
define('FR_ALLOW_DB_FAILURE', true);
require_once __DIR__ . '/app/bootstrap.php';
require_once __DIR__ . '/app/installer.php';

$opt = [
    'demo'         => false,
    'write_config' => false,
    'admin_pass'   => 'admin123',
];

foreach (array_slice($argv, 1) as $a) {
    if (preg_match('/^--(db-host|db-port|db-name|db-user|db-pass|admin-user|admin-pass)=(.*)$/', $a, $m)) {
        $key = str_replace('-', '_', $m[1]);
        $opt[$key] = $m[2];
    } elseif ($a === '--demo') {
        $opt['demo'] = true;
    } elseif ($a === '--write-config') {
        $opt['write_config'] = true;
    } elseif ($a === '--help' || $a === '-h') {
        echo "استفاده: php install_cli.php [گزینه‌ها]\n";
        echo "  --db-host=127.0.0.1   --db-port=3306   --db-name=farday_roshan\n";
        echo "  --db-user=root        --db-pass=\n";
        echo "  --admin-user=admin    --admin-pass=admin123   (فقط اگر جدول کاربران خالی باشد)\n";
        echo "  --demo                معلومات نمونه (برای آزمایش)\n";
        echo "  --write-config        ذخیره تنظیمات در config.local.php\n";
        exit(0);
    }
}

$cfg = app_config();
echo "=== نصب سیستم فردای روشن (خط فرمان) ===\n";
printf("سرور: %s:%s — دیتابیس: %s — کاربر: %s\n\n",
    $opt['db_host'] ?? $cfg['db_host'], $opt['db_port'] ?? $cfg['db_port'],
    $opt['db_name'] ?? $cfg['db_name'], $opt['db_user'] ?? $cfg['db_user']);

$res = fr_install($opt);

foreach ($res['messages'] as $m) {
    echo '✔ ' . $m . "\n";
}
foreach ($res['errors'] as $m) {
    fwrite(STDERR, '✖ ' . $m . "\n");
}

if ($res['errors']) {
    fwrite(STDERR, "\nنصب کامل نشد. برای دیدن جزئیات:  php doctor.php\n");
    exit(1);
}

echo "\nحالا این آدرس‌ها را باز کنید:\n";
echo "  سیستم:        http://localhost:8080/\n";
echo "  بررسی سلامت:  http://localhost:8080/doctor.php\n";
echo "  ورود:         " . (($opt['admin_user'] ?? 'admin')) . " / " . $opt['admin_pass'] . "\n";
exit(0);
