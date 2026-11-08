<?php
/**
 * راپورهای دیگر: باقی مانده بدهی مشتریان، کارت حساب، فروشات به نوع مواد و مشتری،
 * مصارف به نوع و پرداخت کننده، خلاصه معاشات و حضور و غیاب
 */
require_once __DIR__ . '/app/bootstrap.php';
app_boot();
require_login();

$tab  = get('tab', 'balances');
$from = parse_date_input(get('from')) ?: date('Y-m-d', strtotime('-1 month'));
$to   = parse_date_input(get('to'))   ?: today_ymd();
$export = (bool) get('export');

if ($export) {
    reports_other_export($tab, $from, $to);
}

$tabs = [
    'balances'   => 'باقی مانده بدهی مشتریان',
    'statement'  => 'کارت حساب مشتری',
    'materials'  => 'فروشات به نوع مواد',
    'custsales'  => 'فروشات به مشتری',
    'expenses'   => 'مصارف به نوع و پرداخت کننده',
    'salaries'   => 'خلاصه معاشات',
    'attendance' => 'خلاصه حضور و غیاب',
    'cashbox'    => 'حرکت دخل',
];

/** خروجی اکسل — قبل از هر خروجی HTML اجرا می‌شود */
function reports_other_export(string $tab, string $from, string $to): void
{
    switch ($tab) {
        case 'balances':
            $rows = customer_balances(false);
            $out = [['کد مشتری', 'نام مشتری / شرکت', 'شخص رابط', 'شماره تماس', 'باقی مانده بدهی', 'مجموع فروشات']];
            foreach ($rows as $r) {
                $out[] = [$r['code'], $r['name'], $r['contact_person'], $r['phone'],
                          round($r['balance'], 2), round((float) $r['credit_sales'] + (float) $r['cash_sales'], 2)];
            }
            csv_output('customer-balances.csv', $out);
            break;
        case 'statement':
            $cid = (int) get('customer_id');
            $ledger = $cid ? customer_ledger($cid, $from, $to) : null;
            if ($ledger && $ledger['customer']) {
                $out = [['تاریخ', 'نوع', 'شرح', 'بدهی (فروش)', 'رسید', 'باقی مانده']];
                $out[] = ['', 'بدهی قبلی', 'موجودی پیش از بازه', '', '', round($ledger['opening'], 2)];
                foreach ($ledger['rows'] as $r) {
                    $out[] = [fdate($r['date']), $r['type'], $r['desc'], round($r['debit'], 2), round($r['credit'], 2), round($r['balance'], 2)];
                }
                csv_output('statement-' . $ledger['customer']['code'] . '.csv', $out);
            }
            break;
        case 'materials':
            $out = [['نوع مواد', 'تعداد فروش', 'متراژ', 'مجموع', 'نقده', 'قرضه']];
            foreach (sales_by_material($from, $to) as $r) {
                $out[] = [$r['material'], $r['cnt'], round($r['volume'], 2), round($r['total'], 2), round($r['cash'], 2), round($r['credit'], 2)];
            }
            csv_output('sales-by-material.csv', $out);
            break;
        case 'custsales':
            $out = [['مشتری', 'تعداد فروش', 'متراژ', 'مجموع', 'نقده', 'قرضه']];
            foreach (sales_by_customer($from, $to) as $r) {
                $out[] = [$r['customer'], $r['cnt'], round($r['volume'], 2), round($r['total'], 2), round($r['cash'], 2), round($r['credit'], 2)];
            }
            csv_output('sales-by-customer.csv', $out);
            break;
        case 'expenses':
            $out = [['راپور', 'گروه', 'تعداد', 'مبلغ افغانی', 'مبلغ دالری']];
            foreach (expenses_by_type($from, $to) as $r) {
                $out[] = ['انواع مصرف - مربوط', $r['etype'], $r['cnt'], round($r['afn'], 2), round($r['usd'], 2)];
            }
            foreach (expenses_by_payer($from, $to) as $r) {
                $out[] = ['پرداخت کننده', $r['payer'] . ' (' . $r['kind'] . ')', $r['cnt'], round($r['afn'], 2), round($r['usd'], 2)];
            }
            csv_output('expenses-report.csv', $out);
            break;
        case 'salaries':
            $out = [['کد کارمند', 'نام', 'وظیفه', 'تعداد پرداخت', 'معاش ثابت', 'پاداش', 'جریمه', 'اضافه کاری', 'مجموع پرداخت']];
            foreach (salary_summary($from, $to) as $r) {
                $out[] = [$r['emp_code'], $r['full_name'], $r['job_title'], $r['months'], round($r['base'], 2),
                          round($r['bonus'], 2), round($r['fine'], 2), round($r['overtime'], 2), round($r['total'], 2)];
            }
            csv_output('salaries-summary.csv', $out);
            break;
        case 'attendance':
            $out = [['کد کارمند', 'نام', 'وظیفه', 'حاضر', 'غایب', 'رخصت', 'مریض', 'رخصتی رسمی', 'اضافه کاری']];
            foreach (attendance_summary($from, $to) as $r) {
                $out[] = [$r['emp_code'], $r['full_name'], $r['job_title'], $r['present'], $r['absent'],
                          $r['leave_'], $r['sick'], $r['official'], round($r['overtime'], 2)];
            }
            csv_output('attendance-summary.csv', $out);
            break;
        default:
            $out = [['تاریخ', 'فروشات نقده', 'رسیدات', 'مصارف', 'معاشات', 'مجموع مصارف', 'موجودی دخل']];
            foreach (report_daily($from, $to) as $r) {
                $out[] = [fdate($r['date']), round($r['sales_cash'], 2), round($r['receipts'], 2), round($r['expenses'], 2),
                          round($r['salaries'], 2), round($r['outflow'], 2), round($r['balance'], 2)];
            }
            csv_output('cashbox-flow.csv', $out);
    }
    exit;
}

function range_form(string $tab, string $from, string $to): void
{ ?>
  <form method="get" class="filters no-print">
    <input type="hidden" name="tab" value="<?= e($tab) ?>">
    <div class="filter-item"><label>از تاریخ</label><input type="text" name="from" class="date-input" value="<?= e(fdate($from)) ?>"></div>
    <div class="filter-item"><label>تا تاریخ</label><input type="text" name="to" class="date-input" value="<?= e(fdate($to)) ?>"></div>
    <div class="filter-item btn-cell">
      <button class="btn" type="submit">نمایش</button>
      <a class="btn btn-outline" href="<?= e(url_with(['from' => null, 'to' => null, 'export' => null])) ?>">بازنشانی</a>
    </div>
  </form>
<?php }

page_header('راپورهای دیگر', ['actions' => '<a class="btn" href="' . e(url_with(['export' => 1])) . '">' . icon('download') . ' خروجی اکسل این راپور</a>' . print_button()]);
?>
<div class="tabs no-print">
  <?php foreach ($tabs as $k => $label): ?>
    <a class="<?= $tab === $k ? 'active' : '' ?>" href="<?= e(url_with(['tab' => $k, 'export' => null])) ?>"><?= e($label) ?></a>
  <?php endforeach; ?>
</div>

<?php
// ===========================================================================
if ($tab === 'balances') {
    $rows = customer_balances(false);
    $debtors = array_values(array_filter($rows, fn($r) => $r['balance'] > 0.004));
    ?>
    <div class="print-title"><h2><?= e(print_header_text()) ?></h2>
      <div class="sub">راپور باقی مانده بدهی مشتریان — تاریخ چاپ: <?= e(fdate(today_ymd())) ?></div></div>
    <div class="stats no-print">
      <?php
        stat_card('مجموع باقی مانده بدهی', fmt_afn(sum_col($debtors, 'balance')), 'از ' . fmt(count($debtors)) . ' مشتری', 'bad');
        stat_card('مجموع فروشات قرضه', fmt_afn(sum_col($rows, 'credit_sales')));
        stat_card('مجموع رسیدات وصول‌شده', fmt_afn(sum_col($rows, 'paid')), '', 'good');
      ?>
    </div>
    <div class="card">
      <div class="card-head"><h2>باقی مانده بدهی مشتریان</h2>
        <span class="muted">باقی مانده = بدهی اولیه + فروشات قرضه − رسیدات</span></div>
      <div class="table-wrap">
        <table class="report">
          <thead><tr><th>شماره</th><th>کد مشتری</th><th>نام مشتری / شرکت</th><th>شخص رابط</th><th>شماره تماس</th>
            <th class="num">بدهی اولیه</th><th class="num">فروشات قرضه</th><th class="num">رسیدات</th>
            <th class="num">باقی مانده بدهی</th><th>توضیحات</th><th class="no-print">عملیات</th></tr></thead>
          <tbody>
          <?php $i = 0; $tc = ['o' => 0, 'c' => 0, 'p' => 0, 'b' => 0];
          foreach ($rows as $r):
              $i++;
              $tc['o'] += (float) $r['opening_balance']; $tc['c'] += (float) $r['credit_sales'];
              $tc['p'] += (float) $r['paid']; $tc['b'] += (float) $r['balance'];
              if (abs($r['balance']) < 0.005 && (float) $r['credit_sales'] == 0 && (float) $r['opening_balance'] == 0) { continue; } ?>
            <tr>
              <td class="num"><?= fmt($i) ?></td>
              <td class="nowrap"><?= e($r['code']) ?></td>
              <td><?= e($r['name']) ?></td>
              <td><?= e($r['contact_person']) ?></td>
              <td class="nowrap"><?= e($r['phone']) ?></td>
              <td class="num"><?= fmt($r['opening_balance']) ?></td>
              <td class="num"><?= fmt($r['credit_sales']) ?></td>
              <td class="num"><?= fmt($r['paid']) ?></td>
              <td class="num"><b class="<?= $r['balance'] > 0 ? 't-neg' : 't-pos' ?>"><?= fmt($r['balance']) ?></b></td>
              <td><?= e(str_excerpt($r['notes'], 24)) ?></td>
              <td class="no-print">
                <a class="mini" href="<?= e(url_with(['tab' => 'statement', 'customer_id' => $r['id'], 'export' => null])) ?>"><?= icon('back', 13) ?> کارت حساب</a>
              </td>
            </tr>
          <?php endforeach; ?>
          <?php if (!$rows): ?><tr><td colspan="11" class="empty">مشتری ثبت نشده است.</td></tr><?php endif; ?>
          </tbody>
          <tfoot><tr><td colspan="5">مجموع</td>
            <td class="num"><?= fmt($tc['o']) ?></td><td class="num"><?= fmt($tc['c']) ?></td>
            <td class="num"><?= fmt($tc['p']) ?></td><td class="num"><?= fmt($tc['b']) ?></td>
            <td colspan="2"></td></tr></tfoot>
        </table>
      </div>
    </div>
    <?php
}

// ===========================================================================
elseif ($tab === 'statement') {
    $cid = (int) get('customer_id');
    $customers = Db::all('SELECT id, code, name FROM customers ORDER BY name');
    $ledger = $cid ? customer_ledger($cid, $from, $to) : null;
    if ($export && $ledger) {
        $out = [['تاریخ', 'نوع', 'شرح', 'بدهی (فروش)', 'رسید', 'باقی مانده']];
        $out[] = ['', 'بدهی قبلی', 'موجودی پیش از بازه', '', '', round($ledger['opening'], 2)];
        foreach ($ledger['rows'] as $r) {
            $out[] = [fdate($r['date']), $r['type'], $r['desc'], round($r['debit'], 2), round($r['credit'], 2), round($r['balance'], 2)];
        }
        csv_output('statement-' . $ledger['customer']['code'] . '.csv', $out);
    }
    ?>
    <form method="get" class="filters no-print">
      <input type="hidden" name="tab" value="statement">
      <div class="filter-item grow"><label>مشتری</label>
        <select name="customer_id">
          <option value="">— انتخاب مشتری —</option>
          <?php foreach ($customers as $c): ?>
            <option value="<?= (int) $c['id'] ?>" <?= $cid === (int) $c['id'] ? 'selected' : '' ?>>
              <?= e($c['name'] . ' (' . $c['code'] . ')') ?></option>
          <?php endforeach; ?>
        </select></div>
      <div class="filter-item"><label>از تاریخ</label><input type="text" name="from" class="date-input" value="<?= e(fdate($from)) ?>"></div>
      <div class="filter-item"><label>تا تاریخ</label><input type="text" name="to" class="date-input" value="<?= e(fdate($to)) ?>"></div>
      <div class="filter-item btn-cell"><button class="btn" type="submit">نمایش</button></div>
    </form>
    <?php if ($ledger && $ledger['customer']):
        $c = $ledger['customer']; ?>
      <div class="print-title"><h2><?= e(print_header_text()) ?></h2>
        <div class="sub">کارت حساب مشتری: <?= e($c['name']) ?> — از <?= e(fdate($from)) ?> تا <?= e(fdate($to)) ?></div></div>
      <div class="card">
        <div class="card-head"><h2>کارت حساب — <?= e($c['name']) ?> (<?= e($c['code']) ?>)</h2>
          <span class="badge <?= $ledger['balance'] > 0 ? 'badge-bad' : 'badge-ok' ?>">
            باقی مانده: <?= fmt($ledger['balance']) ?> افغانی</span></div>
        <div class="table-wrap">
          <table class="report">
            <thead><tr><th>شماره</th><th>تاریخ</th><th>نوع معامله</th><th>شرح</th>
              <th class="num">بدهی (فروش قرضه)</th><th class="num">رسید (پرداخت)</th><th class="num">باقی مانده</th><th class="no-print"></th></tr></thead>
            <tbody>
              <tr class="row-total"><td colspan="6">بدهی قبلی (قبل از <?= e(fdate($from)) ?>)</td>
                <td class="num"><?= fmt($ledger['opening']) ?></td><td class="no-print"></td></tr>
              <?php foreach ($ledger['rows'] as $i => $r): ?>
                <tr>
                  <td class="num"><?= fmt($i + 1) ?></td>
                  <td class="nowrap"><?= e(fdate($r['date'])) ?></td>
                  <td><?= e($r['type']) ?></td>
                  <td><?= e($r['desc']) ?></td>
                  <td class="num"><?= $r['debit'] > 0 ? fmt($r['debit']) : '' ?></td>
                  <td class="num"><?= $r['credit'] > 0 ? fmt($r['credit']) : '' ?></td>
                  <td class="num"><b><?= fmt($r['balance']) ?></b></td>
                  <td class="no-print"><a class="mini" href="<?= e($r['link']) ?>">مشاهده</a></td>
                </tr>
              <?php endforeach; ?>
              <?php if (!$ledger['rows']): ?><tr><td colspan="8" class="empty">در این بازه معامله‌ای ثبت نشده است.</td></tr><?php endif; ?>
            </tbody>
            <tfoot><tr><td colspan="4">مجموع بازه</td>
              <td class="num"><?= fmt(sum_col($ledger['rows'], 'debit')) ?></td>
              <td class="num"><?= fmt(sum_col($ledger['rows'], 'credit')) ?></td>
              <td class="num"><?= fmt($ledger['balance']) ?></td><td class="no-print"></td></tr></tfoot>
          </table>
        </div>
        <div class="sig"><div>امضای مشتری</div><div>امضای محاسب</div><div>امضای مدیر مالی</div></div>
      </div>
    <?php else: ?>
      <div class="alert alert-info">لطفاً یک مشتری را انتخاب کنید تا کارت حساب او نمایش داده شود.</div>
    <?php endif;
}

// ===========================================================================
elseif ($tab === 'materials') {
    $rows = sales_by_material($from, $to);
    range_form('materials', $from, $to); ?>
    <div class="print-title"><h2><?= e(print_header_text()) ?></h2>
      <div class="sub">فروشات به تفکیک نوع مواد — از <?= e(fdate($from)) ?> تا <?= e(fdate($to)) ?></div></div>
    <div class="card">
      <div class="card-head"><h2>فروشات به تفکیک نوع مواد</h2></div>
      <div class="table-wrap"><table class="report">
        <thead><tr><th>شماره</th><th>نوع مواد</th><th class="num">تعداد فروش</th><th class="num">متراژ (م³)</th>
          <th class="num">مجموع فروش</th><th class="num">نقده</th><th class="num">قرضه</th><th class="num">فیصدی از کل</th></tr></thead>
        <tbody>
        <?php $i = 0; $grand = sum_col($rows, 'total');
        foreach ($rows as $r): $i++; ?>
          <tr>
            <td class="num"><?= fmt($i) ?></td>
            <td><?= e($r['material']) ?></td>
            <td class="num"><?= fmt($r['cnt']) ?></td>
            <td class="num"><?= fmt($r['volume'], 2) ?></td>
            <td class="num"><b><?= fmt($r['total']) ?></b></td>
            <td class="num"><?= fmt($r['cash']) ?></td>
            <td class="num"><?= fmt($r['credit']) ?></td>
            <td class="num"><?= $grand > 0 ? fmt(100 * $r['total'] / $grand, 1) . '%' : '—' ?></td>
          </tr>
        <?php endforeach; ?>
        <?php if (!$rows): ?><tr><td colspan="8" class="empty">در این بازه فروشی ثبت نشده است.</td></tr><?php endif; ?>
        </tbody>
        <tfoot><tr><td colspan="2">مجموع</td><td class="num"><?= fmt(sum_col($rows, 'cnt')) ?></td>
          <td class="num"><?= fmt(sum_col($rows, 'volume'), 2) ?></td><td class="num"><?= fmt($grand) ?></td>
          <td class="num"><?= fmt(sum_col($rows, 'cash')) ?></td><td class="num"><?= fmt(sum_col($rows, 'credit')) ?></td><td></td></tr></tfoot>
      </table></div>
    </div>
    <?php
}

// ===========================================================================
elseif ($tab === 'custsales') {
    $rows = sales_by_customer($from, $to);
    range_form('custsales', $from, $to); ?>
    <div class="card">
      <div class="card-head"><h2>فروشات به تفکیک مشتری</h2></div>
      <div class="table-wrap"><table class="report">
        <thead><tr><th>شماره</th><th>مشتری</th><th class="num">تعداد فروش</th><th class="num">متراژ (م³)</th>
          <th class="num">مجموع فروش</th><th class="num">نقده</th><th class="num">قرضه</th></tr></thead>
        <tbody>
        <?php $i = 0; foreach ($rows as $r): $i++; ?>
          <tr><td class="num"><?= fmt($i) ?></td><td><?= e($r['customer']) ?></td>
            <td class="num"><?= fmt($r['cnt']) ?></td><td class="num"><?= fmt($r['volume'], 2) ?></td>
            <td class="num"><b><?= fmt($r['total']) ?></b></td>
            <td class="num"><?= fmt($r['cash']) ?></td><td class="num"><?= fmt($r['credit']) ?></td></tr>
        <?php endforeach; ?>
        <?php if (!$rows): ?><tr><td colspan="7" class="empty">در این بازه فروشی ثبت نشده است.</td></tr><?php endif; ?>
        </tbody>
        <tfoot><tr><td colspan="2">مجموع</td><td class="num"><?= fmt(sum_col($rows, 'cnt')) ?></td>
          <td class="num"><?= fmt(sum_col($rows, 'volume'), 2) ?></td><td class="num"><?= fmt(sum_col($rows, 'total')) ?></td>
          <td class="num"><?= fmt(sum_col($rows, 'cash')) ?></td><td class="num"><?= fmt(sum_col($rows, 'credit')) ?></td></tr></tfoot>
      </table></div>
    </div>
    <?php
}

// ===========================================================================
elseif ($tab === 'expenses') {
    $byType  = expenses_by_type($from, $to);
    $byPayer = expenses_by_payer($from, $to);
    range_form('expenses', $from, $to); ?>
    <div class="grid-2">
      <div class="card">
        <div class="card-head"><h2>مصارف به تفکیک انواع مصرف - مربوط</h2></div>
        <div class="table-wrap"><table class="report">
          <thead><tr><th>شماره</th><th>انواع مصرف - مربوط</th><th class="num">تعداد</th><th class="num">مبلغ افغانی</th><th class="num">مبلغ دالری</th><th class="num">فیصدی</th></tr></thead>
          <tbody>
          <?php $i = 0; $grand = sum_col($byType, 'afn'); foreach ($byType as $r): $i++; ?>
            <tr><td class="num"><?= fmt($i) ?></td><td><?= e($r['etype']) ?></td><td class="num"><?= fmt($r['cnt']) ?></td>
              <td class="num"><?= fmt($r['afn']) ?></td><td class="num"><?= $r['usd'] > 0 ? fmt($r['usd'], 2) : '—' ?></td>
              <td class="num"><?= $grand > 0 ? fmt(100 * $r['afn'] / $grand, 1) . '%' : '—' ?></td></tr>
          <?php endforeach; ?>
          <?php if (!$byType): ?><tr><td colspan="6" class="empty">مصرفی ثبت نشده است.</td></tr><?php endif; ?>
          </tbody>
          <tfoot><tr><td colspan="2">مجموع</td><td class="num"><?= fmt(sum_col($byType, 'cnt')) ?></td>
            <td class="num"><?= fmt($grand) ?></td><td class="num"><?= fmt(sum_col($byType, 'usd'), 2) ?></td><td></td></tr></tfoot>
        </table></div>
      </div>
      <div class="card">
        <div class="card-head"><h2>مصارف به تفکیک پرداخت کننده</h2></div>
        <div class="table-wrap"><table class="report">
          <thead><tr><th>شماره</th><th>پرداخت کننده</th><th>نوع</th><th class="num">تعداد</th>
            <th class="num">مبلغ افغانی</th><th class="num">مبلغ دالری</th></tr></thead>
          <tbody>
          <?php $i = 0; foreach ($byPayer as $r): $i++; ?>
            <tr><td class="num"><?= fmt($i) ?></td><td><?= e($r['payer']) ?></td><td><?= e($r['kind']) ?></td>
              <td class="num"><?= fmt($r['cnt']) ?></td><td class="num"><?= fmt($r['afn']) ?></td>
              <td class="num"><?= $r['usd'] > 0 ? fmt($r['usd'], 2) : '—' ?></td></tr>
          <?php endforeach; ?>
          <?php if (!$byPayer): ?><tr><td colspan="6" class="empty">مصرفی ثبت نشده است.</td></tr><?php endif; ?>
          </tbody>
          <tfoot><tr><td colspan="3">مجموع</td><td class="num"><?= fmt(sum_col($byPayer, 'cnt')) ?></td>
            <td class="num"><?= fmt(sum_col($byPayer, 'afn')) ?></td><td class="num"><?= fmt(sum_col($byPayer, 'usd'), 2) ?></td></tr></tfoot>
        </table></div>
      </div>
    </div>
    <?php
}

// ===========================================================================
elseif ($tab === 'salaries') {
    $rows = salary_summary($from, $to);
    range_form('salaries', $from, $to); ?>
    <div class="print-title"><h2><?= e(print_header_text()) ?></h2>
      <div class="sub">خلاصه معاشات از <?= e(fdate($from)) ?> تا <?= e(fdate($to)) ?></div></div>
    <div class="card">
      <div class="card-head"><h2>خلاصه معاشات کارمندان</h2></div>
      <div class="table-wrap"><table class="report">
        <thead><tr><th>شماره</th><th>کد کارمند</th><th>نام</th><th>وظیفه</th><th class="num">تعداد پرداخت</th>
          <th class="num">معاش ثابت</th><th class="num">پاداش</th><th class="num">جریمه</th><th class="num">اضافه کاری</th>
          <th class="num">مجموع پرداخت</th></tr></thead>
        <tbody>
        <?php $i = 0; foreach ($rows as $r): $i++; ?>
          <tr><td class="num"><?= fmt($i) ?></td><td class="nowrap"><?= e($r['emp_code']) ?></td>
            <td><?= e($r['full_name']) ?></td><td><?= e($r['job_title']) ?></td>
            <td class="num"><?= fmt($r['months']) ?></td><td class="num"><?= fmt($r['base']) ?></td>
            <td class="num"><?= fmt($r['bonus']) ?></td><td class="num"><?= fmt($r['fine']) ?></td>
            <td class="num"><?= fmt($r['overtime']) ?></td><td class="num"><b><?= fmt($r['total']) ?></b></td></tr>
        <?php endforeach; ?>
        <?php if (!$rows): ?><tr><td colspan="10" class="empty">در این بازه معاشی پرداخت نشده است.</td></tr><?php endif; ?>
        </tbody>
        <tfoot><tr><td colspan="5">مجموع</td><td class="num"><?= fmt(sum_col($rows, 'base')) ?></td>
          <td class="num"><?= fmt(sum_col($rows, 'bonus')) ?></td><td class="num"><?= fmt(sum_col($rows, 'fine')) ?></td>
          <td class="num"><?= fmt(sum_col($rows, 'overtime')) ?></td><td class="num"><?= fmt(sum_col($rows, 'total')) ?></td></tr></tfoot>
      </table></div>
    </div>
    <?php
}

// ===========================================================================
elseif ($tab === 'attendance') {
    $rows = attendance_summary($from, $to);
    range_form('attendance', $from, $to); ?>
    <div class="card">
      <div class="card-head"><h2>خلاصه حضور و غیاب</h2></div>
      <div class="table-wrap"><table class="report">
        <thead><tr><th>شماره</th><th>کد کارمند</th><th>نام</th><th>وظیفه</th><th class="num">حاضر</th>
          <th class="num">غایب</th><th class="num">رخصت</th><th class="num">مریض</th><th class="num">رخصتی رسمی</th>
          <th class="num">اضافه کاری</th></tr></thead>
        <tbody>
        <?php $i = 0; foreach ($rows as $r): $i++; ?>
          <tr><td class="num"><?= fmt($i) ?></td><td class="nowrap"><?= e($r['emp_code']) ?></td>
            <td><?= e($r['full_name']) ?></td><td><?= e($r['job_title']) ?></td>
            <td class="num"><?= fmt($r['present']) ?></td><td class="num"><?= fmt($r['absent']) ?></td>
            <td class="num"><?= fmt($r['leave_']) ?></td><td class="num"><?= fmt($r['sick']) ?></td>
            <td class="num"><?= fmt($r['official']) ?></td><td class="num"><?= fmt($r['overtime'], 1) ?></td></tr>
        <?php endforeach; ?>
        <?php if (!$rows): ?><tr><td colspan="10" class="empty">در این بازه حضور و غیابی ثبت نشده است.</td></tr><?php endif; ?>
        </tbody>
      </table></div>
    </div>
    <?php
}

// ===========================================================================
else {
    // حرکت دخل — مجموعه پول‌های وارد و خارج شده
    $rows = report_daily($from, $to);
    $open = cashbox_balance(date('Y-m-d', strtotime($from . ' -1 day')));
    range_form('cashbox', $from, $to); ?>
    <div class="print-title"><h2><?= e(print_header_text()) ?></h2>
      <div class="sub">حرکت دخل از <?= e(fdate($from)) ?> تا <?= e(fdate($to)) ?></div></div>
    <div class="stats no-print">
      <?php
        stat_card('موجودی ابتدای بازه', fmt_afn($open), '', 'info');
        stat_card('موجودی پایان بازه', fmt_afn(cashbox_balance($to)), '', 'good');
        stat_card('مجموع وارد شده', fmt_afn(sum_col($rows, 'sales_cash') + sum_col($rows, 'receipts')), 'فروشات نقده + رسیدات');
        stat_card('مجموع خارج شده', fmt_afn(sum_col($rows, 'outflow')), 'مصارف + معاشات', 'bad');
      ?>
    </div>
    <div class="card">
      <div class="table-wrap"><table class="report">
        <thead><tr><th>شماره</th><th>تاریخ</th><th class="num">فروشات نقده (+)</th><th class="num">رسیدات (+)</th>
          <th class="num">مصارف (−)</th><th class="num">معاشات (−)</th><th class="num">مجموع خروج (−)</th>
          <th class="num">موجودی دخل</th></tr></thead>
        <tbody>
        <?php foreach ($rows as $i => $r): ?>
          <tr><td class="num"><?= fmt($i + 1) ?></td><td class="nowrap"><?= e(fdate($r['date'])) ?></td>
            <td class="num"><?= fmt($r['sales_cash']) ?></td><td class="num"><?= fmt($r['receipts']) ?></td>
            <td class="num"><?= fmt($r['expenses']) ?></td><td class="num"><?= fmt($r['salaries']) ?></td>
            <td class="num"><?= fmt($r['outflow']) ?></td><td class="num"><b><?= fmt($r['balance']) ?></b></td></tr>
        <?php endforeach; ?>
        </tbody>
        <tfoot><tr><td colspan="2">مجموع</td><td class="num"><?= fmt(sum_col($rows, 'sales_cash')) ?></td>
          <td class="num"><?= fmt(sum_col($rows, 'receipts')) ?></td><td class="num"><?= fmt(sum_col($rows, 'expenses')) ?></td>
          <td class="num"><?= fmt(sum_col($rows, 'salaries')) ?></td><td class="num"><?= fmt(sum_col($rows, 'outflow')) ?></td>
          <td class="num"><?= fmt(cashbox_balance($to)) ?></td></tr></tfoot>
      </table></div>
    </div>
    <?php
}
page_footer();
