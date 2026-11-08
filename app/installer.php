<?php
/**
 * هسته نصب سیستم — مشترک بین نصب از مرورگر (install.php) و نصب از خط فرمان (install_cli.php)
 */

if (!defined('FR_ROOT')) {
    define('FR_ROOT', dirname(__DIR__));
}

/** اجرای یک فایل SQL (بدون نیاز به ابزار بیرونی) — تعداد دستورهای اجراشده را برمی‌گرداند */
function fr_run_sql_file(PDO $pdo, string $file): int
{
    $sql = @file_get_contents($file);
    if ($sql === false) {
        throw new RuntimeException('فایل خوانده نشد: ' . $file);
    }
    $lines = preg_split('/\r?\n/', $sql);
    $clean = [];
    foreach ($lines as $l) {
        if (preg_match('/^\s*--/', $l)) {
            continue; // حذف تعلیقات
        }
        $clean[] = $l;
    }
    $sql = implode("\n", $clean);
    $count = 0;
    foreach (explode(";\n", $sql) as $stmt) {
        $stmt = trim($stmt, " \t\n\r\0\x0B;");
        if ($stmt === '') {
            continue;
        }
        $pdo->exec($stmt);
        $count++;
    }
    return $count;
}

/** بروزرسانی ساختار نصب‌های قدیمی (اجرای مکرر بی‌خطر است) */
function fr_migrations(): array
{
    return [
        "ALTER TABLE `settings` ADD COLUMN `display_digits` ENUM('en','fa') NOT NULL DEFAULT 'en' AFTER `afn_label`",
        "ALTER TABLE `expenses` ADD COLUMN `usd_rate` DECIMAL(12,2) NULL COMMENT 'نرخ دالر (یادداشت)' AFTER `amount_usd`",
        "ALTER TABLE `attendance` MODIFY COLUMN `status` ENUM('حاضر','غایب','رخصت','مریض','رخصتی رسمی','جمعه') NOT NULL DEFAULT 'حاضر'",
        // --- تنظیمات ظاهر (نسخه‌های قدیمی‌تر) ---
        "ALTER TABLE `settings` ADD COLUMN `theme_mode` ENUM('light','dark','auto') NOT NULL DEFAULT 'auto' AFTER `print_header`",
        "ALTER TABLE `settings` ADD COLUMN `accent` VARCHAR(16) NOT NULL DEFAULT 'teal' AFTER `theme_mode`",
        "ALTER TABLE `settings` ADD COLUMN `density` ENUM('comfortable','compact') NOT NULL DEFAULT 'comfortable' AFTER `accent`",
        "ALTER TABLE `settings` ADD COLUMN `font_size` ENUM('small','normal','large') NOT NULL DEFAULT 'normal' AFTER `density`",
        "ALTER TABLE `settings` ADD COLUMN `corner_style` ENUM('soft','medium','sharp') NOT NULL DEFAULT 'soft' AFTER `font_size`",
        "ALTER TABLE `settings` ADD COLUMN `table_stripes` TINYINT NOT NULL DEFAULT 1 AFTER `corner_style`",
        "ALTER TABLE `settings` ADD COLUMN `font_family` ENUM('poppins','vazirmatn','system') NOT NULL DEFAULT 'poppins' AFTER `table_stripes`",
    ];
}

/**
 * اجرای کامل نصب
 * $opt: db_host, db_port, db_name, db_user, db_pass, demo(bool), admin_user, admin_pass, write_config(bool)
 * خروجی: ['messages' => [...], 'errors' => [...]]
 */
function fr_install(array $opt): array
{
    $cfg = function_exists('app_config') ? app_config() : [];
    $host = $opt['db_host'] ?? ($cfg['db_host'] ?? '127.0.0.1');
    $port = (int) ($opt['db_port'] ?? ($cfg['db_port'] ?? 3306));
    $name = $opt['db_name'] ?? ($cfg['db_name'] ?? 'farday_roshan');
    $user = $opt['db_user'] ?? ($cfg['db_user'] ?? 'root');
    $pass = (string) ($opt['db_pass'] ?? ($cfg['db_pass'] ?? ''));

    $messages = [];
    $errors = [];

    try {
        $pdo = new PDO("mysql:host=$host;port=$port;charset=utf8mb4", $user, $pass, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        ]);
        $pdo->exec("CREATE DATABASE IF NOT EXISTS `$name` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
        $pdo->exec("USE `$name`");
        $messages[] = 'دیتابیس «' . $name . '» آماده است.';

        // ۱) ساختار جداول
        $n1 = fr_run_sql_file($pdo, FR_ROOT . '/database/schema.sql');

        // ۲) بروزرسانی ساختار نصب‌های قبلی
        $mig = fr_ensure_schema($pdo);
        $done = $mig['applied'];

        // ۳) معلومات اولیه (جدول‌های lookup: مواد، انواع مصرف - مربوط، پرداخت‌کننده‌ها …)
        $n2 = fr_run_sql_file($pdo, FR_ROOT . '/database/seed.sql');
        $messages[] = 'جداول آماده شد (' . $n1 . ' ساختار) و معلومات اولیه ثبت شد (' . $n2 . ' بخش).';
        if ($done) {
            $messages[] = 'ساختار بروزرسانی شد (' . $done . ' تغییر).';
        }

        // ۴) کاربر مدیر (فقط اگر جدول کاربران خالی باشد)
        if (!empty($opt['admin_user'])) {
            $has = (int) $pdo->query('SELECT COUNT(*) FROM `users`')->fetchColumn();
            if ($has === 0) {
                $stmt = $pdo->prepare('INSERT INTO `users` (`username`,`password_hash`,`full_name`,`role`) VALUES (?,?,?,?)');
                $stmt->execute([
                    (string) $opt['admin_user'],
                    password_hash((string) ($opt['admin_pass'] ?? 'admin123'), PASSWORD_DEFAULT),
                    'مدیر سیستم',
                    'admin',
                ]);
                $messages[] = 'کاربر مدیر ساخته شد: ' . $opt['admin_user'];
            }
        }

        // ۵) ذخیره تنظیمات اتصال در config.local.php
        if (($opt['write_config'] ?? false)) {
            $localFile = FR_ROOT . '/config.local.php';
            $body = "<?php\n// تنظیمات محلی — این فایل به صورت خودکار ساخته شده است\nreturn " .
                var_export([
                    'db_host' => $host, 'db_port' => $port, 'db_name' => $name,
                    'db_user' => $user, 'db_pass' => $pass,
                ], true) . ";\n";
            if (@file_put_contents($localFile, $body) === false) {
                $errors[] = 'فایل config.local.php نوشته نشد (اجازه نوشتن نیست). لطفاً مقادیر را دستی در config.php وارد کنید.';
            } else {
                $messages[] = 'تنظیمات اتصال در فایل config.local.php ذخیره شد.';
            }
        }

        // ۶) معلومات نمونه (اختیاری — برای آزمایش)
        if (!empty($opt['demo'])) {
            require_once FR_ROOT . '/app/demo.php';
            $rows = demo_data($pdo, $name);
            $messages[] = 'معلومات نمونه ثبت شد: ' . $rows;
        }
    } catch (Throwable $ex) {
        $errors[] = 'خطا در نصب: ' . $ex->getMessage();
    }

    return ['messages' => $messages, 'errors' => $errors];
}

/** نسخه ساختار دیتابیس — با هر تغییر ساختار یکی زیاد کنید */
function fr_schema_version(): int
{
    return 4;
}

/**
 * چیزهایی که باید در دیتابیس باشند: نام جدول => ستون‌های ضروری (آرایه خالی = فقط موجود بودن جدول)
 */
function fr_required_columns(): array
{
    return [
        'settings'        => ['display_digits', 'theme_mode', 'accent', 'density', 'font_size', 'corner_style', 'table_stripes', 'font_family'],
        'expenses'        => ['usd_rate'],
        'company'         => [],
        'machines'        => [],
        'employees'       => [],
        'attendance'      => [],
        'customers'       => [],
        'material_types'  => [],
        'expense_types'   => [],
        'payers'          => [],
        'receipt_sources' => [],
        'sales'           => [],
        'receipts'        => [],
        'salaries'        => [],
        'users'           => [],
        'counters'        => [],
        'report_notes'    => [],
        'activity_log'    => [],
    ];
}

/** نقشه ساختار دیتابیس: [جدول => [ستون => true]] — با یک کوئری سبک */
function fr_db_schema_map(?PDO $pdo = null): array
{
    $pdo = $pdo ?: Db::pdo();
    $rows = $pdo->query(
        'SELECT `TABLE_NAME`, `COLUMN_NAME` FROM `information_schema`.`COLUMNS` WHERE `TABLE_SCHEMA` = DATABASE()'
    )->fetchAll(PDO::FETCH_NUM);
    $map = [];
    foreach ($rows as $r) {
        $map[(string) $r[0]][(string) $r[1]] = true;
    }
    return $map;
}

/** فهرست چیزهای کم (جدول یا ستون) */
function fr_schema_missing(?array $map = null): array
{
    try {
        $map = $map ?? fr_db_schema_map();
    } catch (Throwable $e) {
        return ['__error__'];
    }
    $miss = [];
    foreach (fr_required_columns() as $table => $cols) {
        if (!isset($map[$table])) {
            $miss[] = $table . ' (جدول)';
            continue;
        }
        foreach ($cols as $c) {
            if (!isset($map[$table][$c])) {
                $miss[] = $table . '.' . $c;
            }
        }
    }
    return $miss;
}

/** آیا ساختار دیتابیس کامل است؟ */
function fr_schema_ok(?PDO $pdo = null): bool
{
    return fr_schema_missing() === [];
}

/**
 * بروزرسانی ساختار نصب‌های قدیمی — اجرای مکرر بی‌خطر است.
 * خروجی: ['applied' => تعداد تغییر، 'errors' => [...], 'missing' => [...]]
 */
function fr_ensure_schema(?PDO $pdo = null): array
{
    $pdo = $pdo ?: Db::pdo();
    $applied = 0;
    $errors = [];
    $missing = fr_schema_missing();

    // ۱) جدول‌های کم → از schema.sql ساخته می‌شوند (IF NOT EXISTS دارد؛ معلومات موجود دست نمی‌خورد)
    $missingTables = false;
    foreach ($missing as $m) {
        if (str_contains($m, '(جدول)')) {
            $missingTables = true;
            break;
        }
    }
    if ($missingTables) {
        try {
            fr_run_sql_file($pdo, FR_ROOT . '/database/schema.sql');
            $applied++;
        } catch (Throwable $e) {
            $errors[] = $e->getMessage();
        }
    }

    // ۲) ستون‌های تازه
    foreach (fr_migrations() as $m) {
        try {
            $pdo->exec($m);
            $applied++;
        } catch (Throwable $e) {
            // ستون از قبل موجود است — نادیده گرفته می‌شود
        }
    }

    return ['applied' => $applied, 'errors' => $errors, 'missing' => fr_schema_missing()];
}
