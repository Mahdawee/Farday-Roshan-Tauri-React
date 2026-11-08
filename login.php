<?php
/**
 * صفحه ورود به سیستم
 */
require_once __DIR__ . '/app/bootstrap.php';
app_boot();

if (is_logged_in()) {
    redirect('index.php');
}

$error = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $u = normalize_digits((string) post('username'));
    $p = (string) post('password');
    if ($u === '' || $p === '') {
        $error = 'نام کاربری و رمز عبور را وارد کنید.';
    } elseif (attempt_login($u, $p)) {
        $next = get('next', 'index.php');
        $next = preg_replace('/[^a-zA-Z0-9_\-\.\?=&%]/', '', (string) $next);
        redirect($next ?: 'index.php');
    } else {
        $error = 'نام کاربری یا رمز عبور نادرست است.';
    }
}
?><!DOCTYPE html>
<html lang="fa" dir="rtl" data-theme="<?= appearance('theme_mode') ?>" data-density="<?= appearance('density') ?>" data-fs="<?= appearance('font_size') ?>" data-corners="<?= appearance('corner_style') ?>" data-font="<?= appearance('font_family') ?>">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="light dark">
<meta name="theme-color" content="<?= theme_color() ?>">
<script><?= theme_boot_js() ?></script>
<title>ورود — <?= e(company_name()) ?></title>
<link rel="stylesheet" href="assets/style.css?v=<?= @filemtime(FR_ROOT . '/assets/style.css') ?: 1 ?>">
<style><?= theme_css() ?></style>
</head>
<body class="login-body">
  <form class="login-card" method="post" autocomplete="off">
    <?= csrf_field() ?>
    <div class="logo-lg"><?= icon('cube', 26) ?></div>
    <h1><?= e(company_name()) ?></h1>
    <div class="sub">سیستم مدیریت فروشات، مصارف، معاشات و راپورها</div>
    <?php if ($error): ?><div class="alert alert-error"><?= e($error) ?></div><?php endif; ?>
    <div class="field">
      <label for="username">نام کاربری</label>
      <input type="text" id="username" name="username" autocomplete="username" autofocus required>
    </div>
    <div class="field">
      <label for="password">رمز عبور</label>
      <input type="password" id="password" name="password" autocomplete="current-password" required>
    </div>
    <button class="btn btn-primary" type="submit">ورود به سیستم</button>
    <div class="login-tools">
      <span><?= fdate(today_ymd(), true) ?></span>
      <a href="doctor.php">بررسی سلامت سیستم</a>
    </div>
    <div class="hint">نام کاربری و رمز پیش‌فرض: <b>admin</b> / <b>admin123</b><br>بعد از ورود، از بخش «کاربران سیستم» رمز را تغییر دهید.</div>
  </form>
  <button type="button" class="icon-btn" id="themeToggle" style="position:fixed;top:12px;left:12px" title="تغییر حالت روشن/تیره"><?= icon('refresh', 17) ?></button>
  <script>window.FR_CAL='<?= cal_mode() ?>'; window.FR_TODAY='<?= fdate(today_ymd()) ?>';</script>
  <script src="assets/app.js?v=<?= @filemtime(FR_ROOT . '/assets/app.js') ?: 1 ?>" defer></script>
</body>
</html>