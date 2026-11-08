<?php
/**
 * قالب صفحات (سرصفحه، منو، فوتر)
 */

function nav_items(): array
{
    return [
        ['index.php',      'داشبورد',            'home'],
        ['sales.php',      'فروشات',             'sales'],
        ['receipts.php',   'رسیدات',             'money'],
        ['expenses.php',   'مصارف',              'expense'],
        ['salaries.php',   'معاشات',             'salary'],
        ['customers.php',  'مشتریان',            'client'],
        ['employees.php',  'کارمندان',           'users'],
        ['attendance.php', 'حضور و غیاب',        'calendar'],
        ['reports_daily.php',   'راپور روزانه',  'bars'],
        ['reports_monthly.php', 'راپور ماهانه',  'line'],
        ['reports_yearly.php',  'راپور سالانه',  'pie'],
        ['reports_other.php',   'راپورهای دیگر', 'search'],
        ['__divider', '', ''],
        ['help.php',       'راهنمای استفاده',     'help'],
        ['company.php',    'مشخصات شرکت',        'factory'],
        ['settings.php',   'تنظیمات',            'gear', [
            ['settings.php',                  'عمومی و ظاهر',        'gear'],
            ['settings_lookups.php?t=material_types',  'اقلام و مواد',        'cube'],
            ['settings_lookups.php?t=expense_types',   'انواع مصرف - مربوط',          'expense'],
            ['settings_lookups.php?t=payers',          'پرداخت‌کننده‌گان',     'users'],
            ['settings_lookups.php?t=receipt_sources', 'منابع و رسیدات',      'money'],
        ]],
        ['users.php',      'کاربران سیستم',      'lock'],
        ['activity.php',   'سابقه فعالیت‌ها',     'clock'],
        ['backup.php',     'پشتیبان‌گیری',        'save'],
    ];
}

function page_header(string $title, array $opts = []): void
{
    $user = current_user();
    $script = basename($_SERVER['SCRIPT_NAME'] ?? '');
    $nav = nav_items();

    // صفحه‌هایی که فقط مدیر می‌بیند
    $adminOnly = ['company.php', 'settings.php', 'settings_lookups.php', 'users.php', 'activity.php', 'backup.php'];

    ?><!DOCTYPE html>
<html lang="fa" dir="rtl" data-theme="<?= appearance('theme_mode') ?>" data-density="<?= appearance('density') ?>" data-fs="<?= appearance('font_size') ?>" data-corners="<?= appearance('corner_style') ?>" data-stripes="<?= appearance('table_stripes') ?>" data-font="<?= appearance('font_family') ?>">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="light dark">
<meta name="theme-color" content="<?= theme_color() ?>">
<script><?= theme_boot_js() ?></script>
<title><?= e($title) ?> — <?= e(company_name()) ?></title>
<?php if (appearance('font_family') !== 'system'): ?>
<link rel="preload" as="font" type="font/woff2" href="assets/fonts/vazirmatn-arabic-400.woff2" crossorigin>
<?php if (appearance('font_family') === 'poppins'): ?>
<link rel="preload" as="font" type="font/woff2" href="assets/fonts/poppins-latin-400.woff2" crossorigin>
<?php endif; ?>
<?php endif; ?>
<link rel="stylesheet" href="assets/style.css?v=<?= @filemtime(FR_ROOT . '/assets/style.css') ?: 1 ?>">
<style><?= theme_css() ?></style>
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🧱</text></svg>">
</head>
<body>
<?php if (!empty($opts['bare'])) { echo '<div class="print-page">'; return; } ?>
<header class="topbar no-print">
  <div class="brand">
    <a class="menu-btn" href="#" id="menuToggle" title="منو"><?= icon('menu', 20) ?></a>
    <span class="logo"><?= icon('cube', 24) ?></span>
    <div class="brand-text">
      <strong><?= e(company_name()) ?></strong>
      <small><?= e(company_row()['activity_type'] ?: 'تولید مواد ساختمانی') ?></small>
    </div>
  </div>
  <div class="topbar-right">
    <span class="today">امروز: <?= fdate(today_ymd(), true) ?> — <?= e(weekday_name()) ?></span>
    <button type="button" class="icon-btn" id="themeToggle" title="تغییر حالت روشن/تیره" aria-label="تغییر حالت نمایش"><?= icon('refresh', 17) ?></button>
    <?php if ($user): ?>
      <span class="user-chip" title="<?= e($user['role']) ?>"><?= icon('user', 15) ?><span class="chip-name"><?= e($user['full_name'] ?: $user['username']) ?></span></span>
      <a class="btn btn-sm" href="logout.php"><?= icon('logout', 15) ?> خروج</a>
    <?php endif; ?>
  </div>
</header>

<div class="nav-overlay no-print" id="navOverlay"></div>
<div class="wrap">
  <aside class="sidebar no-print" id="sidebar">
    <nav>
      <?php foreach ($nav as $item): ?>
        <?php if ($item[0] === '__divider'): ?>
          <div class="nav-divider"></div>
          <?php continue; ?>
        <?php endif; ?>
        <?php if (in_array($item[0], $adminOnly, true) && !is_admin()): ?>
          <?php continue; ?>
        <?php endif; ?>
        <?php $children = $item[3] ?? []; ?>
        <?php if (!$children): ?>
          <a href="<?= e($item[0]) ?>" class="<?= $script === $item[0] ? 'active' : '' ?>">
            <span class="ico"><?= icon($item[2], 17) ?></span><span><?= e($item[1]) ?></span>
          </a>
          <?php continue; ?>
        <?php endif; ?>
        <?php
          // زیرمنو: وقتی صفحه جاری یکی از زیرصفحه‌ها باشد، خودکار باز می‌شود
          $kidsOn = array_filter($children, fn($c) => str_starts_with((string) ($_SERVER['REQUEST_URI'] ?? ''), '/' . $c[0])
              || str_starts_with((string) ($_SERVER['REQUEST_URI'] ?? ''), $c[0]));
          $groupOpen = !empty($kidsOn);
        ?>
        <div class="nav-group <?= $groupOpen ? 'open' : '' ?>" data-group="<?= e($item[0]) ?>">
          <div class="nav-row">
            <a href="<?= e($item[0]) ?>" class="nav-parent <?= ($script === $item[0] && !$groupOpen) ? 'active' : '' ?>">
              <span class="ico"><?= icon($item[2], 17) ?></span><span><?= e($item[1]) ?></span>
            </a>
            <button class="nav-caret" type="button" aria-label="نمایش زیرمنو" aria-expanded="<?= $groupOpen ? 'true' : 'false' ?>"><?= icon('back', 14) ?></button>
          </div>
          <div class="nav-sub">
            <?php foreach ($children as $c): if (in_array($c[0], $adminOnly, true) && !is_admin()) { continue; } ?>
              <?php
                $cur = (string) ($_SERVER['REQUEST_URI'] ?? '');
                $cFile = explode('?', $c[0])[0];
                $cQuery = explode('?', $c[0])[1] ?? '';
                $isActive = $cQuery === ''
                    ? ($script === $cFile && !str_contains($cur, 'settings_lookups.php'))
                    : ($script === $cFile && str_contains($cur, $cQuery));
              ?>
              <a href="<?= e($c[0]) ?>" class="<?= $isActive ? 'active' : '' ?>">
                <span class="ico"><?= icon($c[2], 15) ?></span><span><?= e($c[1]) ?></span>
              </a>
            <?php endforeach; ?>
          </div>
        </div>
      <?php endforeach; ?>
    </nav>
  </aside>

  <main class="content">
    <div class="page-head no-print">
      <h1><?= e($title) ?></h1>
      <?php if (!empty($opts['actions'])): ?>
        <div class="page-actions"><?= $opts['actions'] ?></div>
      <?php endif; ?>
    </div>
    <?php
    /**
     * پیام‌ها به شکل «توست» نشان داده می‌شوند (data-toast).
     * اگر جاوااسکریپت خاموش باشد، همین alert‌ها بدون هیچ مشکلی باقی می‌مانند.
     */
    foreach (take_flashes() as $f):
        $ftype = in_array($f['type'], ['success', 'error', 'warn', 'info'], true) ? $f['type'] : 'info';
        ?>
      <div class="alert alert-<?= e($ftype === 'warn' ? 'warn' : $ftype) ?> no-print"
           data-toast="<?= e($ftype) ?>" role="status"><?= $f['msg'] ?></div>
    <?php endforeach; ?>
    <?php if (function_exists('take_schema_msg') && ($__sm = take_schema_msg()) !== ''): ?>
      <div class="alert alert-success no-print" data-toast="success"><?= icon('check', 15) ?> <?= e($__sm) ?></div>
    <?php endif; ?>
<?php }

function page_footer(): void
{ ?>
  </main>
</div>
<footer class="footer no-print">
  <?= e(company_name()) ?> — سیستم مدیریت داخلی | تاریخ سیستم: <?= fdate(today_ymd(), true) ?>
</footer>
<script>window.FR_CAL = '<?= cal_mode() ?>'; window.FR_TODAY = '<?= fdate(today_ymd()) ?>';</script>
<script src="assets/app.js?v=<?= @filemtime(FR_ROOT . '/assets/app.js') ?: 1 ?>" defer></script>
</body>
</html>
<?php }

/** کارت خلاصه داشبورد */
function stat_card(string $label, string $value, string $sub = '', string $cls = ''): void
{ ?>
  <div class="stat <?= e($cls) ?>">
    <div class="stat-label"><?= e($label) ?></div>
    <div class="stat-value"><?= $value ?></div>
    <?php if ($sub !== ''): ?><div class="stat-sub"><?= $sub ?></div><?php endif; ?>
  </div>
<?php }

/** باز/بسته کردن جدول قابل چاپ */
function table_start(array $cols, array $opts = []): void
{
    $cls = $opts['class'] ?? 'grid';
    echo '<div class="table-wrap"><table class="' . e($cls) . '">';
    echo '<thead><tr>';
    foreach ($cols as $c) {
        $label = is_array($c) ? ($c['label'] ?? '') : $c;
        $align = is_array($c) && !empty($c['num']) ? ' class="num"' : '';
        echo '<th' . $align . '>' . $label . '</th>';
    }
    echo '</tr></thead><tbody>';
}

function table_end(bool $withFoot = false): void
{
    echo '</tbody></table></div>';
}

/** صفحه چاپ */
function print_button(string $label = 'چاپ'): string
{
    return '<button type="button" class="btn btn-outline no-print" onclick="window.print()">' . icon('print') . ' ' . e($label) . '</button>';
}

/** برچسب رنگی وضعیت پرداخت */
function pay_badge(string $type): string
{
    $cls = $type === 'نقده' || $type === 'نقد' ? 'ok' : 'warn';
    return '<span class="badge badge-' . $cls . '">' . e($type) . '</span>';
}

/** لینک بازگشت به بالا */
function back_link(string $url, string $label = 'بازگشت'): string
{
    return '<a class="btn btn-outline no-print" href="' . e($url) . '">' . icon('back') . ' ' . e($label) . '</a>';
}
