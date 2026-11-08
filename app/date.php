<?php
/**
 * تبدیل و قالب‌بندی تاریخ (هجری شمسی ↔ میلادی)
 * در دیتابیس همیشه تاریخ میلادی (DATE) ذخیره می‌شود؛
 * نمایش و ورود معلومات مطابق تقویم انتخابی سیستم (تنظیمات) انجام می‌شود.
 */

function _div($a, $b) { return intdiv((int) $a, (int) $b); }
function _mod($a, $b) { return ((int) $a % (int) $b + (int) $b) % (int) $b; }

/** شماره روز ژولینی از تاریخ میلادی */
function _g2d(int $gy, int $gm, int $gd): int
{
    $d = _div(($gy + _div($gm - 8, 6) + 100100) * 1461, 4)
       + _div(153 * _mod($gm + 9, 12) + 2, 5) + $gd - 34840408;
    $d = $d - _div(_div($gy + 100100 + _div($gm - 8, 6), 100) * 3, 4) + 752;
    return $d;
}

/** تاریخ میلادی از شماره روز ژولینی */
function _d2g(int $jdn): array
{
    $j = 4 * $jdn + 139361631;
    $j = $j + _div(_div(4 * $jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
    $i = _div(_mod($j, 1461), 4) * 5 + 308;
    $gd = _div(_mod($i, 153), 5) + 1;
    $gm = _mod(_div($i, 153), 12) + 1;
    $gy = _div($j, 1461) - 100100 + _div(8 - $gm, 6);
    return [$gy, $gm, $gd];
}

/** محاسبه اطلاعات سال شمسی (سال کبیسه / روز شروع) */
function _jalCal(int $jy): array
{
    $breaks = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210,
               1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178];
    $bl = count($breaks);
    $gy = $jy + 621;
    $leapJ = -14;
    $jp = $breaks[0];
    $jump = 0;
    for ($i = 1; $i < $bl; $i++) {
        $jm = $breaks[$i];
        $jump = $jm - $jp;
        if ($jy < $jm) {
            break;
        }
        $leapJ += _div($jump, 33) * 8 + _div(_mod($jump, 33), 4);
        $jp = $jm;
    }
    $n = $jy - $jp;
    $leapJ += _div($n, 33) * 8 + _div(_mod($n, 33) + 3, 4);
    if (_mod($jump, 33) === 4 && $jump - $n === 4) {
        $leapJ += 1;
    }
    $leapG = _div($gy, 4) - _div((_div($gy, 100) + 1) * 3, 4) - 150;
    $march = 20 + $leapJ - $leapG;
    if ($jump - $n < 6) {
        $n = $n - $jump + _div($jump + 4, 33) * 33;
    }
    $leap = _mod(_mod($n + 1, 33) - 1, 4);
    if ($leap === -1) {
        $leap = 4;
    }
    return ['leap' => $leap, 'gy' => $gy, 'march' => $march];
}

function jalali_to_jdn(int $jy, int $jm, int $jd): int
{
    $r = _jalCal($jy);
    return _g2d($r['gy'], 3, $r['march']) + ($jm - 1) * 31 - _div($jm, 7) * ($jm - 7) + $jd - 1;
}

/** میلادی → شمسی  :  خروجی [jy, jm, jd] */
function gregorian_to_jalali(int $gy, int $gm, int $gd): array
{
    // گارد امنیتی: تاریخ‌های نامعتبر (مثلاً از ورودی خراب) خطا ندهند
    if ($gy < 1 || $gm < 1 || $gm > 12 || $gd < 1 || $gd > 31) {
        return [0, 0, 0];
    }
    $jdn = _g2d($gy, $gm, $gd);
    $gy2 = _d2g($jdn)[0];
    $jy  = $gy2 - 621;
    $r   = _jalCal($jy);
    $jdn1f = _g2d($gy2, 3, $r['march']);
    $k = $jdn - $jdn1f;
    if ($k >= 0) {
        if ($k <= 185) {
            return [$jy, 1 + _div($k, 31), _mod($k, 31) + 1];
        }
        $k -= 186;
    } else {
        $jy -= 1;
        $k += 179;
        if ($r['leap'] === 1) {
            $k += 1;
        }
    }
    return [$jy, 7 + _div($k, 30), _mod($k, 30) + 1];
}

/** شمسی → میلادی : خروجی [gy, gm, gd] */
function jalali_to_gregorian(int $jy, int $jm, int $jd): array
{
    return _d2g(jalali_to_jdn($jy, $jm, $jd));
}

/** تعداد روزهای ماه شمسی */
function jalali_month_days(int $jy, int $jm): int
{
    if ($jm <= 6) {
        return 31;
    }
    if ($jm <= 11) {
        return 30;
    }
    return _jalCal($jy)['leap'] === 0 ? 30 : 29;
}

/** نام ماه شمسی */
function jalali_month_name(int $m): string
{
    $names = [1 => 'حمل', 2 => 'ثور', 3 => 'جوزا', 4 => 'سرطان', 5 => 'اسد', 6 => 'سنبله',
              7 => 'میزان', 8 => 'عقرب', 9 => 'قوس', 10 => 'جدی', 11 => 'دلو', 12 => 'حوت'];
    return $names[$m] ?? (string) $m;
}

/** نام ماه میلادی */
function gregorian_month_name(int $m): string
{
    $names = [1 => 'جنوری', 2 => 'فبروری', 3 => 'مارچ', 4 => 'اپریل', 5 => 'می', 6 => 'جون',
              7 => 'جولای', 8 => 'اگست', 9 => 'سپتمبر', 10 => 'اکتوبر', 11 => 'نومبر', 12 => 'دسمبر'];
    return $names[$m] ?? (string) $m;
}

// ---------------------------------------------------------------------------
//  توابع کاری سیستم
// ---------------------------------------------------------------------------

/** تقویم فعال سیستم */
function cal_mode(): string
{
    return setting('calendar', 'shamsi') === 'miladi' ? 'miladi' : 'shamsi';
}

/** تاریخ امروز به میلادی (Y-m-d) */
function today_ymd(): string
{
    return date('Y-m-d');
}

/**
 * تبدیل یک تاریخ ذخیره‌شده در دیتابیس (Y-m-d میلادی) به اجزای تقویم فعال
 * خروجی: [y, m, d]
 */
function ymd_to_parts(?string $ymd): array
{
    if (!$ymd) {
        return [0, 0, 0];
    }
    $raw = substr(trim((string) $ymd), 0, 10);
    // «سال/ماه» تنها → روز اول ماه
    if (preg_match('/^[0-9]{4}[\/\-.][0-9]{1,2}$/', $raw)) {
        $raw .= '-01';
    }
    // فقط تاریخ درست به شکل Y-m-d یا Y/m/d پذیرفته می‌شود (تا هیچ‌وقت خطای مرگبار ندهد)
    if (!preg_match('/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/', $raw, $m)) {
        $ts = strtotime($raw);
        if ($ts === false) {
            return [0, 0, 0];
        }
        $gy = (int) date('Y', $ts); $gm = (int) date('n', $ts); $gd = (int) date('j', $ts);
    } else {
        [$gy, $gm, $gd] = [(int) $m[1], (int) $m[2], (int) $m[3]];
    }
    if ($gy < 1 || $gm < 1 || $gm > 12 || $gd < 1 || $gd > 31) {
        return [0, 0, 0];
    }
    if (cal_mode() === 'miladi') {
        return [$gy, $gm, $gd];
    }
    return gregorian_to_jalali($gy, $gm, $gd);
}

/**
 * تبدیل اجزای تقویم فعال به تاریخ میلادی ذخیره‌شونده
 * ورودی به شکل 1405/07/02 یا 2026-09-24  (ارقام دری هم پذیرفته می‌شود)
 */
function parts_to_ymd($y, $m, $d): ?string
{
    [$y, $m, $d] = [(int) $y, (int) $m, (int) $d];
    if ($y < 1 || $m < 1 || $m > 12 || $d < 1 || $d > 31) {
        return null;
    }
    if ($y < 100) {
        $y += $y > 50 ? 1300 : 1400; // میان‌بر: 05/07/02 → 1405/07/02
    }
    if (cal_mode() === 'miladi') {
        $a = [$y, $m, $d];
    } else {
        $a = jalali_to_gregorian($y, $m, $d);
    }
    return sprintf('%04d-%02d-%02d', $a[0], $a[1], $a[2]);
}

/** تبدیل متن تاریخ ورودی (شیت‌ها) به Y-m-d */
function parse_date_input(?string $value): ?string
{
    if ($value === null) {
        return null;
    }
    $v = normalize_digits(trim($value));
    $v = str_replace(['-', '.', '\\'], '/', $v);
    if ($v === '') {
        return null;
    }
    $parts = array_values(array_filter(explode('/', $v), fn($x) => $x !== ''));
    if (count($parts) === 3) {
        return parts_to_ymd($parts[0], $parts[1], $parts[2]);
    }
    if (preg_match('/^(\d{4})(\d{2})(\d{2})$/', $v, $m)) {
        return parts_to_ymd($m[1], $m[2], $m[3]);
    }
    return null;
}

/** نمایش تاریخ مطابق تقویم فعال — مثال: 1405/07/02 */
function fdate(?string $ymd, bool $withMonthName = false): string
{
    if (!$ymd) {
        return '';
    }
    $p = ymd_to_parts($ymd);
    if ($p[0] === 0) {
        return '';
    }
    if ($withMonthName) {
        $name = cal_mode() === 'miladi' ? gregorian_month_name($p[1]) : jalali_month_name($p[1]);
        return digit_style($p[2] . ' ' . $name . ' ' . $p[0]);
    }
    return digit_style(sprintf('%04d/%02d/%02d', $p[0], $p[1], $p[2]));
}

/** تاریخ شمسی امروز به شکل متن، مطابق تقویم فعال */
function today_display(): string
{
    return fdate(today_ymd());
}

/** نمایش «ماه/سال» مطابق تقویم فعال */
function fmonth(?int $y, ?int $m): string
{
    if (!$y || !$m) {
        return '';
    }
    $name = cal_mode() === 'miladi' ? gregorian_month_name($m) : jalali_month_name($m);
    return digit_style($y . ' / ' . $m . ' - ' . $name);
}

/**
 * تبدیل «سال و ماه» تقویم فعال به بازه تاریخ میلادی [start, end]
 * برای راپورهای ماهانه و سالانه
 */
function period_range(int $y, int $m): array
{
    if (cal_mode() === 'miladi') {
        $start = sprintf('%04d-%02d-01', $y, $m);
        $end   = date('Y-m-t', strtotime($start));
        return [$start, $end];
    }
    $startG = jalali_to_gregorian($y, $m, 1);
    $lastDay = jalali_month_days($y, $m);
    $endG = jalali_to_gregorian($y, $m, $lastDay);
    return [sprintf('%04d-%02d-%02d', ...$startG), sprintf('%04d-%02d-%02d', ...$endG)];
}

/** بازه سال مالی (سال y تقویم فعال) → [start, end] میلادی */
function fiscal_range(int $y): array
{
    $sm = (int) setting('fiscal_start_month', 1);
    $sd = (int) setting('fiscal_start_day', 1);
    if (cal_mode() === 'miladi') {
        $a = sprintf('%04d-%02d-%02d', $y, $sm, $sd);
        $b = date('Y-m-d', strtotime($a . ' +1 year -1 day'));
        return [$a, $b];
    }
    $a = jalali_to_gregorian($y, $sm, $sd);
    $b = date('Y-m-d', strtotime(sprintf('%04d-%02d-%02d', ...$a) . ' +1 year -1 day'));
    return [sprintf('%04d-%02d-%02d', ...$a), $b];
}

/** سال تقویم فعال برای یک تاریخ میلادی */
function cal_year(?string $ymd = null): int
{
    $p = ymd_to_parts($ymd ?: today_ymd());
    return (int) $p[0];
}

/** ماه تقویم فعال برای یک تاریخ میلادی */
function cal_month(?string $ymd = null): int
{
    $p = ymd_to_parts($ymd ?: today_ymd());
    return (int) $p[1];
}

/** روز هفته فارسی */
function weekday_name(?string $ymd = null): string
{
    $days = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'];
    $w = (int) date('w', strtotime($ymd ?: today_ymd()));
    return $days[$w];
}

/** لیست ماه‌های تقویم فعال */
function month_list(): array
{
    $out = [];
    for ($m = 1; $m <= 12; $m++) {
        $name = cal_mode() === 'miladi' ? gregorian_month_name($m) : jalali_month_name($m);
        $out[$m] = $m . ' - ' . $name;
    }
    return $out;
}

/** برچسب ماه کوتاه */
function month_label(int $m): string
{
    return cal_mode() === 'miladi' ? gregorian_month_name($m) : jalali_month_name($m);
}
