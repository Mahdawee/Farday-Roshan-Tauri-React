<?php
/**
 * راپور سالانه — سال مالی، کل فروشات، کل مصارف، سود، زیان، توضیحات
 */
require_once __DIR__ . '/app/bootstrap.php';
app_boot();
require_login();

// -------- ذخیره توضیحات --------
if ($_SERVER['REQUEST_METHOD'] === 'POST' && post('action') === 'save_note') {
    csrf_check();
    $period = (string) post('period');
    if (preg_match('/^\d{4}$/', $period)) {
        save_report_note('yearly', $period, (string) post('notes', ''));
        log_activity('update', 'report_notes', $period, 'توضیحات راپور سالانه');
        flash('توضیحات ذخیره شد.', 'success');
    }
    redirect('reports_yearly.php');
}

$rows = report_yearly();

if (get('export')) {
    $out = [['سال مالی', 'از تاریخ', 'تا تاریخ', 'کل فروشات', 'فروشات نقده', 'فروشات قرضه', 'کل رسیدات',
             'کل معاشات', 'کل مصارف', 'مصارف دالری', 'مجموع مصارف', 'سود', 'زیان', 'متراژ', 'توضیحات']];
    foreach ($rows as $r) {
        $out[] = [$r['year'], fdate($r['from']), fdate($r['to']), round($r['sales_total'], 2),
                  round($r['sales_cash'], 2), round($r['sales_credit'], 2), round($r['receipts'], 2),
                  round($r['salaries'], 2), round($r['expenses'], 2), round($r['expenses_usd'], 2),
                  round($r['outflow'], 2), round($r['profit'], 2), round($r['loss'], 2),
                  round($r['volume'], 2), $r['notes']];
    }
    log_activity('export', 'report_yearly', null, 'خروجی CSV راپور سالانه');
    csv_output('yearly-report.csv', $out);
}

$t = ['sales_total' => 0, 'sales_cash' => 0, 'sales_credit' => 0, 'receipts' => 0, 'salaries' => 0,
      'expenses' => 0, 'expenses_usd' => 0, 'outflow' => 0, 'profit' => 0, 'loss' => 0, 'volume' => 0];
foreach ($rows as $r) {
    foreach ($t as $k => $v) {
        $t[$k] += (float) $r[$k];
    }
}

page_header('راپور سالانه', ['actions' =>
    '<a class="btn" href="' . e(url_with(['export' => 1])) . '">' . icon('download') . ' اکسل</a>' . print_button()]);
?>
<div class="print-title">
  <h2><?= e(print_header_text()) ?></h2>
  <div class="sub">راپور سالانه (سال مالی از ماه <?= e(month_label((int) setting('fiscal_start_month', 1))) ?>) — تاریخ چاپ: <?= e(fdate(today_ymd())) ?></div>
</div>

<div class="stats no-print">
  <?php
    stat_card('سال جاری مالی', digit_style((string) cal_year()), 'تقویم: ' . (cal_mode() === 'shamsi' ? 'هجری شمسی' : 'میلادی'));
    stat_card('کل فروشات همه سال‌ها', fmt_afn($t['sales_total']));
    stat_card('کل مصارف همه سال‌ها', fmt_afn($t['outflow']), 'مصارف: ' . fmt($t['expenses']) . ' | معاشات: ' . fmt($t['salaries']));
    stat_card('مجموع سود ثبت‌شده', fmt_afn($t['profit']), 'مجموع زیان: ' . fmt($t['loss']), 'good');
    stat_card('متراژ کل فروش', fmt($t['volume'], 2) . ' متر مکعب');
  ?>
</div>

<div class="card">
  <div class="card-head"><h2>جدول راپور سالانه</h2>
    <span class="muted">سود/زیان = کل فروشات − (کل مصارف + کل معاشات)</span></div>
  <div class="table-wrap">
    <table class="report">
      <thead><tr>
        <th>شماره</th><th>سال مالی</th><th>از تاریخ</th><th>تا تاریخ</th>
        <th class="num">کل فروشات</th><th class="num">فروشات نقده</th><th class="num">فروشات قرضه</th>
        <th class="num">کل رسیدات</th><th class="num">کل مصارف</th><th class="num">کل معاشات</th>
        <th class="num">مجموع مصارف</th><th class="num">سود</th><th class="num">زیان</th><th class="num">متراژ</th>
        <th>توضیحات</th>
      </tr></thead>
      <tbody>
      <?php foreach ($rows as $i => $r): ?>
        <tr>
          <td class="num"><?= fmt($i + 1) ?></td>
          <td class="nowrap"><b><?= e(digit_style((string) $r['year'])) ?></b></td>
          <td class="nowrap"><?= e(fdate($r['from'])) ?></td>
          <td class="nowrap"><?= e(fdate($r['to'])) ?></td>
          <td class="num"><b><?= fmt($r['sales_total']) ?></b></td>
          <td class="num"><?= fmt($r['sales_cash']) ?></td>
          <td class="num"><?= fmt($r['sales_credit']) ?></td>
          <td class="num"><?= fmt($r['receipts']) ?></td>
          <td class="num"><?= fmt($r['expenses']) ?></td>
          <td class="num"><?= fmt($r['salaries']) ?></td>
          <td class="num"><?= fmt($r['outflow']) ?></td>
          <td class="num t-pos"><b><?= $r['profit'] > 0 ? fmt($r['profit']) : '—' ?></b></td>
          <td class="num t-neg"><b><?= $r['loss'] > 0 ? fmt($r['loss']) : '—' ?></b></td>
          <td class="num"><?= fmt($r['volume'], 2) ?></td>
          <td style="min-width:170px">
            <form method="post" class="no-print" style="display:flex;gap:4px">
              <?= csrf_field() ?>
              <input type="hidden" name="action" value="save_note">
              <input type="hidden" name="period" value="<?= e((string) $r['year']) ?>">
              <input type="text" name="notes" value="<?= e($r['notes']) ?>" placeholder="توضیحات سال ...">
              <button class="btn btn-sm" type="submit"><?= icon('save', 14) ?></button>
            </form>
          </td>
        </tr>
      <?php endforeach; ?>
      <?php if (!$rows): ?><tr><td colspan="15" class="empty">معلوماتی ثبت نشده است.</td></tr><?php endif; ?>
      </tbody>
      <tfoot>
        <tr>
          <td colspan="4">مجموع</td>
          <td class="num"><?= fmt($t['sales_total']) ?></td>
          <td class="num"><?= fmt($t['sales_cash']) ?></td>
          <td class="num"><?= fmt($t['sales_credit']) ?></td>
          <td class="num"><?= fmt($t['receipts']) ?></td>
          <td class="num"><?= fmt($t['expenses']) ?></td>
          <td class="num"><?= fmt($t['salaries']) ?></td>
          <td class="num"><?= fmt($t['outflow']) ?></td>
          <td class="num"><?= fmt($t['profit']) ?></td>
          <td class="num"><?= fmt($t['loss']) ?></td>
          <td class="num"><?= fmt($t['volume'], 2) ?></td>
          <td></td>
        </tr>
      </tfoot>
    </table>
  </div>
  <div class="sig"><div>امضای محاسب</div><div>امضای مدیر مالی</div><div>امضای مدیر شرکت</div></div>
</div>
<?php page_footer(); ?>
