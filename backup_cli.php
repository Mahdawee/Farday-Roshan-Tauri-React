<?php
/**
 * پشتیبان‌گیری از خط فرمان (بدون مرورگر)
 * استفاده:
 *     php backup_cli.php            → ساخت فایل پشتیبان در پوشه backups/
 *     php backup_cli.php --list     → نمایش فایل‌های پشتیبان موجود
 *     php backup_cli.php --keep=10  → بعد از ساخت، فقط ۱۰ فایل آخر را نگه دار
 *
 * توجه: بازگردانی (Restore) را همیشه از خود صفحه «پشتیبان‌گیری» در سیستم انجام دهید.
 */
if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit('این فایل فقط از خط فرمان اجرا می‌شود. برای پشتیبان‌گیری از مرورگر، صفحه backup.php را باز کنید.');
}

require_once __DIR__ . '/app/bootstrap.php';
require_once __DIR__ . '/app/backup.php';

$dir = FR_ROOT . '/backups';
if (!is_dir($dir) && !@mkdir($dir, 0775, true)) {
    fwrite(STDERR, "✖ پوشه backups قابل ساخت نیست: $dir\n");
    exit(1);
}

$args = array_slice($argv, 1);
$list = in_array('--list', $args, true);
$keep = null;
foreach ($args as $a) {
    if (preg_match('/^--keep=(\d+)$/', $a, $m)) {
        $keep = (int) $m[1];
    }
}

if ($list) {
    $files = array_values(array_filter(scandir($dir) ?: [], fn($f) => str_ends_with($f, '.sql')));
    if (!$files) {
        echo "هیچ فایل پشتیبانی موجود نیست.\n";
        exit(0);
    }
    echo "فایل‌های پشتیبان در $dir\n";
    foreach ($files as $f) {
        printf("  %-34s %8.1f KB   %s\n", $f, filesize($dir . '/' . $f) / 1024, date('Y-m-d H:i', filemtime($dir . '/' . $f)));
    }
    exit(0);
}

try {
    Db::pdo();
} catch (Throwable $e) {
    fwrite(STDERR, "✖ اتصال به دیتابیس برقرار نشد: " . $e->getMessage() . "\n");
    fwrite(STDERR, "  راه‌حل: MySQL/MariaDB را استارت کنید یا تنظیمات config.local.php را بررسی کنید.\n");
    exit(1);
}

try {
    $name = create_backup($dir);
    printf("✔ پشتیبان ساخته شد: %s (%.1f KB)\n", $name, filesize($dir . '/' . $name) / 1024);
} catch (Throwable $e) {
    fwrite(STDERR, "✖ خطا در ساخت پشتیبان: " . $e->getMessage() . "\n");
    exit(1);
}

if ($keep !== null && $keep > 0) {
    $files = array_values(array_filter(scandir($dir) ?: [], fn($f) => str_ends_with($f, '.sql')));
    sort($files);
    $old = array_slice($files, 0, max(0, count($files) - $keep));
    foreach ($old as $f) {
        @unlink($dir . '/' . $f);
        echo "  حذف فایل قدیمی: $f\n";
    }
}
