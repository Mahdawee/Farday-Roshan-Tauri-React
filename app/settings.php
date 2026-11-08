<?php
/**
 * تنظیمات سیستم و مشخصات شرکت
 */

function settings_row(bool $refresh = false): array
{
    static $row = null;
    if ($row === null || $refresh) {
        $row = Db::one('SELECT * FROM `settings` WHERE `id`=1') ?: [
            'calendar' => 'shamsi', 'fiscal_start_month' => 1, 'fiscal_start_day' => 1,
            'cashbox_mode' => 'all', 'opening_cash' => 0, 'afn_label' => 'افغانی',
            'usd_label' => 'دالر', 'display_digits' => 'en', 'print_header' => '',
            'theme_mode' => 'auto', 'accent' => 'teal', 'density' => 'comfortable',
            'font_size' => 'normal', 'corner_style' => 'soft', 'table_stripes' => 1,
            'font_family' => 'poppins',
        ];
    }
    return $row;
}

function setting(string $key, $default = null)
{
    $r = settings_row();
    return array_key_exists($key, $r) && $r[$key] !== null && $r[$key] !== '' ? $r[$key] : $default;
}

function set_setting(string $key, $value): void
{
    if (!Db::exists('settings', 'id', 1)) {
        Db::insert('settings', ['id' => 1]);
    }
    settings_save([$key => $value]);
}

/**
 * ذخیره تنظیمات — اگر ستون تازه‌ای در دیتابیس نصب قدیمی نبود،
 * اول ساختار بروزرسانی می‌شود و بعد ذخیره دوباره انجام می‌گیرد
 * (تا خطای «Unknown column» هیچ‌وقت صفحه را از کار نیندازد).
 */
function settings_save(array $data): void
{
    if (!Db::exists('settings', 'id', 1)) {
        $data['id'] = 1;
        Db::insert('settings', $data);
        settings_row(true);
        return;
    }
    // Db::q خودش در صورت کم بودن ستون/جدول، ساختار را ترمیم می‌کند
    Db::update('settings', $data, '`id`=1');
    settings_row(true);
}

function company_row(): array
{
    static $row = null;
    if ($row === null) {
        $row = Db::one('SELECT * FROM `company` WHERE `id`=1') ?: [
            'name' => 'شرکت فردای روشن', 'activity_type' => 'تولید مواد ساختمانی',
            'address' => '', 'finance_manager' => '', 'supervisor' => '',
            'fiscal_year_note' => '', 'employees_count' => 0, 'phone' => '', 'email' => '',
            'license_no' => '', 'notes' => '',
        ];
    }
    return $row;
}

function company_name(): string
{
    return (string) (company_row()['name'] ?: 'شرکت فردای روشن');
}

/** انواع مواد فعال (برای حالت کشویی) */
function material_options(bool $activeOnly = true): array
{
    return lookup_options('material_types', $activeOnly);
}

/** عنوان کوتاه سرصفحه چاپ */
function print_header_text(): string
{
    return (string) (setting('print_header') ?: company_name());
}

/**
 * تنظیمات جداول کشویی (اقلام و مواد، انواع مصرف - مربوط، پرداخت‌کنندگان، منابع رسیدات)
 * کلید جدول => [عنوان، آیکون، شرح، ستون اضافی، SQL شمارش استفاده]
 */
function lookup_tables(): array
{
    return [
        'material_types' => [
            'title'   => 'تنظیمات اقلام و مواد',
            'short'   => 'اقلام و مواد',
            'icon'    => 'box',
            'table'   => 'material_types',
            'help'    => 'این اقلام همان چیزهایی است که در کشوی «نوع مواد» شیت فروشات نشان داده می‌شود '
                       . '(ماسه اول، ماسه دوم، ریگ، سنگ غرقه، خاک، ۰۱۹، ۰۲۸، ۰۳۸، ۰۴۸، ۰، ۰۱۲، ماشک و ...). '
                       . 'هر قلم یک «واحد» دارد — معمولاً متر مکعب.',
            'extra'   => ['col' => 'unit', 'type' => 'text', 'label' => 'واحد', 'default' => 'متر مکعب', 'width' => '110px'],
            'usage'   => 'SELECT material_id AS rid, COUNT(*) AS n FROM sales GROUP BY material_id',
            'usage_label' => 'استفاده در فروشات',
            'sample'  => ['ماسه اول', 'ماسه دوم', 'ریگ', 'سنگ غرقه', 'خاک', '۰۱۹'],
        ],
        'expense_types' => [
            'title'   => 'تنظیمات انواع مصرف - مربوط',
            'short'   => 'انواع مصرف - مربوط',
            'icon'    => 'expense',
            'table'   => 'expense_types',
            'help'    => 'این فهرست در کشوی «انواع مصرف - مربوط» شیت مصارف استفاده می‌شود — مثل کرایه وسایط، پیسکاری، '
                       . 'خرید سمنت، تیل، برق و غیره. با راپور «مصارف بر اساس نوع» می‌توانید هر نوع را جدا ببینید.',
            'extra'   => null,
            'usage'   => 'SELECT expense_type_id AS rid, COUNT(*) AS n FROM expenses GROUP BY expense_type_id',
            'usage_label' => 'استفاده در مصارف',
            'sample'  => ['کرایه وسایط', 'پیسکاری', 'خرید سمنت'],
        ],
        'payers' => [
            'title'   => 'تنظیمات پرداخت‌کننده‌گان',
            'short'   => 'پرداخت‌کننده‌گان',
            'icon'    => 'wallet',
            'table'   => 'payers',
            'help'    => 'کسانی که پول از دخل/جیب خود پرداخت می‌کنند (دخل شرکت، احمد، مدیر مالی و ...). '
                       . 'این فهرست در شیت مصارف و معاشات به عنوان «پرداخت‌کننده» انتخاب می‌شود و راپور '
                       . '«پرداخت‌ها بر اساس پرداخت‌کننده» از همین فهرست ساخته می‌شود.',
            'extra'   => ['col' => 'kind', 'type' => 'kind', 'label' => 'نوع', 'default' => 'شخصی', 'width' => '110px'],
            'usage'   => 'SELECT rid, SUM(n) AS n FROM ('
                       . 'SELECT payer_id AS rid, COUNT(*) AS n FROM expenses GROUP BY payer_id '
                       . 'UNION ALL SELECT payer_id AS rid, COUNT(*) AS n FROM salaries GROUP BY payer_id'
                       . ') x GROUP BY rid',
            'usage_label' => 'استفاده در اسناد',
            'sample'  => ['دخل', 'احمد', 'بانک'],
        ],
        'receipt_sources' => [
            'title'   => 'تنظیمات منابع و رسیدات',
            'short'   => 'منابع و رسیدات',
            'icon'    => 'money',
            'table'   => 'receipt_sources',
            'help'    => 'منبع هر رسید — یعنی پول «از درک» گرفته شده؟ (باقی داری، امانت، بیانیه و ...). '
                       . 'اگر گزینه «از باقی مانده بدهی کم شود» تیک داشته باشد، آن رسید از باقی مانده بدهی '
                       . 'مشتری کم می‌شود (مثل باقی داری)؛ در غیر این صورت فقط به عنوان پول داخل دخل ثبت می‌گردد.',
            'extra'   => ['col' => 'affects_balance', 'type' => 'bool', 'label' => 'از باقی مانده بدهی کم شود', 'default' => 1, 'width' => '130px'],
            'usage'   => 'SELECT source_id AS rid, COUNT(*) AS n FROM receipts GROUP BY source_id',
            'usage_label' => 'استفاده در رسیدات',
            'sample'  => ['باقی داری', 'امانت', 'بیانیه'],
        ],
    ];
}
