<?php
/**
 * بررسی سلامت سیستم (Doctor) — سیستم مدیریت فردای روشن
 * ---------------------------------------------------------------------------
 * این صفحه به شما می‌گوید چرا سیستم بالا نمی‌آید یا «Forward Port» کار نمی‌کند.
 *   در مرورگر:  http://localhost:8080/doctor.php
 *   در ترمینال: php doctor.php
 * توجه: این فایل معلومات حساس (رمز دیتابیس) را نمایش نمی‌دهد.
 */
define('FR_SKIP_DB_CHECK', true);
define('FR_ALLOW_DB_FAILURE', true);
require_once __DIR__ . '/app/bootstrap.php';
app_boot();   // منطقه زمانی + سشن (تا وضعیت ورود مدیر معلوم شود)

$isCli  = (PHP_SAPI === 'cli');
$checks = [];

function add_check(array &$checks, string $title, bool $ok, string $details, string $fix = '', string $warn = ''): void
{
    $checks[] = ['title' => $title, 'ok' => $ok, 'details' => $details, 'fix' => $fix, 'warn' => $warn];
}

// ---------- ۱) نسخه PHP ----------
$phpOk = version_compare(PHP_VERSION, '7.4.0', '>=');
add_check($checks, 'نسخه PHP', $phpOk, 'PHP ' . PHP_VERSION . ' (' . PHP_SAPI . ')',
    'PHP نسخه ۷.۴ یا بالاتر لازم است. از XAMPP/Laragon نسخه جدید استفاده کنید.');

// ---------- ۲) افزونه‌های لازم ----------
$exts = ['pdo' => 'اتصال دیتابیس', 'pdo_mysql' => 'اتصال MySQL', 'mbstring' => 'متن دری/فارسی',
         'json' => 'ذخیره تنظیمات', 'session' => 'ورود کاربران'];
$missing = [];
foreach ($exts as $ext => $why) {
    if (!extension_loaded($ext)) {
        $missing[] = $ext . ' (' . $why . ')';
    }
}
add_check($checks, 'افزونه‌های PHP', !$missing, $missing ? 'موجود نیست: ' . implode('، ', $missing) : 'همه افزونه‌های لازم موجود است',
    'در فایل php.ini خط مربوط به extension=' . ($missing ? explode(' ', $missing[0])[0] : 'pdo_mysql') . ' را از حالت تعلیق خارج کنید و وب‌سرور را دوباره استارت کنید.');

// ---------- ۳) فایل‌های پروژه ----------
$files = [
    'database/schema.sql' => 'ساختار جداول',
    'database/seed.sql'   => 'معلومات اولیه',
    'app/bootstrap.php'   => 'موتور سیستم',
    'app/installer.php'   => 'هسته نصب',
    'install.php'         => 'نصب از مرورگر',
    'install_cli.php'     => 'نصب از خط فرمان',
    'assets/style.css'    => 'استایل',
];
$missingFiles = [];
foreach ($files as $f => $label) {
    if (!is_file(FR_ROOT . '/' . $f)) {
        $missingFiles[] = $f;
    }
}
add_check($checks, 'فایل‌های پروژه', !$missingFiles,
    $missingFiles ? 'کم است: ' . implode('، ', $missingFiles) : 'همه فایل‌های اصلی موجود است',
    'پروژه را کامل کاپی/کلون کنید (git clone).');

// ---------- ۴) پوشه‌های قابل نوشتن ----------
$backupDir = FR_ROOT . '/backups';
if (!is_dir($backupDir)) {
    @mkdir($backupDir, 0775, true);
}
$writable = [
    'پوشه backups' => is_writable($backupDir),
    'پوشه اصلی پروژه (برای config.local.php)' => is_writable(FR_ROOT),
];
$notWritable = [];
foreach ($writable as $k => $v) {
    if (!$v) {
        $notWritable[] = $k;
    }
}
add_check($checks, 'دسترسی نوشتن', !$notWritable,
    $notWritable ? 'قابل نوشتن نیست: ' . implode('، ', $notWritable) : 'پوشه‌ها قابل نوشتن هستند',
    'در لینوکس: chmod -R 775 backups و مالکیت پوشه را به کاربر وب‌سرور بدهید (مثلاً www-data).');

// ---------- ۵) تنظیمات و اتصال دیتابیس ----------
$cfg = app_config();
$cfgInfo = sprintf('سرور: %s:%s — دیتابیس: %s — کاربر: %s — رمز: %s',
    $cfg['db_host'], $cfg['db_port'], $cfg['db_name'], $cfg['db_user'],
    ($cfg['db_pass'] === '' ? '(خالی)' : '(تعیین‌شده)'));
$dbOk = false; $dbMsg = '';
try {
    $pdo = Db::pdo();
    $dbOk = true;
    $dbMsg = 'اتصال به دیتابیس برقرار است — ' . (string) $pdo->query('SELECT VERSION()')->fetchColumn();
} catch (Throwable $e) {
    $dbMsg = 'اتصال برقرار نشد: ' . $e->getMessage();
}
add_check($checks, 'اتصال دیتابیس', $dbOk, $cfgInfo . ' — ' . $dbMsg,
    '۱) MySQL/MariaDB را استارت کنید (در XAMPP دکمه Start).' . "\n"
  . '۲) اگر دیتابیس ساخته نشده، یک بار install.php را در مرورگر باز کنید.' . "\n"
  . '۳) اگر داخل داکر/Codespaces هستید، آدرس سرور دیتابیس معمولاً 127.0.0.1 نیست بلکه نام سرویس مثل db است — آن را در config.local.php بنویسید.' . "\n"
  . '۴) اگر رمز کاربر root را گذاشته‌اید، باید در config.local.php وارد شود.');

// ---------- ۶) جداول و معلومات اولیه ----------
$tablesOk = false; $tablesMsg = ''; $counts = [];
if ($dbOk) {
    try {
        $tables = ['settings', 'company', 'employees', 'sales', 'expenses', 'receipts', 'salaries', 'attendance', 'customers', 'users'];
        $missing = [];
        foreach ($tables as $t) {
            if (!Db::tableExists($t)) {
                $missing[] = $t;
            }
        }
        if ($missing) {
            $tablesMsg = 'جدول‌های کم: ' . implode('، ', $missing);
        } else {
            $tablesOk = true;
            foreach (['employees', 'customers', 'sales', 'expenses', 'receipts', 'salaries'] as $t) {
                $counts[] = $t . ': ' . (int) Db::val("SELECT COUNT(*) FROM `$t`", [], 0);
            }
            $tablesMsg = 'همه جدول‌ها موجود است — ' . implode(' | ', $counts);
        }
    } catch (Throwable $e) {
        $tablesMsg = $e->getMessage();
    }
} else {
    $tablesMsg = 'به دلیل عدم اتصال دیتابیس بررسی نشد.';
}
add_check($checks, 'جداول دیتابیس', $tablesOk, $tablesMsg,
    'صفحه install.php را باز کنید و «شروع نصب» را بزنید (جداول و معلومات اولیه ساخته می‌شود).');

// ---------- ۶-ب) ساختار دیتابیس (جدول‌ها و ستون‌های تازه) ----------
$schemaOk = false; $schemaMsg = ''; $schemaFixed = 0;
if ($dbOk && Db::tableExists('settings')) {
    try {
        $missing = fr_schema_missing();
        if (!$missing) {
            $schemaOk = true;
            $schemaMsg = 'ساختار کامل است — نسخه ساختار: ' . fmt(fr_schema_version());
        } else {
            // خودکار درست می‌شود (همان کاری که هنگام باز کردن صفحه‌ها انجام می‌شود)
            $res = fr_ensure_schema();
            $schemaFixed = (int) $res['applied'];
            $left = fr_schema_missing();
            $schemaOk = !$left;
            $schemaMsg = $schemaOk
                ? 'کم بود: ' . implode('، ', array_slice($missing, 0, 6)) . (count($missing) > 6 ? ' …' : '')
                  . ' — حالا اصلاح شد (' . fmt($schemaFixed) . ' تغییر)'
                : 'باقی‌مانده: ' . implode('، ', array_slice($left, 0, 6));
        }
    } catch (Throwable $e) {
        $schemaMsg = $e->getMessage();
    }
} else {
    $schemaMsg = 'به دلیل عدم اتصال دیتابیس بررسی نشد.';
}
add_check($checks, 'ساختار دیتابیس (جدول‌ها و ستون‌های تازه)', $schemaOk, $schemaMsg,
    'هر صفحه سیستم را باز کنید تا خودکار اصلاح شود (همین صفحه داکتر هم خودکار اصلاح می‌کند) — یا install.php را باز کنید و نصب را دوباره اجرا نمایید.');

// ---------- ۷) سشن (ورود) ----------
$sessOk = false; $sessMsg = '';
try {
    if (PHP_SAPI !== 'cli') {
        if (session_status() !== PHP_SESSION_ACTIVE) {
            session_start();
        }
        $_SESSION['fr_doctor'] = 'ok';
        $sessOk = ($_SESSION['fr_doctor'] === 'ok');
        $sessMsg = 'سشن کار می‌کند (session.save_path: ' . ini_get('session.save_path') . ')';
    } else {
        $sessOk = true;
        $sessMsg = 'در حالت خط فرمان بررسی نمی‌شود.';
    }
} catch (Throwable $e) {
    $sessMsg = $e->getMessage();
}
add_check($checks, 'سشن و ورود کاربران', $sessOk, $sessMsg,
    'پوشه ذخیره سشن‌ها قابل نوشتن نیست. در php.ini مقدار session.save_path را درست کنید.');

// ---------- ۸) وضعیت وب‌سرور و پورت ----------
$host = $_SERVER['HTTP_HOST'] ?? 'نامعلوم';
// پورت واقعی: اول از HTTP_HOST (مثلاً host:8080) و بعد از SERVER_PORT
$port = 'نامعلوم';
if (preg_match('/:(\d+)$/', (string) $host, $m)) {
    $port = $m[1];
} elseif (!empty($_SERVER['SERVER_PORT'])) {
    $port = $_SERVER['SERVER_PORT'];
} elseif (($_SERVER['HTTPS'] ?? '') === 'on') {
    $port = '443';
} else {
    $port = '80';
}
$serverSoft = $_SERVER['SERVER_SOFTWARE'] ?? (PHP_SAPI === 'cli-server' ? 'PHP built-in server' : PHP_SAPI);
$isLocalhost = (bool) preg_match('/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/', (string) $host);
add_check($checks, 'وب‌سرور و پورت', true,
    'سرور: ' . $serverSoft . ' — آدرس: ' . $host . ' — پورت: ' . $port . ' — فایل اجراشده: ' . basename(__FILE__),
    '',
    ($isLocalhost ? '' : 'در حال بازدید از یک آدرس فوروارد‌شده/شبکه هستید. اگر صفحه باز نمی‌شود، مطمئن شوید سرور روی 0.0.0.0 اجرا شده است (php -S 0.0.0.0:8080).' . "\n")
    . 'آدرس فعلی برای باز کردن در مرورگر: ' . (($_SERVER['HTTPS'] ?? '') === 'on' ? 'https' : 'http') . '://' . $host . '/');

// ---------- ۹) بررسی زمان سرور ----------
$tz = date_default_timezone_get();
add_check($checks, 'منطقه زمانی', true, $tz . ' — تاریخ سیستم: ' . date('Y-m-d H:i'),
    'اگر تاریخ اشتباه است، در فایل config.php مقدار timezone را تنظیم کنید.');

// ---------- ۱۰) کارکرد آفلاین (بدون انترنت) و دسترسی از دستگاه‌های دیگر ----------
/** آدرس‌های شبکه محلی این کمپیوتر (برای باز کردن سیستم از موبایل/تبلت) */
function fr_local_ips(): array
{
    $ips = [];
    $host = @gethostname();
    if ($host) {
        $list = @gethostbynamel($host);
        if (is_array($list)) {
            $ips = array_merge($ips, $list);
        }
    }
    if (!empty($_SERVER['SERVER_ADDR'])) {
        $ips[] = (string) $_SERVER['SERVER_ADDR'];
    }
    $out = [];
    foreach ($ips as $ip) {
        if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4) && strpos($ip, '127.') !== 0 && $ip !== '0.0.0.0') {
            $out[$ip] = true;
        }
    }
    return array_keys($out);
}

// ۱) هیچ منبع بیرونی (CDN / فونت آنلاین) در کد نباشد
$extRefs = [];
foreach (['assets/style.css', 'assets/app.js'] as $rel) {
    $file = FR_ROOT . '/' . $rel;
    if (!is_file($file)) {
        continue;
    }
    $body = (string) @file_get_contents($file);
    if (preg_match_all('#(?:https?:)?//([a-z0-9.-]+\.[a-z]{2,})#i', $body, $m)) {
        foreach ($m[1] as $domain) {
            if (!in_array($domain, ['w3.org', 'localhost'], true)) {
                $extRefs[$rel . ' → ' . $domain] = true;
            }
        }
    }
}
// ۱-ب) منابع بیرونی در فایل‌های PHP (مثلاً <script src="https://...">)
foreach ((array) glob(FR_ROOT . '/*.php') as $file) {
    $body = (string) @file_get_contents($file);
    if (preg_match_all('#(?:src|href)\s*=\s*["\']https?://([a-z0-9.-]+\.[a-z]{2,})#i', $body, $m)) {
        foreach ($m[1] as $domain) {
            if (!in_array($domain, ['localhost', '127.0.0.1'], true)) {
                $extRefs[basename($file) . ' → ' . $domain] = true;
            }
        }
    }
}

// ۲) فونت‌های محلی
$fontCount = 0;
$fontBytes = 0;
foreach ((array) glob(FR_ROOT . '/assets/fonts/*.woff2') as $f) {
    $fontCount++;
    $fontBytes += (int) @filesize($f);
}
$offlineOk = ($extRefs === [] && $fontCount >= 4);
$offlineMsg = $extRefs === []
    ? 'هیچ درخواست بیرونی (CDN یا فونت آنلاین) وجود ندارد — ' . fmt($fontCount) . ' فایل فونت داخل خود سیستم'
      . ($fontBytes ? ' (' . fmt(round($fontBytes / 1024)) . ' کیلوبایت)' : '')
    : 'این منابع بیرونی پیدا شد (باید محلی شود): ' . implode('، ', array_keys($extRefs));
// ۳) آدرس دسترسی از موبایل/تبلت در همان وای‌فای
$scheme = (($_SERVER['HTTPS'] ?? '') === 'on') ? 'https' : 'http';
$hostNow = (string) ($_SERVER['HTTP_HOST'] ?? 'localhost');
$basePath = str_replace('\\', '/', dirname((string) ($_SERVER['SCRIPT_NAME'] ?? '/doctor.php')));
$basePath = ($basePath === '/' || $basePath === '.' || $basePath === '\\') ? '' : rtrim($basePath, '/');
$lanIps = fr_local_ips();
$lanLines = [];
foreach (array_slice($lanIps, 0, 3) as $ip) {
    $lanLines[] = $scheme . '://' . $ip . ($port && $port !== '80' && $port !== '443' ? ':' . $port : '') . $basePath . '/';
}
if ($lanLines) {
    $offlineMsg .= ' — برای موبایل/تبلت در همان وای‌فای: ' . implode(' یا ', $lanLines);
} else {
    $offlineMsg .= ' — از موبایل: آدرس شبکه همین کمپیوتر را بزنید، مثلاً ' . $scheme . '://192.168.x.x' . $basePath . '/';
}
add_check($checks, 'کارکرد آفلاین (بدون انترنت) و دستگاه‌های دیگر', $offlineOk, $offlineMsg,
    'اگر آدرس موبایل باز نشد: ۱) موبایل و کمپیوتر روی یک وای‌فای باشند، ۲) فایروال ویندوز برای Apache اجازه بدهد، '
  . '۳) سرور روی 0.0.0.0 اجرا شده باشد (مثلاً php -S 0.0.0.0:8080).');

// ---------- ۱۱) کارایی و سرعت ----------
$opcache = function_exists('opcache_get_status') ? @opcache_get_status(false) : null;
$opcacheOn = is_array($opcache) && !empty($opcache['opcache_enabled']);
$tookMs = (int) round((microtime(true) - FR_START) * 1000);
$queries = Db::queryCount();
$perf = 'زمان این صفحه: ' . fmt($tookMs) . ' میلی‌ثانیه | کوئری‌ها: ' . fmt($queries);
if ($opcacheOn) {
    $perf .= ' | OPcache: روشن ✔';
} else {
    $perf .= ' | OPcache: خاموش (برای سرعت بیشتر در XAMPP، در php.ini این را روشن کنید: opcache.enable=1)';
}
$perfOk = $tookMs < 1500 && $queries < 200;
add_check($checks, 'کارایی و سرعت', $perfOk, $perf,
    'اگر سیستم کند بود، مغازه‌های سنگین را با «پشتیبان‌گیری» سبک کنید و کش مرورگر (فایل .htaccess) را فعال نگه دارید.');

$failCount = count(array_filter($checks, fn($c) => !$c['ok']));

/**
 * محدودیت نمایش: اگر سیستم نصب شده و کاربر وارد نشده است، جزئیات فنی
 * (آدرس/کاربر دیتابیس، تعداد رکوردها) نشان داده نمی‌شود.
 */
$restricted = $dbOk && !$isCli && !is_logged_in();
if ($restricted) {
    $publicTitles = ['نسخه PHP', 'افزونه‌های PHP', 'فایل‌های پروژه', 'دسترسی نوشتن', 'منطقه زمانی',
        'کارکرد آفلاین (بدون انترنت) و دستگاه‌های دیگر'];
    foreach ($checks as &$c) {
        if (!in_array($c['title'], $publicTitles, true)) {
            $c['details'] = 'برای دیدن جزئیات این بخش، وارد سیستم شوید.';
            $c['fix'] = '';
            $c['warn'] = '';
        }
    }
    unset($c);
}

// ===========================================================================
//  خروجی
// ===========================================================================
if ($isCli) {
    echo "\n=== بررسی سلامت سیستم فردای روشن ===\n\n";
    foreach ($checks as $c) {
        echo ($c['ok'] ? '[ OK ] ' : '[ !! ] ') . $c['title'] . "\n";
        echo '        ' . str_replace("\n", "\n        ", $c['details']) . "\n";
        if (!$c['ok'] && $c['fix']) {
            echo "        راه حل: " . str_replace("\n", "\n                ", $c['fix']) . "\n";
        }
        echo "\n";
    }
    echo $failCount === 0 ? "نتیجه: همه چیز درست است.\n" : "نتیجه: $failCount مورد نیاز به اصلاح دارد.\n";
    exit($failCount === 0 ? 0 : 1);
}
?><!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>بررسی سلامت سیستم — فردای روشن</title>
<link rel="stylesheet" href="assets/style.css">
<style>
  .doc-row{display:flex; gap:10px; align-items:flex-start; padding:10px; border-bottom:1px solid var(--line)}
  .doc-row:last-child{border-bottom:0}
  .doc-mark{font-weight:700; min-width:76px; display:flex; gap:4px; align-items:center; white-space:nowrap}
  .doc-mark svg{flex:0 0 auto}
  .ok .doc-mark{color:#166534}
  .bad .doc-mark{color:#b91c1c}
  .doc-body{flex:1; min-width:0}
  .doc-title{font-weight:700; margin-bottom:2px}
  .doc-detail{color:var(--muted); font-size:12.5px; word-break:break-word; white-space:pre-wrap}
  .doc-fix{background:var(--amber-l); border:1px solid #fde68a; padding:8px 10px; border-radius:8px; margin-top:6px; font-size:12.5px; white-space:pre-wrap}
  .doc-warn{background:var(--blue-l); border:1px solid #c7d2fe; padding:8px 10px; border-radius:8px; margin-top:6px; font-size:12.5px}
  code{background:#f1f5f9; padding:1px 5px; border-radius:5px; direction:ltr; display:inline-block}
</style>
</head>
<body>
<div style="max-width:900px;margin:20px auto;padding:0 14px">
  <div class="card">
    <h1><?= icon('info', 22) ?> بررسی سلامت سیستم — فردای روشن</h1>
    <p class="muted">این صفحه نشان می‌دهد که چرا سیستم بالا نمی‌آید یا پورت/آدرس باز نمی‌شود. تاریخ بررسی: <?= date('Y-m-d H:i') ?></p>
    <div class="alert alert-<?= $failCount === 0 ? 'success' : 'error' ?>">
      <?= $failCount === 0
          ? 'همه چیز درست است — حالا می‌توانید وارد سیستم شوید.'
          : 'تعداد مواردی که باید اصلاح شود: ' . $failCount . ' (پایین را ببینید)' ?>
    </div>
    <?php if ($restricted): ?>
      <div class="alert alert-info">سیستم نصب شده است؛ برخی جزئیات فنی فقط برای کاربر وارد‌شده نمایش داده می‌شود.
        <a href="login.php?next=doctor.php">ورود به سیستم</a></div>
    <?php endif; ?>
    <?php foreach ($checks as $c): ?>
      <div class="doc-row <?= $c['ok'] ? 'ok' : 'bad' ?>">
        <div class="doc-mark"><?= $c['ok'] ? icon('check', 15) . ' درست' : icon('warn', 15) . ' مشکل' ?></div>
        <div class="doc-body">
          <div class="doc-title"><?= e($c['title']) ?></div>
          <div class="doc-detail"><?= e($c['details']) ?></div>
          <?php if (!$c['ok'] && $c['fix']): ?>
            <div class="doc-fix"><b>راه حل:</b><br><?= e($c['fix']) ?></div>
          <?php endif; ?>
          <?php if ($c['warn']): ?>
            <div class="doc-warn"><?= e($c['warn']) ?></div>
          <?php endif; ?>
        </div>
      </div>
    <?php endforeach; ?>
    <div class="form-actions" style="margin-top:14px">
      <a class="btn btn-primary" href="install.php">رفتن به صفحه نصب</a>
      <a class="btn" href="login.php">ورود به سیستم</a>
      <a class="btn btn-outline" href="doctor.php">بررسی دوباره</a>
    </div>
  </div>

  <div class="card">
    <h2>۷ یادداشت مهم برای «Forward Port» در VS Code</h2>
    <ol>
      <li>اگر پروژه روی <b>همان کمپیوتر</b> شما اجرا می‌شود، فوروارد پورت لازم نیست — کافی است
        <code>http://localhost:8080</code> را در مرورگر باز کنید.</li>
      <li>اگر کد در محیط دور (Codespaces / SSH / Dev Container / WSL) اجرا می‌شود، سرور را با
        <code>php -S 0.0.0.0:8080 -t .</code> راه بیندازید (نه <code>localhost:8080</code>)،
        بعد از تب <b>PORTS</b> گزینه <b>Forward a Port</b> را بزنید و پورت ۸۰۸۰ را باز کنید.</li>
      <li>روی «آیکن کره 🌐» (Open in Browser) کنار همان پورت کلیک کنید.</li>
      <li>برای دیتابیس، <b>هرگز پورت ۳۳۰۶ را فوروارد نکنید</b> (خطر امنیتی دارد).</li>
      <li>اگر پورت ۸۰۸۰ مصروف باشد، پورت دیگری بگیرید: <code>php -S 0.0.0.0:8090 -t .</code>
        و همان ۸۰۹۰ را فوروارد کنید.</li>
      <li>معلومات نمونه را برای استفاده واقعی پاک کنید و رمز <code>admin</code> را تغییر دهید.</li>
      <li>ردیف‌های قرمز بالا را یکی یکی اصلاح کنید؛ بعد از هر اصلاح، این صفحه را دوباره باز کنید.</li>
    </ol>
    <p class="muted">راهنمای کامل فارسی در فایل <code>docs/VSCODE-PORT-FORWARD.md</code> موجود است.</p>
  </div>
</div>
</body>
</html>
