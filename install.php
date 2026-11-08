<?php
/**
 * نصب سیستم — ساخت دیتابیس، جداول و معلومات اولیه
 * این فایل را یک بار در مرورگر باز کنید:  http://localhost/farday/install.php
 */
define('FR_SKIP_DB_CHECK', true);
define('FR_ALLOW_DB_FAILURE', true);
require_once __DIR__ . '/app/bootstrap.php';
app_boot();

$cfg = app_config();
$messages = [];
$errors = [];
$installed = false;
if (is_file(FR_ROOT . '/app/bootstrap.php')) {
    try {
        Db::pdo()->query('SELECT 1 FROM `settings` LIMIT 1')->fetchColumn();
        $installed = true;
    } catch (Throwable $e) {
        $installed = false;
    }
}

// اگر سیستم قبلاً نصب شده است، فقط مدیر می‌تواند installer را دوباره اجرا کند
if ($installed && !is_admin()) {
    require_login();
    http_response_code(403);
    ?><!DOCTYPE html><html lang="fa" dir="rtl"><head><meta charset="UTF-8"><title>نصب</title>
    <link rel="stylesheet" href="assets/style.css"></head><body>
    <div style="max-width:620px;margin:40px auto" class="card">
      <h2>سیستم قبلاً نصب شده است</h2>
      <p class="muted">برای اجرای دوباره نصب (بروزرسانی ساختار)، باید با حساب <b>مدیر</b> وارد شوید.</p>
      <a class="btn btn-primary" href="login.php?next=install.php">ورود به سیستم</a>
      <a class="btn" href="index.php">بازگشت به داشبورد</a>
    </div></body></html><?php
    exit;
}

require_once FR_ROOT . '/app/installer.php';


if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $res = fr_install([
        'db_host'      => post('db_host', $cfg['db_host']),
        'db_port'      => post('db_port', $cfg['db_port']),
        'db_name'      => post('db_name', $cfg['db_name']),
        'db_user'      => post('db_user', $cfg['db_user']),
        'db_pass'      => (string) ($_POST['db_pass'] ?? ''),
        'demo'         => !empty($_POST['demo']),
        'write_config' => true,
    ]);
    $messages = array_merge($messages, $res['messages']);
    $errors   = array_merge($errors, $res['errors']);
    if (!$errors) {
        flash('نصب سیستم با موفقیت انجام شد. اکنون می‌توانید وارد شوید.', 'success');
        redirect('login.php');
    }
}

?><!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>نصب سیستم — فردای روشن</title>
<link rel="stylesheet" href="assets/style.css">
</head>
<body>
<div style="max-width:760px;margin:26px auto;padding:0 14px">
  <div class="card">
    <h1>🧱 نصب سیستم مدیریت فردای روشن</h1>
    <p class="muted">این صفحه دیتابیس، جداول و معلومات اولیه (مشخصات شرکت، انواع مواد، انواع مصرف - مربوط و کاربر مدیر) را می‌سازد.</p>
    <?php foreach ($messages as $m): ?><div class="alert alert-success"><?= e($m) ?></div><?php endforeach; ?>
    <?php foreach ($errors as $m): ?><div class="alert alert-error"><?= e($m) ?></div><?php endforeach; ?>
    <?php if ($installed): ?>
      <div class="alert alert-info">سیستم قبلاً نصب شده است. اگر دوباره نصب کنید، جداول موجود حذف نمی‌شوند (ساختار تازه‌سازی می‌شود) و معلومات موجود باقی می‌ماند.</div>
    <?php endif; ?>
    <form method="post" class="form-grid">
      <?= csrf_field() ?>
      <div class="field col-half"><label>آدرس سرور دیتابیس</label><input type="text" name="db_host" value="<?= e($cfg['db_host']) ?>" required></div>
      <div class="field col-half"><label>پورت</label><input type="text" name="db_port" value="<?= e((string) $cfg['db_port']) ?>"></div>
      <div class="field col-half"><label>نام دیتابیس</label><input type="text" name="db_name" value="<?= e($cfg['db_name']) ?>" required></div>
      <div class="field col-half"><label>نام کاربری دیتابیس</label><input type="text" name="db_user" value="<?= e($cfg['db_user']) ?>" required></div>
      <div class="field col-half"><label>رمز عبور دیتابیس</label><input type="password" name="db_pass" value=""></div>
      <div class="field col-half"><label class="checkbox"><input type="checkbox" name="demo" value="1" checked> معلومات نمونه (۲۰ کارمند، فروشات، مصارف، رسیدات، معاشات) را ثبت کن</label></div>
      <div class="form-actions col-full">
        <button class="btn btn-primary" type="submit">شروع نصب</button>
        <?php if ($installed): ?><a class="btn btn-outline" href="login.php">رفتن به صفحه ورود</a><?php endif; ?>
      </div>
    </form>
    <p class="muted" style="margin-top:14px;font-size:12.5px">
      اگر از برنامه‌هایی مثل XAMPP، WAMP، Laragon یا EasyPHP استفاده می‌کنید:
      آدرس معمولاً <b>127.0.0.1</b>، نام کاربری <b>root</b> و رمز خالی است.
    </p>
  </div>
</div>
</body>
</html>
