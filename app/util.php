<?php
/**
 * توابع کمکی عمومی — فردای روشن
 */

/** فرار دادن متن برای HTML */
function e($s): string
{
    return htmlspecialchars((string) $s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

/** خواندن پارامتر GET/POST */
function req(string $key, $default = null)
{
    $v = $_POST[$key] ?? $_GET[$key] ?? null;
    if (is_string($v)) {
        $v = trim($v);
    }
    return ($v === null || $v === '') ? $default : $v;
}

/** خواندن از POST */
function post(string $key, $default = null)
{
    $v = $_POST[$key] ?? null;
    if (is_string($v)) {
        $v = trim($v);
    }
    return ($v === null || $v === '') ? $default : $v;
}

/** خواندن از GET */
function get(string $key, $default = null)
{
    $v = $_GET[$key] ?? null;
    if (is_string($v)) {
        $v = trim($v);
    }
    return ($v === null || $v === '') ? $default : $v;
}

/** تبدیل ارقام دری/عربی به لاتین */
function normalize_digits(?string $s): string
{
    if ($s === null) {
        return '';
    }
    $fa = ['۰','۱','۲','۳','۴','۵','۶','۷','۸','۹','٠','١','٢','٣','٤','٥','٦','٧','٨','٩','،'];
    $en = ['0','1','2','3','4','5','6','7','8','9','0','1','2','3','4','5','6','7','8','9',','];
    return str_replace($fa, $en, $s);
}

/** تبدیل ارقام لاتین به دری (اگر تنظیمات چنین باشد) */
function digit_style(string $s): string
{
    if (setting('display_digits', 'en') !== 'fa') {
        return $s;
    }
    $en = ['0','1','2','3','4','5','6','7','8','9'];
    $fa = ['۰','۱','۲','۳','۴','۵','۶','۷','۸','۹'];
    return str_replace($en, $fa, $s);
}

/** عدد صحیح/اعشاری از ورودی متنی کاربر */
function parse_number($v, float $default = 0): float
{
    $v = normalize_digits(is_string($v) ? $v : (string) $v);
    $v = str_replace([',', ' ', '٬'], '', $v);
    if ($v === '' || !is_numeric($v)) {
        return $default;
    }
    return (float) $v;
}

/** قالب‌بندی مبلغ با جداکننده هزار */
function fmt($n, int $dec = -1): string
{
    $n = (float) $n;
    if ($dec < 0) {
        $dec = (abs($n - round($n)) < 0.005) ? 0 : 2;
    }
    return digit_style(number_format($n, $dec, '.', ','));
}

/** مبلغ همراه واحد پولی */
function fmt_afn($n): string
{
    return fmt($n) . ' ' . setting('afn_label', 'افغانی');
}

function fmt_usd($n): string
{
    return '$ ' . fmt($n, 2) . ' ' . setting('usd_label', 'دالر');
}

/** قالب‌بندی متراژ (متر مکعب) */
function fmt_volume($n): string
{
    return fmt($n, 2) . ' متر مکعب';
}

/** پیام پیام‌رسان (flash) */
function flash(string $msg, string $type = 'success'): void
{
    $_SESSION['flash'][] = ['msg' => $msg, 'type' => $type];
}

function take_flashes(): array
{
    $f = $_SESSION['flash'] ?? [];
    unset($_SESSION['flash']);
    return $f;
}

/** انتقال به صفحه دیگر */
function redirect(string $url): void
{
    header('Location: ' . $url);
    exit;
}

/** آدرس فعلی با پارامترهای جدید */
function url_with(array $params = [], ?string $script = null): string
{
    $script = $script ?: basename($_SERVER['SCRIPT_NAME'] ?? '');
    $q = array_merge($_GET, $params);
    $q = array_filter($q, fn($v) => $v !== null && $v !== '');
    return $script . ($q ? '?' . http_build_query($q) : '');
}

/** توکن CSRF */
function csrf_token(): string
{
    if (empty($_SESSION['csrf'])) {
        $_SESSION['csrf'] = bin2hex(random_bytes(16));
    }
    return $_SESSION['csrf'];
}

function csrf_field(): string
{
    return '<input type="hidden" name="_csrf" value="' . e(csrf_token()) . '">';
}

/** از میدان خارج ساختن اسکریپت‌های خارجی. */
function csrf_check(): void
{
    $t = $_POST['_csrf'] ?? $_GET['_csrf'] ?? '';
    if (!hash_equals(csrf_token(), (string) $t)) {
        http_response_code(419);
        exit('درخواست معتبر نیست (CSRF). لطفاً صفحه را دوباره باز کنید.');
    }
}

/** ثبت در سابقه فعالیت */
function log_activity(string $action, string $entity, $entityId = null, string $details = ''): void
{
    try {
        Db::insert('activity_log', [
            'user_id'   => $_SESSION['user']['id'] ?? null,
            'username'  => $_SESSION['user']['username'] ?? 'system',
            'action'    => $action,
            'entity'    => $entity,
            'entity_id' => $entityId === null ? null : (string) $entityId,
            'details'   => mb_substr($details, 0, 250),
        ]);
    } catch (Throwable $e) {
        // ثبت ناکامی سابقه نباید کار کاربر را متوقف کند
    }
}

/** آرایه گزینه‌ها از یک جدول کشویی */
function lookup_options(string $table, bool $activeOnly = false): array
{
    $sql = "SELECT `id`, `name` FROM `$table`";
    if ($activeOnly) {
        $sql .= ' WHERE `active`=1';
    }
    $sql .= ' ORDER BY `sort_order`, `name`';
    $out = [];
    foreach (Db::all($sql) as $r) {
        $out[(int) $r['id']] = $r['name'];
    }
    return $out;
}

/** نام یک ردیف کشویی */
function lookup_name(string $table, $id): string
{
    if (!$id) {
        return '';
    }
    static $cache = [];
    $key = $table . '#' . $id;
    if (!isset($cache[$key])) {
        $cache[$key] = (string) Db::val("SELECT `name` FROM `$table` WHERE `id`=?", [$id], '');
    }
    return $cache[$key];
}

/** ساخت پرمالینک امن برای نام فایل‌های دانلودی */
function safe_filename(string $s): string
{
    $s = preg_replace('/[^\p{L}\p{N}\-_\.]+/u', '-', $s);
    return trim($s, '-') ?: 'file';
}

/** خروجی CSV با BOM برای اکسل */
function csv_output(string $filename, array $rows): void
{
    header('Content-Type: text/csv; charset=UTF-8');
    header('Content-Disposition: attachment; filename="' . $filename . '"');
    echo "\xEF\xBB\xBF";
    $out = fopen('php://output', 'w');
    foreach ($rows as $row) {
        fputcsv($out, $row);
    }
    fclose($out);
    exit;
}

/** خلاصه کردن متن بلند */
function str_excerpt(?string $s, int $len = 40): string
{
    $s = trim((string) $s);
    $s = preg_replace('/\s+/u', ' ', $s);
    return mb_strlen($s) > $len ? mb_substr($s, 0, $len) . '…' : $s;
}

/** مقادیر تکراری‌نشده یک ستون برای پیشنهاد در فورم‌ها (datalist) */
function distinct_values(string $table, string $col, int $limit = 25): array
{
    if (!preg_match('/^[a-zA-Z0-9_]+$/', $table) || !preg_match('/^[a-zA-Z0-9_]+$/', $col)) {
        return [];
    }
    $rows = Db::all("SELECT DISTINCT `$col` v FROM `$table` WHERE `$col` IS NOT NULL AND `$col` <> '' ORDER BY `id` DESC LIMIT $limit");
    return array_values(array_map(fn($r) => (string) $r['v'], $rows));
}

/** کد بعدی بر اساس بیشترین کد موجود (مثلاً CUS-013) */
function next_code(string $table, string $prefix, int $pad = 3, string $column = 'code'): string
{
    if (!preg_match('/^[a-zA-Z0-9_]+$/', $table) || !preg_match('/^[a-zA-Z0-9_]+$/', $column)) {
        return $prefix . '-' . str_pad('1', $pad, '0', STR_PAD_LEFT);
    }
    $max = 0;
    foreach (Db::all("SELECT `$column` c FROM `$table` WHERE `$column` IS NOT NULL AND `$column` <> ''") as $r) {
        if (preg_match('/(\d+)\s*$/', (string) $r['c'], $m)) {
            $max = max($max, (int) $m[1]);
        }
    }
    return $prefix . '-' . str_pad((string) ($max + 1), $pad, '0', STR_PAD_LEFT);
}

/** جمع امن */
function sum_col(array $rows, string $key): float
{
    $t = 0.0;
    foreach ($rows as $r) {
        $t += (float) ($r[$key] ?? 0);
    }
    return $t;
}

// ---------------------------------------------------------------------------
//  آیکن‌های SVG (بدون نیاز به فونت یا انترنت)
// ---------------------------------------------------------------------------
function icon(string $name, int $size = 16): string
{
    static $paths = [
        'home'     => '<path d="M2.5 7.5 8 3l5.5 4.5V13a.5.5 0 0 1-.5.5H3a.5.5 0 0 1-.5-.5z"/><path d="M6.5 13.5V9.5h3v4"/>',
        'sales'    => '<path d="M4 1.5h5.5L13 5v9.5H4z"/><path d="M6.5 8h4M6.5 10.5h4"/>',
        'money'    => '<rect x="1.5" y="3.5" width="13" height="9" rx="1.5"/><circle cx="8" cy="8" r="2.2"/>',
        'expense'  => '<path d="M2 4.5h12M7.5 2.5 5.5 4.5l2 2"/><path d="M14 11.5H2M8.5 13.5l2-2-2-2"/>',
        'salary'   => '<circle cx="6" cy="6" r="2.6"/><path d="M1.5 14c0-2.6 2-4.2 4.5-4.2s4.5 1.6 4.5 4.2"/><path d="M11 3.2a2.4 2.4 0 0 1 0 4.6M12 13.6c0-1.5-.4-2.5-1-3.2"/>',
        'users'    => '<circle cx="6" cy="5.5" r="2.4"/><path d="M1.5 14c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4"/><path d="M11.5 14c0-2 .8-3.4 3-3.9"/>',
        'client'   => '<rect x="2.5" y="2" width="11" height="12" rx="1"/><path d="M5.5 5h2M8.5 5h2M5.5 8h2M8.5 8h2M6 14v-3h4v3"/>',
        'calendar' => '<rect x="2" y="3.5" width="12" height="10.5" rx="1.2"/><path d="M2 6.8h12M5.2 1.8v3M10.8 1.8v3"/>',
        'bars'     => '<path d="M3 13.2V8.6h2.2v4.6zM6.9 13.2V3.4h2.2v9.8zM10.8 13.2V6.6H13v6.6z"/>',
        'line'     => '<path d="M2 12.5 5.6 8l2.8 2.2L13.5 4"/><path d="M10.5 4h3v3"/>',
        'pie'      => '<circle cx="8" cy="8" r="5.8"/><path d="M8 2.2V8h5.8"/>',
        'search'   => '<circle cx="7" cy="7" r="4.2"/><path d="M10.2 10.2 14 14"/>',
        'help'     => '<circle cx="8" cy="8" r="6"/><path d="M8.2 11.6v-1.1M6.3 6.2a1.8 1.8 0 1 1 2.6 1.6c-.6.3-.9.6-.9 1.2"/>',
        'factory'  => '<path d="M1.5 13.5v-7l3.5 2v-4l4 2.5V4l5 3v6.5z"/><path d="M4 13.5v-2h2v2"/>',
        'gear'     => '<circle cx="8" cy="8" r="2.3"/><path d="M8 1.4v1.8M8 12.8v1.8M1.4 8h1.8M12.8 8h1.8M3.3 3.3 4.6 4.6M11.4 11.4l1.3 1.3M12.7 3.3 11.4 4.6M4.6 11.4 3.3 12.7"/>',
        'lock'     => '<rect x="3" y="7" width="10" height="7" rx="1.2"/><path d="M5.3 7V5.2a2.7 2.7 0 0 1 5.4 0V7"/>',
        'clock'    => '<circle cx="8" cy="8" r="5.8"/><path d="M8 4.2V8l2.8 1.8"/>',
        'save'     => '<path d="M2.5 2.5h8.2L13.5 5.3v8.2h-11z"/><path d="M5 2.5v4h5v-4M5 13.5V10h5v3.5"/>',
        'plus'     => '<path d="M8 3v10M3 8h10"/>',
        'pencil'   => '<path d="M3 13.2l1-3.2 6.6-6.6 2.2 2.2L6.2 12.2z"/><path d="M9.4 4.6l2.2 2.2"/>',
        'trash'    => '<path d="M3 4.5h10M6.2 4.5V3h3.6v1.5M4.4 4.5l.8 9.3h5.6l.8-9.3"/>',
        'print'    => '<path d="M4.8 6.5V2.5h6.4v4"/><rect x="3" y="6.5" width="10" height="4.5" rx="1"/><path d="M5.5 11h5v2.8h-5z"/>',
        'download' => '<path d="M8 2.5v7M5 7l3 3 3-3M3 13.5h10"/>',
        'upload'   => '<path d="M8 13V6M5 8.5l3-3 3 3M3 2.5h10"/>',
        'close'    => '<path d="M4 4l8 8M12 4l-8 8"/>',
        'check'    => '<path d="M3 8.5l3.2 3.2L13 4.8"/>',
        'back'     => '<path d="M6.5 3.5 10 8l-3.5 4.5M10 8H2"/>',
        'refresh'  => '<path d="M13 8a5 5 0 1 1-2.1-4.1"/><path d="M13.4 2.2v3.6H9.8"/>',
        'truck'    => '<rect x="1.5" y="5" width="8" height="6" rx=".8"/><path d="M9.5 7h2.6l2 2.2V11h-4.6z"/><circle cx="4" cy="12.4" r="1.3"/><circle cx="11.4" cy="12.4" r="1.3"/>',
        'list'     => '<path d="M3 4h10M3 8h10M3 12h10"/>',
        'logout'   => '<path d="M10 2.5H3.5v11H10M7 8h7.5M12 5.2 14.8 8 12 10.8"/>',
        'user'     => '<circle cx="8" cy="5.4" r="2.8"/><path d="M2.5 14c0-2.8 2.6-4.2 5.5-4.2s5.5 1.4 5.5 4.2"/>',
        'filter'   => '<path d="M2 3.5h12L9.5 8.8v4.2l-3-1.6V8.8z"/>',
        'warn'     => '<path d="M8 2.5 14 13H2z"/><path d="M8 6.5v3M8 11.3v.2"/>',
        'info'     => '<circle cx="8" cy="8" r="6"/><path d="M8 7.2v4M8 4.9v.2"/>',
        'menu'     => '<path d="M2.5 4h11M2.5 8h11M2.5 12h11"/>',
        'cube'     => '<path d="M8 1.8 13.5 5v6L8 14.2 2.5 11V5z"/><path d="M2.5 5 8 8.2 13.5 5M8 8.2V14.2"/>',
        'up'       => '<path d="M8 12.5V3.8M4.4 7.4 8 3.8l3.6 3.6"/>',
        'down'     => '<path d="M8 3.5v8.7M4.4 8.6 8 12.2l3.6-3.6"/>',
        'edit'     => '<path d="M11.4 2.6 13.4 4.6 5.9 12.1 3.1 12.9l.8-2.8z"/>',
        'undo'     => '<path d="M3 8h6.4a3.1 3.1 0 0 1 0 6.2H6"/><path d="M5.6 5.6 3 8l2.6 2.4"/>',
        'shield'   => '<path d="M8 2 13 4v4.2c0 3-2 5-5 5.8-3-.8-5-2.8-5-5.8V4z"/><path d="M5.9 8.1 7.6 9.8l2.7-2.9"/>',
        'power'    => '<path d="M8 2.6v5.2"/><path d="M4.6 4.4a4.6 4.6 0 1 0 6.8 0"/>',
    ];
    $fillNames = ['bars' => 1, 'cube' => 0];
    $fill = isset($fillNames[$name]) ? 'currentColor' : 'none';
    $p = $paths[$name] ?? '';
    return '<svg class="ico-svg" width="' . $size . '" height="' . $size . '" viewBox="0 0 16 16" fill="' . $fill
         . '" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
         . $p . '</svg>';
}
