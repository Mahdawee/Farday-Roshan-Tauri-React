<?php
/**
 * صفر کردن سیستم — پاک کردن معلومات کاری (برای شروع تازه یا قبل از تحویل)
 *
 * چه چیزی پاک می‌شود: فروشات، مصارف، رسیدات، معاشات، حضور و غیاب،
 *   مشتریان، کارمندان، سابقه فعالیت‌ها، یادداشت راپورها و شمارنده شماره اسناد.
 * چه چیزی می‌ماند: تنظیمات، مشخصات شرکت، کاربران سیستم، ماشینری و
 *   جدول‌های کشویی (انواع مواد، انواع مصرف - مربوط، پرداخت‌کنندگان، منابع رسیدات).
 */

if (!defined('FR_ROOT')) {
    define('FR_ROOT', dirname(__DIR__));
}

/** جدول‌هایی که در حالت پیش‌فرض خالی می‌شوند (به ترتیب امن برای کلید خارجی) */
function reset_tables(bool $keepCustomers = false, bool $keepEmployees = false): array
{
    $tables = [
        'salaries'     => 'معاشات',
        'attendance'   => 'حضور و غیاب',
        'receipts'     => 'رسیدات',
        'sales'        => 'فروشات',
        'expenses'     => 'مصارف',
        'report_notes' => 'یادداشت راپورها',
        'activity_log' => 'سابقه فعالیت‌ها',
    ];
    if (!$keepCustomers) {
        $tables['customers'] = 'مشتریان';
    }
    if (!$keepEmployees) {
        $tables['employees'] = 'کارمندان';
    }
    return $tables;
}

/**
 * اجرای صفرسازی
 * خروجی: ['tables' => [نام => تعداد حذف‌شده], 'total' => مجموع]
 */
function reset_business_data(bool $keepCustomers = false, bool $keepEmployees = false, bool $keepMachines = false): array
{
    $report = ['tables' => [], 'total' => 0];

    // نکته: دستور ALTER TABLE تراکنش را خودکار می‌بندد، پس تراکنش استفاده نمی‌کنیم.
    try {
        foreach (reset_tables($keepCustomers, $keepEmployees) as $table => $label) {
            if (!Db::tableExists($table)) {
                continue;
            }
            $count = (int) Db::val("SELECT COUNT(*) FROM `$table`", [], 0);
            Db::pdo()->exec("DELETE FROM `$table`");
            Db::pdo()->exec("ALTER TABLE `$table` AUTO_INCREMENT = 1");
            $report['tables'][$label] = $count;
            $report['total'] += $count;
        }

        // شمارنده شماره اسناد → از نو
        if (Db::tableExists('counters')) {
            Db::pdo()->exec('DELETE FROM `counters`');
        }

        // ماشینری (اختیاری)
        if (!$keepMachines && Db::tableExists('machines')) {
            $count = (int) Db::val('SELECT COUNT(*) FROM `machines`', [], 0);
            Db::pdo()->exec('DELETE FROM `machines`');
            Db::pdo()->exec('ALTER TABLE `machines` AUTO_INCREMENT = 1');
            $report['tables']['ماشینری'] = $count;
            $report['total'] += $count;
        }

    } catch (Throwable $e) {
        throw $e;
    }

    return $report;
}

/** بارگذاری معلومات نمونه (برای آزمایش) — اگر سیستم خالی نباشد کاری نمی‌کند */
function load_demo_data(): string
{
    require_once FR_ROOT . '/app/demo.php';
    return demo_data(Db::pdo(), (string) app_config()['db_name']);
}

/** خلاصه وضعیت: تعداد ردیف‌های جدول‌های اصلی (برای نمایش در صفحه تنظیمات) */
function data_counts(): array
{
    $out = [];
    foreach (['employees' => 'کارمندان', 'customers' => 'مشتریان', 'sales' => 'فروشات',
              'expenses' => 'مصارف', 'receipts' => 'رسیدات', 'salaries' => 'معاشات'] as $t => $label) {
        $out[$label] = Db::tableExists($t) ? (int) Db::val("SELECT COUNT(*) FROM `$t`", [], 0) : 0;
    }
    return $out;
}

/** رمز مخصوص گزینه‌های ویژه (به صورت هش نگه داشته می‌شود، نه متن ساده) */
function special_password_hash(): string
{
    return 'a36aef5a11c4073fbe60314fc9df530a9d5f986533594d1f5190742ff9e0e408';
}

/** آیا رمز «گزینه‌های ویژه» درست است؟ */
function special_password_ok(string $pass): bool
{
    $want = special_password_hash();
    $got  = hash('sha256', trim($pass));
    return hash_equals($want, $got);
}

/** آیا بخش ویژه در این نشست باز است؟ */
function special_unlocked(): bool
{
    return (int) ($_SESSION['fr_special_until'] ?? 0) > time();
}

/** چند دقیقه تا قفل شدن بخش ویژه */
function special_minutes_left(): int
{
    return max(0, (int) ceil(((int) ($_SESSION['fr_special_until'] ?? 0) - time()) / 60));
}

/**
 * بازگشت به حالت کارخانه (گزینه ویژه «—»):
 *   تمام معلومات کاری + جدول‌های کشویی + تنظیمات + مشخصات شرکت به حالت اولیه
 *   کاربران سیستم باقی می‌مانند (تا دسترسی مدیر از دست نرود).
 */
function factory_reset(): array
{
    $report = reset_business_data(false, false, false);   // معلومات کاری + مشتریان + کارمندان

    // جدول‌های کشویی و ماشینری
    foreach (['material_types' => 'اقلام و مواد', 'expense_types' => 'انواع مصرف - مربوط',
              'payers' => 'پرداخت‌کنندگان', 'receipt_sources' => 'منابع رسیدات',
              'machines' => 'ماشینری'] as $table => $label) {
        if (!Db::tableExists($table)) {
            continue;
        }
        $n = (int) Db::val("SELECT COUNT(*) FROM `$table`", [], 0);
        Db::pdo()->exec("DELETE FROM `$table`");
        Db::pdo()->exec("ALTER TABLE `$table` AUTO_INCREMENT = 1");
        $report['tables'][$label] = $n;
        $report['total'] += $n;
    }

    // تنظیمات → حالت پیش‌فرض کارخانه
    if (Db::tableExists('settings')) {
        Db::pdo()->exec("UPDATE `settings` SET
            calendar='shamsi', fiscal_start_month=1, fiscal_start_day=1, cashbox_mode='all',
            opening_cash=0, opening_cash_date=NULL, usd_label='دالر', afn_label='افغانی',
            display_digits='en', print_header='',
            theme_mode='auto', accent='teal', density='comfortable', font_size='normal',
            corner_style='soft', table_stripes=1, font_family='poppins'
            WHERE `id`=1");
    }

    // مشخصات شرکت → خالی (فقط نام و نوع فعالیت می‌ماند)
    if (Db::tableExists('company')) {
        Db::pdo()->exec("UPDATE `company` SET address='', finance_manager='', supervisor='',
            fiscal_year_note='', employees_count=0, phone='', email=NULL, license_no=NULL, notes='' WHERE `id`=1");
    }

    // معلومات اولیه (اقلام، انواع مصرف - مربوط، پرداخت‌کنندگان، منابع) از نو
    try {
        fr_run_sql_file(Db::pdo(), FR_ROOT . '/database/seed.sql');
    } catch (Throwable $e) {
        // بی‌صدا — دیتابیس اصلی پاک شده است
    }

    return $report;
}
