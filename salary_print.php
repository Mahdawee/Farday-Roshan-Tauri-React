<?php
/**
 * چاپ رسید معاش کارمند
 */
require_once __DIR__ . '/app/bootstrap.php';
app_boot();
require_login();

$id = (int) get('id');
$s = Db::one('SELECT s.*, e.full_name, e.emp_code, e.job_title, e.father_name, p.name payer
              FROM salaries s
              JOIN employees e ON e.id=s.employee_id
              LEFT JOIN payers p ON p.id=s.payer_id
              WHERE s.id=?', [$id]);
if (!$s) {
    flash('رسید معاش یافت نشد.', 'error');
    redirect('salaries.php');
}
$co = company_row();
?><!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
<meta charset="UTF-8">
<title>رسید معاش <?= e($s['salary_no']) ?></title>
<link rel="stylesheet" href="assets/style.css">
<style>
  .doc{max-width:760px; margin:18px auto; background:#fff; border:1px solid #999; padding:22px}
  .doc-head{display:flex; justify-content:space-between; border-bottom:2px solid #0f766e; padding-bottom:10px}
  .doc-head h1{margin:0; font-size:19px; color:#0f766e}
  .meta{font-size:12.5px; color:#444; line-height:1.9}
  .doc-title{text-align:center; font-size:17px; font-weight:700; margin:14px 0 12px; text-decoration:underline}
  table.doc-table{width:100%; border-collapse:collapse; font-size:13.5px}
  table.doc-table th, table.doc-table td{border:1px solid #999; padding:7px 9px}
  table.doc-table th{background:#f1f5f9; width:180px; text-align:right}
  .amount-box{margin-top:14px; border:1px solid #999; padding:10px; font-size:15px; background:#f8fafc}
  .no-print{text-align:center; margin:14px}
  @media print{ .no-print{display:none} .doc{border:0; margin:0; max-width:none} }
</style>
</head>
<body>
<div class="no-print">
  <button class="btn btn-primary" onclick="window.print()"><?= icon('print') ?> چاپ رسید</button>
  <a class="btn" href="salaries.php">بازگشت به شیت معاشات</a>
  <a class="btn" href="employee_view.php?id=<?= (int) $s['employee_id'] ?>">پروفایل کارمند</a>
</div>

<div class="doc">
  <div class="doc-head">
    <div>
      <h1><?= e($co['name']) ?></h1>
      <div class="meta"><?= e($co['activity_type']) ?><br><?= e($co['address']) ?></div>
    </div>
    <div class="meta" style="text-align:left">
      شماره: <b><?= e($s['salary_no']) ?></b><br>
      تاریخ: <b><?= e(fdate($s['pay_date'], true)) ?></b>
    </div>
  </div>

  <div class="doc-title">رسید پرداخت معاش</div>

  <table class="doc-table">
    <tbody>
      <tr><th>کد کارمند</th><td><?= e($s['emp_code']) ?></td></tr>
      <tr><th>نام و تخلص</th><td><?= e($s['full_name']) ?></td></tr>
      <tr><th>نام پدر</th><td><?= e($s['father_name']) ?></td></tr>
      <tr><th>وظیفه</th><td><?= e($s['job_title']) ?></td></tr>
      <tr><th>ماه / سال معاش</th><td><?= e(fmonth((int) $s['pay_year'], (int) $s['pay_month'])) ?></td></tr>
      <tr><th>معاش ثابت</th><td><?= e(fmt($s['base_salary'])) ?> افغانی</td></tr>
      <tr><th>پاداش</th><td><?= e(fmt($s['bonus'])) ?> افغانی</td></tr>
      <tr><th>اضافه کاری</th><td><?= e(fmt($s['overtime_pay'])) ?> افغانی</td></tr>
      <tr><th>جریمه</th><td><?= e(fmt($s['fine'])) ?> افغانی</td></tr>
      <tr><th>پرداخت کننده</th><td><?= e($s['payer']) ?></td></tr>
      <tr><th>نوع پرداخت</th><td><?= e($s['payment_type']) ?></td></tr>
      <tr><th>توضیحات</th><td><?= e($s['notes']) ?></td></tr>
    </tbody>
  </table>

  <div class="amount-box">
    <b>مجموع پرداخت:</b> <?= e(fmt($s['total_pay'])) ?> افغانی
    &nbsp;&nbsp;|&nbsp;&nbsp; معاش ثابت + پاداش + اضافه کاری − جریمه
  </div>

  <div class="sig">
    <div>امضای کارمند</div>
    <div>امضای پرداخت کننده</div>
    <div>امضای مدیر مالی</div>
  </div>
</div>
</body>
</html>
