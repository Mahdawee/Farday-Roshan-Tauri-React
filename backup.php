<?php
/**
 * پشتیبان‌گیری و بازگردانی دیتابیس (بدون نیاز به انترنت و ابزار بیرونی)
 */
require_once __DIR__ . '/app/bootstrap.php';
app_boot();
require_admin();

$dir = FR_ROOT . '/backups';
if (!is_dir($dir)) {
    @mkdir($dir, 0775, true);
}

require_once __DIR__ . '/app/backup.php';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $action = post('action');

    if ($action === 'create') {
        try {
            $name = create_backup($dir);
            log_activity('backup', 'database', null, $name);
            flash('فایل پشتیبان ساخته شد: ' . e($name), 'success');
        } catch (Throwable $e) {
            flash('پشتیبان‌گیری ناکام شد: ' . Db::userError($e), 'error');
        }
        redirect('backup.php');
    }

    if ($action === 'delete') {
        $name = basename((string) post('name'));
        $path = $dir . '/' . $name;
        if (is_file($path)) {
            @unlink($path);
            flash('فایل پشتیبان حذف شد.', 'success');
        }
        redirect('backup.php');
    }

    if ($action === 'restore') {
        $name = basename((string) post('file'));
        $path = $dir . '/' . $name;
        if (!is_file($path)) {
            flash('فایل پشتیبان یافت نشد.', 'error');
            redirect('backup.php');
        }
        try {
            $sql = file_get_contents($path);
            $pdo = Db::pdo();
            $pdo->exec('SET FOREIGN_KEY_CHECKS=0');
            foreach (explode(";\n", $sql) as $stmt) {
                $stmt = trim($stmt);
                if ($stmt === '' || substr($stmt, 0, 2) === '--') {
                    continue;
                }
                $pdo->exec($stmt);
            }
            $pdo->exec('SET FOREIGN_KEY_CHECKS=1');
            log_activity('backup', 'database', null, 'بازگردانی از ' . $name);
            flash('دیتابیس از فایل پشتیبان بازگردانی شد. لطفاً دوباره وارد شوید.', 'success');
            logout();
            redirect('login.php');
        } catch (Throwable $e) {
            flash('بازگردانی ناکام شد: ' . Db::userError($e), 'error');
        }
        redirect('backup.php');
    }

    if ($action === 'upload') {
        if (!empty($_FILES['sqlfile']['tmp_name']) && is_uploaded_file($_FILES['sqlfile']['tmp_name'])) {
            $name = 'uploaded-' . date('Y-m-d_His') . '.sql';
            if (move_uploaded_file($_FILES['sqlfile']['tmp_name'], $dir . '/' . $name)) {
                flash('فایل بارگذاری شد: ' . e($name) . ' — حالا می‌توانید آن را بازگردانی کنید.', 'success');
            } else {
                flash('بارگذاری فایل ناکام شد.', 'error');
            }
        } else {
            flash('فایلی انتخاب نشده است.', 'error');
        }
        redirect('backup.php');
    }
}

$files = [];
foreach (glob($dir . '/*.sql') ?: [] as $f) {
    $files[] = ['name' => basename($f), 'size' => filesize($f), 'time' => filemtime($f)];
}
usort($files, fn($a, $b) => $b['time'] <=> $a['time']);

page_header('پشتیبان‌گیری و بازگردانی');
?>
<div class="grid-2">
  <div class="card">
    <div class="card-head"><h2>ساخت نسخه پشتیبان</h2></div>
    <p class="muted">یک فایل کامل <b>.sql</b> از تمام معلومات سیستم ساخته می‌شود و در پوشه <b>backups</b> ذخیره می‌گردد.
      پیشنهاد می‌شود این فایل را روی فلش یا کمپیوتر دیگری هم کاپی کنید.</p>
    <form method="post">
      <?= csrf_field() ?>
      <input type="hidden" name="action" value="create">
      <button class="btn btn-primary" type="submit"><?= icon('save') ?> ساخت پشتیبان جدید</button>
    </form>
  </div>
  <div class="card">
    <div class="card-head"><h2>بارگذاری فایل پشتیبان از کمپیوتر</h2></div>
    <form method="post" enctype="multipart/form-data">
      <?= csrf_field() ?>
      <input type="hidden" name="action" value="upload">
      <div class="field"><label>انتخاب فایل .sql</label><input type="file" name="sqlfile" accept=".sql"></div>
      <div class="form-actions"><button class="btn" type="submit"><?= icon('upload') ?> بارگذاری</button></div>
    </form>
  </div>
</div>

<div class="card">
  <div class="card-head"><h2>فایل‌های پشتیبان موجود</h2><span class="muted">مسیر: backups/</span></div>
  <div class="table-wrap">
    <table class="grid">
      <thead><tr><th>شماره</th><th>نام فایل</th><th>حجم</th><th>تاریخ ساخت</th><th>بازگردانی</th><th>حذف</th></tr></thead>
      <tbody>
      <?php foreach ($files as $i => $f): ?>
        <tr>
          <td class="num"><?= fmt($i + 1) ?></td>
          <td><a href="backup_download.php?name=<?= urlencode($f['name']) ?>"><?= e($f['name']) ?></a></td>
          <td class="num"><?= fmt($f['size'] / 1024, 1) ?> KB</td>
          <td class="nowrap"><?= e(date('Y-m-d H:i', $f['time'])) ?></td>
          <td>
            <form method="post" data-confirm="تمام معلومات فعلی سیستم با معلومات این فایل جایگزین می‌شود و قابل برگشت نیست. مطمئن هستید؟" data-confirm-title="بازگردانی از پشتیبان" data-confirm-ok="بازگردان" data-confirm-type="err" data-confirm-danger>
              <?= csrf_field() ?>
              <input type="hidden" name="action" value="restore">
              <input type="hidden" name="file" value="<?= e($f['name']) ?>">
              <button class="btn btn-sm btn-danger" type="submit"><?= icon('refresh') ?> بازگردانی</button>
            </form>
          </td>
          <td>
            <form method="post" data-confirm="این فایل پشتیبان از پوشه پشتیبان‌ها حذف شود؟" data-confirm-title="حذف فایل پشتیبان" data-confirm-ok="حذف کن" data-confirm-type="err" data-confirm-danger>
              <?= csrf_field() ?>
              <input type="hidden" name="action" value="delete">
              <input type="hidden" name="name" value="<?= e($f['name']) ?>">
              <button class="btn btn-sm" type="submit"><?= icon('trash', 14) ?></button>
            </form>
          </td>
        </tr>
      <?php endforeach; ?>
      <?php if (!$files): ?><tr><td colspan="6" class="empty">هنوز پشتیبانی ساخته نشده است.</td></tr><?php endif; ?>
      </tbody>
    </table>
  </div>
</div>
<?php page_footer(); ?>
