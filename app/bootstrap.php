<?php
/**
 * توابع عمومی و راه‌اندازی سیستم — فردای روشن
 */

define('FR_ROOT', dirname(__DIR__));

/** زمان شروع درخواست — برای سنجش سرعت در صفحه بررسی سلامت */
if (!defined('FR_START')) {
    define('FR_START', microtime(true));
}

/** پیکربندی */
function app_config(?string $key = null, $default = null)
{
    static $cfg = null;
    if ($cfg === null) {
        $cfg = require FR_ROOT . '/config.php';
    }
    if ($key === null) {
        return $cfg;
    }
    return $cfg[$key] ?? $default;
}

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/date.php';
require_once __DIR__ . '/util.php';
require_once __DIR__ . '/installer.php';
require_once __DIR__ . '/settings.php';
require_once __DIR__ . '/theme.php';
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/layout.php';
require_once __DIR__ . '/crud.php';
require_once __DIR__ . '/reports.php';

/** راه‌اندازی: منطقه زمانی، سشن */
function app_boot(): void
{
    date_default_timezone_set(app_config('timezone', 'Asia/Kabul'));
    if (session_status() !== PHP_SESSION_ACTIVE) {
        session_name(app_config('session_name', 'FR_SYSTEM'));
        session_start();
    }
    // دیتابیس آماده است؟
    if (PHP_SAPI !== 'cli' && !defined('FR_SKIP_DB_CHECK')) {
        $script = basename($_SERVER['SCRIPT_NAME'] ?? '');
        if ($script !== 'install.php') {
            try {
                Db::pdo()->query('SELECT 1 FROM `settings` LIMIT 1')->fetchColumn();
            } catch (Throwable $e) {
                header('Location: install.php');
                exit;
            }
            fr_schema_upgrade();
        }
    }
}

/**
 * بروزرسانی خودکار ساختار دیتابیس برای نصب‌های قدیمی
 * (مثلاً وقتی ستون‌های تازه‌ای مثل theme_mode یا font_family اضافه می‌شود)
 * حداکثر هر ۶۰ ثانیه یک بار بررسی می‌شود (یک کوئری سبک ~۱ میلی‌ثانیه)؛
 * اگر خطایی هم پیش بیاید، لایه Db خطا را می‌گیرد و همان لحظه ترمیم می‌کند.
 */
function fr_schema_upgrade(): void
{
    $ver = fr_schema_version();
    $cache = $_SESSION['fr_schema_v'] ?? null;
    $last = (int) ($_SESSION['fr_schema_at'] ?? 0);
    // اگر ساختار قبلاً بررسی شده و از آخرین بررسی کمتر از ۶۰ ثانیه گذشته، دوباره بررسی نمی‌شود
    if ((int) $cache === $ver && (time() - $last) < 60) {
        return;
    }
    $_SESSION['fr_schema_at'] = time();
    try {
        $pdo = Db::pdo();
        if (fr_schema_ok($pdo)) {
            $_SESSION['fr_schema_v'] = $ver;
            return;
        }
        $res = fr_ensure_schema($pdo);
        $_SESSION['fr_schema_v'] = $ver;
        if (!empty($res['applied'])) {
            $_SESSION['fr_schema_msg'] = 'ساختار دیتابیس بروزرسانی شد (' . (int) $res['applied'] . ' تغییر) — حالا همه بخش‌ها درست کار می‌کند.';
        }
    } catch (Throwable $e) {
        // بی‌صدا رد می‌شود تا صفحه سفید نشود؛ در doctor.php دیده می‌شود
    }
}

/** پیام موفقیت بروزرسانی ساختار (یک بار نشان داده می‌شود) */
function take_schema_msg(): string
{
    $m = (string) ($_SESSION['fr_schema_msg'] ?? '');
    if ($m !== '') {
        unset($_SESSION['fr_schema_msg']);
    }
    return $m;
}
