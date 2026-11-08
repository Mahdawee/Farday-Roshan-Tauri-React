<?php
/**
 * کاربران سیستم — ایجاد، ویرایش، تغییر رمز
 */
require_once __DIR__ . '/app/bootstrap.php';
app_boot();
require_admin();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $action = post('action');

    if ($action === 'user_save') {
        $id = (int) post('id');
        $username = normalize_digits((string) post('username'));
        $fullName = (string) post('full_name', '');
        $role = post('role') === 'کارمند' ? 'کارمند' : 'مدیر';
        $active = post('active') ? 1 : 0;
        $password = (string) ($_POST['password'] ?? '');

        if ($username === '' || !preg_match('/^[a-zA-Z0-9_.\-]{3,40}$/', $username)) {
            flash('نام کاربری باید حداقل ۳ حرف و شامل حروف لاتین، عدد، نقطه یا خط باشد.', 'error');
            redirect('users.php');
        }
        $dup = Db::val('SELECT id FROM users WHERE username=? AND id<>?', [$username, $id ?: 0]);
        if ($dup) {
            flash('این نام کاربری قبلاً استفاده شده است.', 'error');
            redirect('users.php');
        }
        $data = ['username' => $username, 'full_name' => $fullName, 'role' => $role, 'active' => $active];
        if ($password !== '') {
            if (mb_strlen($password) < 5) {
                flash('رمز عبور باید حداقل ۵ حرف باشد.', 'error');
                redirect('users.php');
            }
            $data['password_hash'] = password_hash($password, PASSWORD_DEFAULT);
        } elseif (!$id) {
            flash('برای کاربر جدید، رمز عبور لازم است.', 'error');
            redirect('users.php');
        }
        if ($id) {
            Db::update('users', $data, '`id`=?', [$id]);
            $msg = 'کاربر ویرایش شد.';
        } else {
            Db::insert('users', $data);
            $msg = 'کاربر جدید ثبت شد.';
        }
        log_activity($id ? 'update' : 'create', 'users', $id ?: null, $username);
        flash($msg, 'success');
        redirect('users.php');
    }

    if ($action === 'user_delete') {
        $id = (int) post('id');
        if ($id === (int) (current_user()['id'] ?? 0)) {
            flash('حساب خودتان را نمی‌توانید حذف کنید.', 'error');
            redirect('users.php');
        }
        if ((int) Db::val('SELECT COUNT(*) FROM users WHERE active=1', [], 0) <= 1) {
            flash('حداقل یک کاربر فعال لازم است.', 'error');
            redirect('users.php');
        }
        Db::delete('users', '`id`=?', [$id]);
        log_activity('delete', 'users', $id, 'حذف کاربر');
        flash('کاربر حذف شد.', 'success');
        redirect('users.php');
    }

    if ($action === 'change_my_password') {
        $cur = (string) ($_POST['current_password'] ?? '');
        $new1 = (string) ($_POST['new_password'] ?? '');
        $new2 = (string) ($_POST['new_password2'] ?? '');
        $me = Db::one('SELECT * FROM users WHERE id=?', [current_user()['id']]);
        if (!password_verify($cur, $me['password_hash'])) {
            flash('رمز فعلی نادرست است.', 'error');
        } elseif (mb_strlen($new1) < 5) {
            flash('رمز جدید باید حداقل ۵ حرف باشد.', 'error');
        } elseif ($new1 !== $new2) {
            flash('تکرار رمز جدید مطابقت ندارد.', 'error');
        } else {
            change_password((int) $me['id'], $new1);
            log_activity('update', 'users', $me['id'], 'تغییر رمز عبور');
            flash('رمز عبور تغییر کرد.', 'success');
        }
        redirect('users.php');
    }
}

$users = Db::all('SELECT * FROM users ORDER BY role, username');
page_header('کاربران سیستم');
?>
<div class="grid-2">
  <div class="card">
    <div class="card-head"><h2>تغییر رمز عبور من</h2></div>
    <form method="post" class="form-grid">
      <?= csrf_field() ?>
      <input type="hidden" name="action" value="change_my_password">
      <div class="field col-full"><label>رمز فعلی</label><input type="password" name="current_password" required></div>
      <div class="field col-half"><label>رمز جدید</label><input type="password" name="new_password" required></div>
      <div class="field col-half"><label>تکرار رمز جدید</label><input type="password" name="new_password2" required></div>
      <div class="form-actions col-full"><button class="btn btn-primary" type="submit"><?= icon('lock') ?> تغییر رمز</button></div>
    </form>
  </div>
  <div class="card">
    <div class="card-head"><h2>راهنما</h2></div>
    <ul class="muted" style="margin:0 18px 0 0; line-height:2">
      <li>نقش <b>مدیر</b>: دسترسی کامل — حذف معلومات، تنظیمات، مشخصات شرکت، کاربران و پشتیبان‌گیری.</li>
      <li>نقش <b>کارمند</b>: ثبت و ویرایش معلومات شیت‌ها و مشاهده راپورها (بدون حذف و تنظیمات).</li>
      <li>رمز عبور پیش‌فرض کاربر <b>admin</b> برابر <b>admin123</b> است — هر چه زودتر آن را تغییر دهید.</li>
      <li>از بخش «پشتیبان‌گیری» می‌توانید نسخه پشتیبان دیتابیس بگیرید.</li>
    </ul>
  </div>
</div>

<div class="card">
  <div class="card-head"><h2>کاربران موجود</h2></div>
  <div class="table-wrap">
    <table class="grid">
      <thead><tr><th>شماره</th><th>نام کاربری</th><th>نام کامل</th><th>نقش</th><th>فعال</th>
        <th>آخرین ورود</th><th>رمز جدید (اختیاری)</th><th>ذخیره</th><th></th></tr></thead>
      <tbody>
      <?php foreach ($users as $i => $u): $fid = 'uf_' . (int) $u['id']; ?>
        <tr>
          <td class="num"><?= fmt($i + 1) ?></td>
          <td><form method="post" id="<?= $fid ?>"><?= csrf_field() ?>
            <input type="hidden" name="action" value="user_save">
            <input type="hidden" name="id" value="<?= (int) $u['id'] ?>">
            <input type="text" name="username" value="<?= e($u['username']) ?>" required></form></td>
          <td><input type="text" form="<?= $fid ?>" name="full_name" value="<?= e($u['full_name']) ?>"></td>
          <td><select form="<?= $fid ?>" name="role">
            <option value="مدیر" <?= $u['role'] === 'مدیر' ? 'selected' : '' ?>>مدیر</option>
            <option value="کارمند" <?= $u['role'] === 'کارمند' ? 'selected' : '' ?>>کارمند</option></select></td>
          <td><label class="checkbox"><input type="checkbox" form="<?= $fid ?>" name="active" value="1"
            <?= (int) $u['active'] === 1 ? 'checked' : '' ?>></label></td>
          <td class="nowrap"><?= e($u['last_login_at'] ? fdate(substr($u['last_login_at'], 0, 10)) . ' ' . substr($u['last_login_at'], 11, 5) : '—') ?></td>
          <td><input type="password" form="<?= $fid ?>" name="password" placeholder="خالی = بدون تغییر"></td>
          <td><button class="btn btn-sm" type="submit" form="<?= $fid ?>"><?= icon('save', 14) ?></button></td>
          <td>
            <?php if ((int) $u['id'] !== (int) (current_user()['id'] ?? 0)): ?>
            <form method="post" data-confirm="این کاربر از سیستم حذف شود؟ دسترسی او به سیستم بسته می‌شود." data-confirm-title="حذف کاربر" data-confirm-ok="حذف کن" data-confirm-type="err" data-confirm-danger><?= csrf_field() ?>
              <input type="hidden" name="action" value="user_delete">
              <input type="hidden" name="id" value="<?= (int) $u['id'] ?>">
              <button class="btn btn-sm btn-danger" type="submit"><?= icon('trash', 14) ?></button></form>
            <?php endif; ?>
          </td>
        </tr>
      <?php endforeach; ?>
      </tbody>
      <tfoot><tr>
        <td>جدید</td>
        <td><form method="post" id="uf_new"><?= csrf_field() ?>
          <input type="hidden" name="action" value="user_save">
          <input type="text" name="username" placeholder="نام کاربری لاتین" required></form></td>
        <td><input type="text" form="uf_new" name="full_name" placeholder="نام کامل"></td>
        <td><select form="uf_new" name="role"><option value="کارمند">کارمند</option><option value="مدیر">مدیر</option></select></td>
        <td><label class="checkbox"><input type="checkbox" form="uf_new" name="active" value="1" checked></label></td>
        <td>—</td>
        <td><input type="password" form="uf_new" name="password" placeholder="رمز عبور" required></td>
        <td colspan="2"><button class="btn btn-sm btn-primary" type="submit" form="uf_new"><?= icon('plus') ?> ثبت کاربر</button></td>
      </tr></tfoot>
    </table>
  </div>
</div>
<?php page_footer(); ?>
