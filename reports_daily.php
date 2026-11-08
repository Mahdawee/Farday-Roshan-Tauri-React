<?php
/**
 * راپور روزانه — شماره، تاریخ، فروشات قرضه، فروشات نقده، رسیدات، مصارف،
 * پرداخت معاشات، مجموع مصارف، موجودی دخل
 */
require_once __DIR__ . '/app/bootstrap.php';
app_boot();
require_login();

$from = parse_date_input(get('from')) ?: date('Y-m-d', strtotime('-13 day'));
$to   = parse_date_input(get('to'))   ?: today_ymd();
if ($from > $to) {
    [$from, $to] = [$to, $from];
}
$rows = report_daily($from, $to);

// -------- خروجی اکسل --------
if (get('export')) {
    $out = [['شماره', 'تاریخ', 'روز', 'فروشات نقده', 'فروشات قرضه', 'مجموع فروشات', 'رسیدات',
             'مصارف افغانی', 'مصارف دالری', 'پرداخت معاشات', 'مجموع مصارف', 'موجودی دخل']];
    foreach ($rows as $i => $r) {
        $out[] = [$i + 1, fdate($r['date']), weekday_name($r['date']), round($r['sales_cash'], 2),
                  round($r['sales_credit'], 2), round($r['sales_total'], 2), round($r['receipts'], 2),
                  round($r['expenses'], 2), round($r['expenses_usd'], 2), round($r['salaries'], 2),
                  round($r['outflow'], 2), round($r['balance'], 2)];
    }
    log_activity('export', 'report_daily', null, 'خروجی CSV راپور روزانه');
    csv_output('daily-report-' . $from . '_' . $to . '.csv', $out);
}

$t = ['sales_cash' => 0, 'sales_credit' => 0, 'sales_total' => 0, 'receipts' => 0,
      'expenses' => 0, 'expenses_usd' => 0, 'salaries' => 0, 'outflow' => 0, 'volume' => 0];
foreach ($rows as $r) {
    foreach ($t as $k => $v) {
        $t[$k] += (float) ($r[$k] ?? 0);
    }
}
$openBalance = cashbox_balance(date('Y-m-d', strtotime($from . ' -1 day')));

page_header('راپور روزانه', ['actions' =>
    '<a class="btn btn-primary" href="reports_daily.php?from=' . urlencode(fdate(today_ymd())) . '&to=' . urlencode(fdate(today_ymd())) . '">امروز</a>'
  . '<a class="btn" href="' . e(url_with(['from' => fdate(date('Y-m-d', strtotime('-6 day'))), 'to' => fdate(today_ymd())])) . '">هفت روز اخیر</a>'
  . '<a class="btn" href="' . e(url_with(['from' => fdate(date('Y-m-01')), 'to' => fdate(today_ymd())])) . '">ماه جاری</a>'
  . '<a class="btn" href="' . e(url_with(['export' => 1])) . '">' . icon('download') . ' اکسل</a>'
  . print_button()]);
?>
<form method="get" class="filters no-print">
  <div class="filter-item"><label>از تاریخ</label><input type="text" name="from" class="date-input" value="<?= e(fdate($from)) ?>"></div>
  <div class="filter-item"><label>تا تاریخ</label><input type="text" name="to" class="date-input" value="<?= e(fdate($to)) ?>"></div>
  <div class="filter-item btn-cell"><button class="btn" type="submit">نمایش راپور</button>
    <a class="btn btn-outline" href="reports_daily.php">بازنشانی</a></div>
</form>

<div class="print-title">
  <h2><?= e(print_header_text()) ?></h2>
  <div class="sub">راپور روزانه از <?= e(fdate($from)) ?> تا <?= e(fdate($to)) ?> — تاریخ چاپ: <?= e(fdate(today_ymd())) ?></div>
</div>

<div class="stats no-print">
  <?php
    stat_card('فروشات نقده این بازه', fmt_afn($t['sales_cash']), '', 'good');
    stat_card('فروشات قرضه این بازه', fmt_afn($t['sales_credit']), '', 'warn');
    stat_card('کل رسیدات', fmt_afn($t['receipts']), '', 'good');
    stat_card('مجموع مصارف (با معاشات)', fmt_afn($t['outflow']),
        'مصارف: ' . fmt($t['expenses']) . ' | معاشات: ' . fmt($t['salaries']), 'bad');
    stat_card('موجودی دخل (آخر بازه)', fmt_afn(cashbox_balance($to)), 'موجودی ابتدای بازه: ' . fmt($openBalance), 'info');
    stat_card('متراژ فروش رفته', fmt($t['volume'], 2) . ' متر مکعب');
  ?>
</div>

<div class="card">
  <div class="card-head"><h2>جدول راپور روزانه</h2>
    <span class="muted">روش محاسبه موجودی دخل: <?= e(cashbox_mode() === 'all'
        ? 'فروشات نقده + رسیدات − همه مصارف − همه معاشات' : 'فروشات نقده + رسیدات − مصارف و معاشات پرداخت‌شده از دخل') ?></span></div>
  <div class="table-wrap">
    <table class="report">
      <thead><tr>
        <th>شماره</th><th>تاریخ</th><th>روز</th>
        <th class="num">فروشات قرضه</th><th class="num">فروشات نقده</th><th class="num">مجموع فروشات</th>
        <th class="num">رسیدات</th><th class="num">مصارف</th><th class="num">مصارف دالری</th>
        <th class="num">پرداخت معاشات</th><th class="num">مجموع مصارف</th><th class="num">موجودی دخل</th>
      </tr></thead>
      <tbody>
      <?php foreach ($rows as $i => $r): ?>
        <tr>
          <td class="num"><?= fmt($i + 1) ?></td>
          <td class="nowrap"><?= e(fdate($r['date'])) ?></td>
          <td class="nowrap"><?= e(weekday_name($r['date'])) ?></td>
          <td class="num"><?= fmt($r['sales_credit']) ?></td>
          <td class="num"><?= fmt($r['sales_cash']) ?></td>
          <td class="num"><b><?= fmt($r['sales_total']) ?></b></td>
          <td class="num"><?= fmt($r['receipts']) ?></td>
          <td class="num"><?= fmt($r['expenses']) ?></td>
          <td class="num"><?= $r['expenses_usd'] > 0 ? fmt($r['expenses_usd'], 2) : '<span class="muted">—</span>' ?></td>
          <td class="num"><?= fmt($r['salaries']) ?></td>
          <td class="num"><?= fmt($r['outflow']) ?></td>
          <td class="num"><b><?= fmt($r['balance']) ?></b></td>
        </tr>
      <?php endforeach; ?>
      <?php if (!$rows): ?><tr><td colspan="12" class="empty">در این بازه معلوماتی موجود نیست.</td></tr><?php endif; ?>
      </tbody>
      <tfoot>
        <tr>
          <td colspan="3">مجموع بازه</td>
          <td class="num"><?= fmt($t['sales_credit']) ?></td>
          <td class="num"><?= fmt($t['sales_cash']) ?></td>
          <td class="num"><?= fmt($t['sales_total']) ?></td>
          <td class="num"><?= fmt($t['receipts']) ?></td>
          <td class="num"><?= fmt($t['expenses']) ?></td>
          <td class="num"><?= $t['expenses_usd'] > 0 ? fmt($t['expenses_usd'], 2) : '—' ?></td>
          <td class="num"><?= fmt($t['salaries']) ?></td>
          <td class="num"><?= fmt($t['outflow']) ?></td>
          <td class="num"><?= fmt(cashbox_balance($to)) ?></td>
        </tr>
      </tfoot>
    </table>
  </div>
  <p class="muted" style="font-size:12.5px">
    «موجودی دخل» پایان هر روز نشان داده شده است. موجودی ابتدای این بازه: <b><?= fmt($openBalance) ?></b> افغانی.
    <?php if ($t['expenses_usd'] > 0): ?>
      مجموع مصارف دالری این بازه: <b><?= fmt($t['expenses_usd'], 2) ?> دالر</b> (جداگانه نگهداری می‌شود و در موجودی دخل شامل نیست).
    <?php endif; ?>
  </p>
  <div class="sig"><div>امضای محاسب</div><div>امضای مدیر مالی</div><div>امضای مدیر شرکت</div></div>
</div>
<?php page_footer(); ?>
