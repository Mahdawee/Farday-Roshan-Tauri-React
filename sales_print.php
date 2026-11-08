<?php
/**
 * چاپ بل فروش (ورق رسمی فروش)
 */
require_once __DIR__ . '/app/bootstrap.php';
app_boot();
require_login();

$id = (int) get('id');
$s = Db::one("SELECT s.*, c.name customer_name, c.code customer_code, c.phone customer_phone,
                     c.address customer_address, c.contact_person, m.name material_name, m.unit
              FROM sales s
              LEFT JOIN customers c ON c.id=s.customer_id
              LEFT JOIN material_types m ON m.id=s.material_id
              WHERE s.id=?", [$id]);
if (!$s) {
    flash('بل فروش یافت نشد.', 'error');
    redirect('sales.php');
}
$co = company_row();
?><!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
<meta charset="UTF-8">
<title>بل فروش <?= e($s['sale_no']) ?></title>
<link rel="stylesheet" href="assets/style.css">
<style>
  .doc{max-width:820px; margin:18px auto; background:#fff; border:1px solid #999; padding:22px}
  .doc-head{display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2px solid #0f766e; padding-bottom:10px}
  .doc-head h1{margin:0; font-size:19px; color:#0f766e}
  .doc-head .meta{font-size:12.5px; color:#444; line-height:1.9}
  .doc-title{text-align:center; font-size:17px; font-weight:700; margin:14px 0 12px; text-decoration:underline}
  table.doc-table{width:100%; border-collapse:collapse; font-size:13.5px}
  table.doc-table th, table.doc-table td{border:1px solid #999; padding:7px 9px}
  table.doc-table th{background:#f1f5f9; width:170px; text-align:right}
  .amount-box{margin-top:14px; border:1px solid #999; padding:10px; font-size:14px; background:#f8fafc}
  .no-print{text-align:center; margin:14px}
  @media print{ .no-print{display:none} .doc{border:0; margin:0; max-width:none} }
</style>
</head>
<body>
<div class="no-print">
  <button class="btn btn-primary" onclick="window.print()"><?= icon('print') ?> چاپ این بل</button>
  <a class="btn" href="sales.php">بازگشت به شیت فروشات</a>
</div>

<div class="doc">
  <div class="doc-head">
    <div>
      <h1><?= e($co['name']) ?></h1>
      <div class="meta">
        نوع فعالیت: <?= e($co['activity_type']) ?><br>
        آدرس: <?= e($co['address']) ?><br>
        مدیر مالی: <?= e($co['finance_manager']) ?> — سرپرست: <?= e($co['supervisor']) ?>
      </div>
    </div>
    <div class="meta" style="text-align:left">
      شماره: <b><?= e($s['sale_no']) ?></b><br>
      تاریخ: <b><?= e(fdate($s['sale_date'], true)) ?></b><br>
      بل نمبر: <b><?= e($s['bill_no']) ?></b>
    </div>
  </div>

  <div class="doc-title">بل فروش مواد ساختمانی</div>

  <table class="doc-table">
    <tbody>
      <tr><th>نام مشتری / شرکت</th><td><?= e($s['customer_name']) ?></td></tr>
      <tr><th>کد مشتری</th><td><?= e($s['customer_code']) ?></td></tr>
      <tr><th>شخص رابط / تماس</th><td><?= e($s['contact_person']) ?> — <?= e($s['customer_phone']) ?></td></tr>
      <tr><th>آدرس مشتری</th><td><?= e($s['customer_address']) ?></td></tr>
      <tr><th>مقصد</th><td><?= e($s['destination']) ?></td></tr>
      <tr><th>نام دریور</th><td><?= e($s['driver_name']) ?></td></tr>
      <tr><th>پلیت موتر</th><td><?= e($s['vehicle_plate']) ?></td></tr>
      <tr><th>نوع مواد</th><td><?= e($s['material_name']) ?></td></tr>
      <tr><th>متراژ</th><td><?= e(fmt($s['volume'], 2)) ?> متر مکعب</td></tr>
      <tr><th>قیمت فی متر</th><td><?= e(fmt($s['unit_price'])) ?> افغانی</td></tr>
      <tr><th>کرایه فی متر</th><td><?= e(fmt($s['freight'])) ?> افغانی (به ازای هر متر مکعب)</td></tr>
      <tr><th>مجموع کرایه</th><td><?= e(fmt($s['volume'] * $s['freight'])) ?> افغانی = <?= e(fmt($s['volume'], 2)) ?> متر × <?= e(fmt($s['freight'])) ?></td></tr>
      <tr><th>نوع پرداخت</th><td><?= e($s['payment_type']) ?></td></tr>
      <tr><th>توضیحات</th><td><?= e($s['notes']) ?></td></tr>
    </tbody>
  </table>

  <div class="amount-box">
    <b>مجموع قیمت و کرایه:</b> <?= e(fmt($s['total_amount'])) ?> افغانی
    &nbsp;&nbsp;|&nbsp;&nbsp; ( <?= e(fmt($s['volume'], 2)) ?> متر × <?= e(fmt($s['unit_price'])) ?> ) + ( <?= e(fmt($s['volume'], 2)) ?> متر × <?= e(fmt($s['freight'])) ?> کرایه فی متر )
  </div>

  <div class="sig">
    <div>امضای مشتری</div>
    <div>امضای دریور</div>
    <div>امضای مسئول فروش</div>
    <div>مهر شرکت</div>
  </div>
</div>
</body>
</html>
