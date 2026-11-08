<?php
/**
 * شیت مشخصات شرکت (ثابت — قابل ویرایش توسط مدیر) + انواع و تعداد ماشینری
 */
require_once __DIR__ . '/app/bootstrap.php';
app_boot();
require_admin();

$fields = [
    'name'             => 'نام شرکت',
    'activity_type'    => 'نوع فعالیت',
    'address'          => 'آدرس',
    'finance_manager'  => 'مدیر مالی',
    'supervisor'       => 'سرپرست',
    'fiscal_year_note' => 'سال مالی',
    'employees_count'  => 'تعداد کارمندان',
    'phone'            => 'شماره تماس',
    'email'            => 'ایمیل',
    'license_no'       => 'شماره جواز',
    'notes'            => 'توضیحات',
];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $action = post('action');

    if ($action === 'save_company') {
        $data = [];
        foreach ($fields as $f => $label) {
            if ($f === 'employees_count') {
                $data[$f] = (int) parse_number(post($f));
            } else {
                $data[$f] = (string) post($f, '');
            }
        }
        if ($data['name'] === '') {
            $data['name'] = 'شرکت فردای روشن';
        }
        Db::update('company', $data, '`id`=1');
        log_activity('update', 'company', 1, 'ویرایش مشخصات شرکت');
        flash('مشخصات شرکت ذخیره شد.', 'success');
        redirect('company.php');
    }

    if ($action === 'machine_save') {
        $id = (int) post('id');
        $data = [
            'name'       => (string) post('name'),
            'count'      => max(1, (int) parse_number(post('count'), 1)),
            'status'     => in_array(post('status'), ['فعال', 'غیرفعال', 'تحت ترمیم'], true) ? post('status') : 'فعال',
            'notes'      => (string) post('notes', ''),
            'sort_order' => (int) parse_number(post('sort_order')),
        ];
        if ($data['name'] === '') {
            flash('نام ماشین را بنویسید.', 'error');
            redirect('company.php');
        }
        if ($id) {
            Db::update('machines', $data, '`id`=?', [$id]);
            flash('ماشین ویرایش شد.', 'success');
        } else {
            Db::insert('machines', $data);
            flash('ماشین جدید ثبت شد.', 'success');
        }
        log_activity($id ? 'update' : 'create', 'machines', $id ?: null, $data['name']);
        redirect('company.php');
    }

    if ($action === 'machine_delete') {
        Db::delete('machines', '`id`=?', [(int) post('id')]);
        flash('ماشین حذف شد.', 'success');
        redirect('company.php');
    }
}

$co = company_row();
$machines = Db::all('SELECT * FROM machines ORDER BY sort_order, id');
$empCount = (int) Db::val("SELECT COUNT(*) FROM employees WHERE status='فعال'", [], 0);

page_header('مشخصات شرکت', ['actions' => print_button('چاپ مشخصات')]);
?>
<div class="print-title"><h2><?= e(print_header_text()) ?></h2><div class="sub">شیت مشخصات شرکت — تاریخ چاپ: <?= e(fdate(today_ymd())) ?></div></div>

<div class="card">
  <div class="card-head"><h2>مشخصات ثابت شرکت</h2>
    <span class="muted">تعداد کارمندان فعال در سیستم: <?= fmt($empCount) ?> نفر</span></div>
  <form method="post" class="form-grid">
    <?= csrf_field() ?>
    <input type="hidden" name="action" value="save_company">
    <?php foreach ($fields as $f => $label): ?>
      <div class="field <?= in_array($f, ['name', 'activity_type', 'address', 'notes'], true) ? 'col-half' : 'col-third' ?>">
        <label><?= e($label) ?></label>
        <?php if ($f === 'notes'): ?>
          <textarea name="<?= e($f) ?>" rows="2"><?= e((string) $co[$f]) ?></textarea>
        <?php else: ?>
          <input type="text" name="<?= e($f) ?>" value="<?= e((string) $co[$f]) ?>">
        <?php endif; ?>
        <?php if ($f === 'employees_count'): ?>
          <small class="help">اگر خالی بماند، تعداد واقعی کارمندان فعال شیت کارمندان (<b><?= fmt($empCount) ?></b>) استفاده می‌شود.</small>
        <?php endif; ?>
      </div>
    <?php endforeach; ?>
    <div class="form-actions col-full"><button class="btn btn-primary" type="submit"><?= icon('save') ?> ذخیره مشخصات شرکت</button></div>
  </form>
</div>

<div class="card">
  <div class="card-head"><h2>انواع و تعداد ماشینری</h2>
    <span class="muted">مجموع ماشین‌ها: <?= fmt(array_sum(array_map(fn($m) => (int) $m['count'], $machines))) ?> عدد</span></div>
  <div class="table-wrap">
    <table class="grid">
      <thead><tr><th>شماره</th><th>نوع ماشین</th><th>تعداد</th><th>وضعیت</th><th>توضیحات</th><th>ترتیب</th><th>ذخیره</th><th></th></tr></thead>
      <tbody>
      <?php foreach ($machines as $i => $m): $fid = 'mf_' . (int) $m['id']; ?>
        <tr>
          <td class="num"><?= fmt($i + 1) ?></td>
          <td><form method="post" id="<?= $fid ?>"><?= csrf_field() ?>
            <input type="hidden" name="action" value="machine_save">
            <input type="hidden" name="id" value="<?= (int) $m['id'] ?>">
            <input type="text" name="name" value="<?= e($m['name']) ?>" required></form></td>
          <td><input type="text" form="<?= $fid ?>" name="count" value="<?= (int) $m['count'] ?>" class="num-input" style="width:70px"></td>
          <td><select form="<?= $fid ?>" name="status">
            <?php foreach (['فعال', 'غیرفعال', 'تحت ترمیم'] as $st): ?>
              <option value="<?= e($st) ?>" <?= $m['status'] === $st ? 'selected' : '' ?>><?= e($st) ?></option>
            <?php endforeach; ?></select></td>
          <td><input type="text" form="<?= $fid ?>" name="notes" value="<?= e($m['notes']) ?>"></td>
          <td><input type="text" form="<?= $fid ?>" name="sort_order" value="<?= (int) $m['sort_order'] ?>" class="num-input" style="width:70px"></td>
          <td><button class="btn btn-sm" type="submit" form="<?= $fid ?>"><?= icon('save', 14) ?></button></td>
          <td>
            <form method="post" data-confirm="این ردیف (ماشینری یا ردیف مشخصات) حذف شود؟" data-confirm-title="حذف ردیف" data-confirm-ok="حذف کن" data-confirm-type="err" data-confirm-danger><?= csrf_field() ?>
              <input type="hidden" name="action" value="machine_delete">
              <input type="hidden" name="id" value="<?= (int) $m['id'] ?>">
              <button class="btn btn-sm btn-danger" type="submit"><?= icon('trash', 14) ?></button></form>
          </td>
        </tr>
      <?php endforeach; ?>
      </tbody>
      <tfoot><tr>
        <td>جدید</td>
        <td><form method="post" id="mf_new"><?= csrf_field() ?>
          <input type="hidden" name="action" value="machine_save">
          <input type="text" name="name" placeholder="مثلاً لودر کوماتسو" required></form></td>
        <td><input type="text" form="mf_new" name="count" value="1" class="num-input" style="width:70px"></td>
        <td><select form="mf_new" name="status"><option>فعال</option><option>غیرفعال</option><option>تحت ترمیم</option></select></td>
        <td><input type="text" form="mf_new" name="notes"></td>
        <td><input type="text" form="mf_new" name="sort_order" value="<?= (count($machines) + 1) * 10 ?>" class="num-input" style="width:70px"></td>
        <td colspan="2"><button class="btn btn-sm btn-primary" type="submit" form="mf_new"><?= icon('plus') ?> ثبت ماشین</button></td>
      </tr></tfoot>
    </table>
  </div>
</div>
<?php page_footer(); ?>
