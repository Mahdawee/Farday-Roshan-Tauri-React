<?php
/**
 * صفر کردن سیستم از خط فرمان (پاک کردن معلومات کاری)
 *
 * استفاده:
 *   php reset_cli.php --status              → فقط نمایش تعداد ردیف‌های موجود
 *   php reset_cli.php --yes                 → پاک کردن همه معلومات کاری (مشتریان و کارمندان هم پاک می‌شوند)
 *   php reset_cli.php --yes --keep-masters  → مشتریان و کارمندان باقی بمانند (فقط اسناد پاک شوند)
 *   php reset_cli.php --yes --keep-machines → لیست ماشینری پاک نشود
 *   php reset_cli.php --yes --demo          → بعد از پاک کردن، معلومات نمونه بارگذاری شود (برای آزمایش)
 *
 * تنظیمات، مشخصات شرکت، کاربران سیستم و جدول‌های کشویی هرگز پاک نمی‌شوند.
 */
if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit('این فایل فقط از خط فرمان اجرا می‌شود. برای صفر کردن از مرورگر: تنظیمات → منطقه خطر.');
}

define('FR_SKIP_DB_CHECK', true);
require_once __DIR__ . '/app/bootstrap.php';
require_once __DIR__ . '/app/reset.php';

$args = array_slice($argv, 1);
$status       = in_array('--status', $args, true);
$yes          = in_array('--yes', $args, true);
$keepMasters  = in_array('--keep-masters', $args, true);
$keepMachines = in_array('--keep-machines', $args, true);
$withDemo     = in_array('--demo', $args, true);

try {
    Db::pdo();
} catch (Throwable $e) {
    fwrite(STDERR, "✖ اتصال به دیتابیس برقرار نشد: " . $e->getMessage() . "\n");
    exit(1);
}

$counts = data_counts();
echo "=== وضعیت فعلی سیستم ===\n";
foreach ($counts as $label => $n) {
    printf("  %-12s %s\n", $label, number_format($n));
}
echo "\n";

if ($status) {
    exit(0);
}

if (!$yes) {
    echo "برای پاک کردن معلومات کاری، این دستور را اجرا کنید:\n";
    echo "    php reset_cli.php --yes\n\n";
    echo "با این کار مشتریان و کارمندان هم پاک می‌شوند. اگر می‌خواهید آن‌ها بمانند:\n";
    echo "    php reset_cli.php --yes --keep-masters\n";
    exit(0);
}

try {
    $res = reset_business_data($keepMasters, $keepMasters, $keepMachines);
    echo "✔ سیستم صفر شد — مجموع ردیف‌های پاک‌شده: " . number_format($res['total']) . "\n";
    foreach ($res['tables'] as $label => $n) {
        printf("   - %-14s %s\n", $label, number_format($n));
    }
} catch (Throwable $e) {
    fwrite(STDERR, "✖ خطا در پاک کردن معلومات: " . $e->getMessage() . "\n");
    exit(1);
}

if ($withDemo) {
    echo "\n" . load_demo_data() . "\n";
}

echo "\nحالا سیستم آماده است. اول این‌ها را وارد کنید:\n";
echo "  ۱) صفحه «مشخصات شرکت» → نام، آدرس، مدیر مالی و سرپرست\n";
echo "  ۲) صفحه «تنظیمات» → تقویم، موجودی اول دخل و جدول‌های کشویی\n";
echo "  ۳) صفحه «کارمندان» → ثبت کارمندان شرکت\n";
echo "  ۴) صفحه «مشتریان» → ثبت مشتریان\n";
echo "  ۵) سپس فروشات، مصارف، رسیدات و معاشات را ثبت کنید.\n";
exit(0);
