<?php
/**
 * تنظیمات ظاهر سیستم — پالت رنگ، حالت تیره، فشردگی، اندازه خط و گوشه‌ها
 * خروجی: چند متغیر CSS کوچک (بدون فایل اضافی و بدون درخواست شبکه‌ای — سریع)
 */

/** پالت‌های آماده رنگ اصلی: کلید => [نام فارسی، رنگ حالت روشن، رنگ حالت تیره] */
function accent_palettes(): array
{
    return [
        'teal'    => ['فیروزه‌ای', '#0f766e', '#14b8a6'],
        'emerald' => ['زمردی',     '#047857', '#34d399'],
        'blue'    => ['آبی',       '#1d4ed8', '#60a5fa'],
        'indigo'  => ['نیلی',      '#4338ca', '#818cf8'],
        'violet'  => ['بنفش',      '#7c3aed', '#a78bfa'],
        'amber'   => ['کهربایی',   '#b45309', '#fbbf24'],
        'rose'    => ['سرخابی',    '#be123c', '#fb7185'],
        'slate'   => ['خاکستری',   '#334155', '#94a3b8'],
    ];
}

/** مقادیر پیش‌فرض ظاهر (اگر ستون‌ها موجود نباشند) */
function appearance_defaults(): array
{
    return [
        'theme_mode'    => 'auto',
        'accent'        => 'teal',
        'density'       => 'comfortable',
        'font_size'     => 'normal',
        'corner_style'  => 'soft',
        'table_stripes' => 1,
        'font_family'   => 'poppins',
    ];
}

/** مقدار فعلی یک تنظیم ظاهر (با اعتبارسنجی) */
function appearance(string $key): string
{
    static $cache = null;
    if ($cache === null) {
        $row = function_exists('settings_row') ? settings_row() : [];
        $cache = array_merge(appearance_defaults(), array_intersect_key($row, appearance_defaults()));
    }
    $v = $cache[$key] ?? appearance_defaults()[$key];
    switch ($key) {
        case 'theme_mode':
            return in_array($v, ['light', 'dark', 'auto'], true) ? $v : 'auto';
        case 'accent':
            return array_key_exists($v, accent_palettes()) ? $v : 'teal';
        case 'density':
            return $v === 'compact' ? 'compact' : 'comfortable';
        case 'font_size':
            return in_array($v, ['small', 'normal', 'large'], true) ? $v : 'normal';
        case 'corner_style':
            return in_array($v, ['soft', 'medium', 'sharp'], true) ? $v : 'soft';
        case 'table_stripes':
            return ((int) $v) === 1 ? '1' : '0';
        case 'font_family':
            return in_array($v, ['poppins', 'vazirmatn', 'system'], true) ? $v : 'poppins';
    }
    return (string) $v;
}

/** تبدیل #rrggbb به «r,g,b» */
function hex_to_rgb(string $hex): array
{
    $hex = ltrim($hex, '#');
    if (strlen($hex) === 3) {
        $hex = $hex[0] . $hex[0] . $hex[1] . $hex[1] . $hex[2] . $hex[2];
    }
    return [hexdec(substr($hex, 0, 2)), hexdec(substr($hex, 2, 2)), hexdec(substr($hex, 4, 2))];
}

/** تیره‌تر کردن رنگ (برای حالت hover) */
function shade_hex(string $hex, float $factor = 0.82): string
{
    [$r, $g, $b] = hex_to_rgb($hex);
    $f = function ($c) use ($factor) {
        return max(0, min(255, (int) round($c * $factor)));
    };
    return sprintf('#%02x%02x%02x', $f($r), $f($g), $f($b));
}

/** CSS متغیرهای ظاهر — در <head> به صورت inline قرار می‌گیرد (بدون درخواست اضافی) */
function theme_css(): string
{
    $key   = appearance('accent');
    $all   = accent_palettes();
    [$name, $baseLight, $baseDark] = $all[$key];

    [$r1, $g1, $b1] = hex_to_rgb($baseLight);
    [$r2, $g2, $b2] = hex_to_rgb($baseDark);

    $css  = ':root{';
    $css .= '--accent:' . $baseLight . ';';
    $css .= '--accent-d:' . shade_hex($baseLight, 0.82) . ';';
    $css .= '--accent-l:rgba(' . $r1 . ',' . $g1 . ',' . $b1 . ',.09);';
    $css .= '--accent-l2:rgba(' . $r1 . ',' . $g1 . ',' . $b1 . ',.22);';
    $css .= '--on-accent:#ffffff;';
    $css .= '}';
    $css .= '[data-theme="dark"]{--accent:' . $baseDark . ';--accent-d:' . shade_hex($baseDark, 0.88) . ';';
    $css .= '--accent-l:rgba(' . $r2 . ',' . $g2 . ',' . $b2 . ',.15);';
    $css .= '--accent-l2:rgba(' . $r2 . ',' . $g2 . ',' . $b2 . ',.30);--on-accent:#08201d}';
    $css .= '@media (prefers-color-scheme:dark){[data-theme="auto"]{--accent:' . $baseDark . ';--accent-d:' . shade_hex($baseDark, 0.88) . ';';
    $css .= '--accent-l:rgba(' . $r2 . ',' . $g2 . ',' . $b2 . ',.15);--accent-l2:rgba(' . $r2 . ',' . $g2 . ',' . $b2 . ',.30);--on-accent:#08201d}}';
    return $css;
}

/** رنگ اصلی (برای متا theme-color و پیش‌نمایش) */
function theme_color(): string
{
    $all = accent_palettes();
    return $all[appearance('accent')][1];
}

/** اسکریپت بسیار کوچک: اعمال انتخاب کاربر از حافظه مرورگر پیش از رسم صفحه (بدون پرش رنگ) */
function theme_boot_js(): string
{
    return 'try{var t=localStorage.getItem("fr_theme");if(t==="light"||t==="dark"){document.documentElement.setAttribute("data-theme",t)}}catch(e){}';
}

/** گزینه‌های فونت سیستم: کلید => [نام نمایشی، توضیح] */
function font_options(): array
{
    return [
        'poppins'   => ['Poppins + Vazirmatn (پیش‌فرض)', 'Fونت مدرن: ارقام و متن لاتین با Poppins، متن فارسی با Vazirmatn'],
        'vazirmatn' => ['فقط Vazirmatn', 'فقط فونت فارسی — متن لاتین هم با همان فونت نمایش داده می‌شود'],
        'system'    => ['فونت سیستم (سبک‌ترین)', 'از فونت نصب‌شده روی کمپیوتر/موبایل استفاده می‌شود — هیچ فایلی دانلود نمی‌شود'],
    ];
}
