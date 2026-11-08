<?php
/**
 * پروفایل کارمند — معلومات، حضور و غیاب و سابقه معاشات
 */
require_once __DIR__ . '/app/bootstrap.php';
app_boot();
require_login();

$id = (int) get('id');
$emp = Db::one('SELECT * FROM employees WHERE id=?', [$id]);
if (!$emp) {
    flash('کارمند مورد نظر یافت نشد.', 'error');
    redirect('employees.php');
}

$year  = (int) get('year', cal_year());
$month = (int) get('month', cal_month());
[$from, $to] = period_range($year, $month);

$att = Db::one("SELECT SUM(status='حاضر') present, SUM(status='غایب') absent, SUM(status='رخصت') leave_,
                       SUM(status='مریض') sick, SUM(status='رخصتی رسمی') official,
                       COALESCE(SUM(overtime_hours),0) ot
                FROM attendance WHERE employee_id=? AND work_date BETWEEN ? AND ?", [$id, $from, $to]) ?: [];

$salaryTotal = Db::num('SELECT COALESCE(SUM(total_pay),0) FROM salaries WHERE employee_id=?', [$id]);
$salaries = Db::all('SELECT * FROM salaries WHERE employee_id=? ORDER BY pay_date DESC LIMIT 24', [$id]);
$attendanceRows = Db::all('SELECT * FROM attendance WHERE employee_id=? ORDER BY work_date DESC LIMIT 60', [$id]);

page_header('پروفایل کارمند', ['actions' =>
    '<a class="btn btn-primary" href="salaries.php?action=new&employee_id=' . $id . '">' . icon('salary') . ' پرداخت معاش</a>'
  . '<a class="btn" href="attendance.php?type=day">' . icon('calendar') . ' حضور و غیاب</a>'
  . '<a class="btn" href="employees.php?action=edit&id=' . $id . '">' . icon('pencil') . ' ویرایش معلومات</a>'
  . print_button()]);
?>
<div class="print-title">
  <h2><?= e(print_header_text()) ?></h2>
  <div class="sub">معلومات کارمند — <?= e($emp['full_name']) ?> (<?= e($emp['emp_code']) ?>)</div>
</div>

<div class="grid-2">
  <div class="card">
    <div class="card-head"><h2>معلومات شخصی و وظیفوی</h2>
      <span class="badge <?= $emp['status'] === 'فعال' ? 'badge-ok' : 'badge-bad' ?>"><?= e($emp['status']) ?></span></div>
    <table class="grid">
      <tbody>
        <tr><th>کد کارمند</th><td><?= e($emp['emp_code']) ?></td><th>نام و تخلص</th><td><?= e($emp['full_name']) ?></td></tr>
        <tr><th>نام پدر</th><td><?= e($emp['father_name']) ?></td><th>وظیفه</th><td><?= e($emp['job_title']) ?></td></tr>
        <tr><th>تاریخ استخدام</th><td><?= e(fdate($emp['hire_date'])) ?></td><th>معاش ثابت</th><td><?= fmt_afn($emp['base_salary']) ?></td></tr>
        <tr><th>شماره تماس</th><td><?= e($emp['phone']) ?></td><th>شماره تذکره</th><td><?= e($emp['tazkira_no']) ?></td></tr>
        <tr><th>آدرس</th><td><?= e($emp['address']) ?></td><th>مدت قرارداد</th><td><?= e($emp['contract_duration']) ?></td></tr>
        <tr><th>توضیحات</th><td colspan="3"><?= nl2br(e($emp['notes'])) ?></td></tr>
      </tbody>
    </table>
  </div>

  <div class="card">
    <div class="card-head"><h2>خلاصه</h2></div>
    <div class="stats" style="grid-template-columns:1fr 1fr">
      <?php
        stat_card('مجموع معاش پرداخت‌شده', fmt_afn($salaryTotal), 'از آغاز فعالیت', 'good');
        stat_card('حضور در ماه ' . month_label($month), fmt($att['present'] ?? 0) . ' روز',
            'غایب: ' . fmt($att['absent'] ?? 0) . ' | رخصت: ' . fmt(($att['leave_'] ?? 0) + ($att['sick'] ?? 0)), 'info');
        stat_card('اضافه کاری این ماه', fmt($att['ot'] ?? 0, 1) . ' ساعت');
        stat_card('تعداد پرداخت معاش', fmt(count($salaries)) . ' مورد');
      ?>
    </div>
    <form method="get" class="filters no-print">
      <input type="hidden" name="id" value="<?= $id ?>">
      <div class="filter-item"><label>سال</label><input type="text" name="year" value="<?= e((string) $year) ?>"></div>
      <div class="filter-item"><label>ماه</label><select name="month">
        <?php foreach (month_list() as $m => $l): ?>
          <option value="<?= $m ?>" <?= $month == $m ? 'selected' : '' ?>><?= e($l) ?></option>
        <?php endforeach; ?></select></div>
      <div class="filter-item btn-cell"><button class="btn" type="submit">نمایش</button></div>
    </form>
  </div>
</div>

<div class="card">
  <div class="card-head"><h2>سابقه معاشات</h2><a class="btn btn-sm" href="salaries.php?employee_id=<?= $id ?>">همه پرداخت‌ها</a></div>
  <div class="table-wrap">
    <table class="grid">
      <thead><tr><th>شماره</th><th>ماه/سال</th><th>تاریخ پرداخت</th><th class="num">معاش ثابت</th><th class="num">پاداش</th>
        <th class="num">جریمه</th><th class="num">اضافه کاری</th><th class="num">مجموع پرداخت</th><th>نوع</th><th class="no-print">عملیات</th></tr></thead>
      <tbody>
      <?php foreach ($salaries as $s): ?>
        <tr>
          <td class="nowrap"><?= e($s['salary_no']) ?></td>
          <td class="nowrap"><?= e(fmonth((int) $s['pay_year'], (int) $s['pay_month'])) ?></td>
          <td class="nowrap"><?= e(fdate($s['pay_date'])) ?></td>
          <td class="num"><?= fmt($s['base_salary']) ?></td>
          <td class="num"><?= fmt($s['bonus']) ?></td>
          <td class="num"><?= fmt($s['fine']) ?></td>
          <td class="num"><?= fmt($s['overtime_pay']) ?></td>
          <td class="num"><b><?= fmt($s['total_pay']) ?></b></td>
          <td><?= e($s['payment_type']) ?></td>
          <td class="no-print"><a class="mini" href="salary_print.php?id=<?= (int) $s['id'] ?>"><?= icon('print') ?> رسید</a></td>
        </tr>
      <?php endforeach; ?>
      <?php if (!$salaries): ?><tr><td colspan="10" class="empty">معاشی ثبت نشده است.</td></tr><?php endif; ?>
      </tbody>
    </table>
  </div>
</div>

<div class="card">
  <div class="card-head"><h2>سابقه حضور و غیاب (۶۰ رکورد آخر)</h2>
    <a class="btn btn-sm no-print" href="attendance.php?type=month&employee_id=<?= $id ?>">نمای ماهانه</a></div>
  <div class="table-wrap">
    <table class="grid">
      <thead><tr><th>تاریخ</th><th>روز</th><th>وضعیت</th><th>ورود</th><th>خروج</th><th class="num">اضافه کاری</th><th>ملاحظات</th></tr></thead>
      <tbody>
      <?php foreach ($attendanceRows as $a): ?>
        <tr>
          <td class="nowrap"><?= e(fdate($a['work_date'])) ?></td>
          <td><?= e(weekday_name($a['work_date'])) ?></td>
          <td><?= e($a['status']) ?></td>
          <td><?= e($a['check_in'] ? substr($a['check_in'], 0, 5) : '') ?></td>
          <td><?= e($a['check_out'] ? substr($a['check_out'], 0, 5) : '') ?></td>
          <td class="num"><?= fmt($a['overtime_hours'], 1) ?></td>
          <td><?= e($a['notes']) ?></td>
        </tr>
      <?php endforeach; ?>
      <?php if (!$attendanceRows): ?><tr><td colspan="7" class="empty">حضور و غیاب ثبت نشده است.</td></tr><?php endif; ?>
      </tbody>
    </table>
  </div>
</div>
<?php page_footer(); ?>
