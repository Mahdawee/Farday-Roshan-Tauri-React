<?php
/**
 * راپور ماهانه — ماه/سال، فروشات نقده، فروشات قرضه، کل رسیدات،
 * کل معاشات، کل مصارف، سود خالص، زیان، توضیحات
 */
require_once __DIR__ . '/app/bootstrap.php';
app_boot();
require_login();

// -------- ذخیره توضیحات --------
if ($_SERVER['REQUEST_METHOD'] === 'POST' && post('action') === 'save_note') {
    csrf_check();
    $period = (string) post('period');
    if (preg_match('/^\d{4}-\d{2}$/', $period)) {
        save_report_note('monthly', $period, (string) post('notes', ''));
        log_activity('update', 'report_notes', $period, 'توضیحات راپور ماهانه');
        flash('توضیحات ذخیره شد.', 'success');
    }
    redirect('reports_monthly.php?year=' . urlencode((string) post('year')));
}

$year = (int) get('year', cal_year());
$rows = report_monthly($year);

// -------- خروجی اکسل --------
if (get('export')) {
    $out = [['شماره', 'ماه/سال', 'از', 'تا', 'فروشات نقده', 'فروشات قرضه', 'کل فروشات', 'متراژ',
             'کل رسیدات', 'کل معاشات', 'کل مصارف', 'مصارف دالری', 'مجموع مصارف', 'سود خالص', 'زیان', 'توضیحات']];
    foreach ($rows as $i => $r) {
        $out[] = [$i + 1, $r['year'] . '-' . $r['month'], fdate($r['from']), fdate($r['to']),
                  round($r['sales_cash'], 2), round($r['sales_credit'], 2), round($r['sales_total'], 2),
                  round($r['volume'], 2), round($r['receipts'], 2), round($r['salaries'], 2),
                  round($r['expenses'], 2), round($r['expenses_usd'], 2), round($r['outflow'], 2),
                  round($r['profit'], 2), round($r['loss'], 2), $r['notes']];
    }
    log_activity('export', 'report_monthly', null, 'خروجی CSV راپور ماهانه');
    csv_output('monthly-report-' . $year . '.csv', $out);
}

$t = ['sales_cash' => 0, 'sales_credit' => 0, 'sales_total' => 0, 'volume' => 0, 'receipts' => 0,
      'salaries' => 0, 'expenses' => 0, 'expenses_usd' => 0, 'outflow' => 0, 'profit' => 0, 'loss' => 0];
foreach ($rows as $r) {
    foreach ($t as $k => $v) {
        $t[$k] += (float) $r[$k];
    }
}
$netYear = $t['profit'] - $t['loss'];

page_header('راپور ماهانه سال ' . digit_style((string) $year), ['actions' =>
    '<a class="btn btn-primary" href="reports_monthly.php">سال جاری</a>'
  . '<a class="btn" href="' . e(url_with(['year' => $year - 1])) . '">سال قبل</a>'
  . '<a class="btn" href="' . e(url_with(['year' => $year + 1])) . '">سال بعد</a>'
  . '<a class="btn" href="' . e(url_with(['export' => 1])) . '">' . icon('download') . ' اکسل</a>'
  . print_button()]);
?>
<form method="get" class="filters no-print">
  <div class="filter-item"><label>سال</label><input type="text" name="year" value="<?= e((string) $year) ?>"></div>
  <div class="filter-item btn-cell"><button class="btn" type="submit">نمایش</button></div>
</form>

<div class="print-title">
  <h2><?= e(print_header_text()) ?></h2>
  <div class="sub">راپور ماهانه سال <?= e(digit_style((string) $year)) ?> (تقویم <?= cal_mode() === 'shamsi' ? 'هجری شمسی' : 'میلادی' ?>) — تاریخ چاپ: <?= e(fdate(today_ymd())) ?></div>
</div>

<div class="stats no-print">
  <?php
    stat_card('کل فروشات سال', fmt_afn($t['sales_total']), 'نقده: ' . fmt($t['sales_cash']) . ' | قرضه: ' . fmt($t['sales_credit']), 'good');
    stat_card('کل رسیدات سال', fmt_afn($t['receipts']), 'پول وصول‌شده از مشتریان');
    stat_card('کل مصارف سال', fmt_afn($t['expenses']), 'معاشات جداگانه: ' . fmt($t['salaries']), 'warn');
    stat_card('کل معاشات سال', fmt_afn($t['salaries']), 'مجموع پرداخت‌ها', 'warn');
    stat_card($netYear >= 0 ? 'سود خالص سال' : 'زیان سال', fmt_afn(abs($netYear)),
        'کل فروشات − (مصارف + معاشات)', $netYear >= 0 ? 'good' : 'bad');
    stat_card('متراژ فروش سال', fmt($t['volume'], 2) . ' متر مکعب');
  ?>
</div>

<div class="card">
  <div class="card-head"><h2>جدول راپور ماهانه</h2><span class="muted">سود خالص = کل فروشات − (کل مصارف + کل معاشات)</span></div>
  <div class="table-wrap">
    <table class="report">
      <thead><tr>
        <th>شماره</th><th>ماه / سال</th>
        <th class="num">فروشات نقده</th><th class="num">فروشات قرضه</th><th class="num">کل فروشات</th>
        <th class="num">متراژ</th><th class="num">کل رسیدات</th><th class="num">کل معاشات</th>
        <th class="num">کل مصارف</th><th class="num">مصارف دالری</th><th class="num">مجموع مصارف</th>
        <th class="num">سود خالص</th><th class="num">زیان</th><th>توضیحات</th>
      </tr></thead>
      <tbody>
      <?php foreach ($rows as $i => $r): ?>
        <tr>
          <td class="num"><?= fmt($i + 1) ?></td>
          <td class="nowrap"><b><?= e(fmonth($r['year'], $r['month'])) ?></b></td>
          <td class="num"><?= fmt($r['sales_cash']) ?></td>
          <td class="num"><?= fmt($r['sales_credit']) ?></td>
          <td class="num"><b><?= fmt($r['sales_total']) ?></b></td>
          <td class="num"><?= fmt($r['volume'], 2) ?></td>
          <td class="num"><?= fmt($r['receipts']) ?></td>
          <td class="num"><?= fmt($r['salaries']) ?></td>
          <td class="num"><?= fmt($r['expenses']) ?></td>
          <td class="num"><?= $r['expenses_usd'] > 0 ? fmt($r['expenses_usd'], 2) : '<span class="muted">—</span>' ?></td>
          <td class="num"><?= fmt($r['outflow']) ?></td>
          <td class="num t-pos"><b><?= $r['profit'] > 0 ? fmt($r['profit']) : '—' ?></b></td>
          <td class="num t-neg"><b><?= $r['loss'] > 0 ? fmt($r['loss']) : '—' ?></b></td>
          <td style="min-width:180px">
            <?php if (is_admin() || is_logged_in()): ?>
              <form method="post" class="no-print" style="display:flex;gap:4px">
                <?= csrf_field() ?>
                <input type="hidden" name="action" value="save_note">
                <input type="hidden" name="period" value="<?= e(sprintf('%04d-%02d', $r['year'], $r['month'])) ?>">
                <input type="hidden" name="year" value="<?= $year ?>">
                <input type="text" name="notes" value="<?= e($r['notes']) ?>" placeholder="توضیحات ..." style="min-width:120px">
                <button class="btn btn-sm" type="submit" title="ذخیره"><?= icon('save', 14) ?></button>
              </form>
            <?php endif; ?>
          </td>
        </tr>
      <?php endforeach; ?>
      </tbody>
      <tfoot>
        <tr>
          <td colspan="2">مجموع سال <?= e(digit_style((string) $year)) ?></td>
          <td class="num"><?= fmt($t['sales_cash']) ?></td>
          <td class="num"><?= fmt($t['sales_credit']) ?></td>
          <td class="num"><?= fmt($t['sales_total']) ?></td>
          <td class="num"><?= fmt($t['volume'], 2) ?></td>
          <td class="num"><?= fmt($t['receipts']) ?></td>
          <td class="num"><?= fmt($t['salaries']) ?></td>
          <td class="num"><?= fmt($t['expenses']) ?></td>
          <td class="num"><?= $t['expenses_usd'] > 0 ? fmt($t['expenses_usd'], 2) : '—' ?></td>
          <td class="num"><?= fmt($t['outflow']) ?></td>
          <td class="num"><?= fmt($t['profit']) ?></td>
          <td class="num"><?= fmt($t['loss']) ?></td>
          <td><?= $netYear >= 0 ? 'سود سال: ' . fmt($netYear) : 'زیان سال: ' . fmt(-$netYear) ?></td>
        </tr>
      </tfoot>
    </table>
  </div>
  <div class="sig"><div>امضای محاسب</div><div>امضای مدیر مالی</div><div>امضای مدیر شرکت</div></div>
</div>

<div class="card no-print">
  <h2>مقایسه ماه‌ها</h2>
  <p class="muted">نمودار مقایسه فروشات و مجموع مصارف ماه‌های سال <?= e(digit_style((string) $year)) ?></p>
  <?php
    $max = 1;
    foreach ($rows as $r) {
        $max = max($max, (float) $r['sales_total'], (float) $r['outflow']);
    }
  ?>
  <div class="table-wrap" style="padding:10px">
    <?php foreach ($rows as $r): ?>
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:5px;font-size:12.5px">
        <div style="width:70px" class="nowrap"><?= e(month_label($r['month'])) ?></div>
        <div class="bar" style="flex:0 0 46%"><i style="width:<?= round(100 * $r['sales_total'] / $max) ?>%"></i></div>
        <div class="nowrap" style="width:90px;text-align:left"><?= fmt($r['sales_total']) ?></div>
        <div class="bar bad" style="flex:0 0 30%"><i style="width:<?= round(100 * $r['outflow'] / $max) ?>%"></i></div>
        <div class="nowrap" style="width:90px;text-align:left"><?= fmt($r['outflow']) ?></div>
      </div>
    <?php endforeach; ?>
    <p class="muted" style="font-size:12px;margin-top:8px">رنگ سبز: کل فروشات ماه — رنگ سرخ: مجموع مصارف و معاشات ماه</p>
  </div>
</div>
<?php page_footer(); ?>
