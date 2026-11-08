<?php
/**
 * داشبورد — نمای کلی شرکت
 */
require_once __DIR__ . '/app/bootstrap.php';
app_boot();
require_login();

$today = today_ymd();
$mStart = period_range(cal_year($today), cal_month($today));

$day = range_summary($today, $today);
$month = range_summary($mStart[0], $mStart[1]);
$fiscal = fiscal_range(cal_year($today));
$year = range_summary($fiscal[0], $fiscal[1]);

$cash = cashbox_balance();
$debtors = customer_balances(true);
$totalDebt = sum_col($debtors, 'balance');
$empActive = (int) Db::val("SELECT COUNT(*) FROM employees WHERE status='فعال'", [], 0);
$presentToday = (int) Db::val("SELECT COUNT(*) FROM attendance WHERE work_date=? AND status='حاضر'", [$today], 0);

$lastSales = Db::all(
    "SELECT s.*, c.name customer_name, m.name material FROM sales s
     LEFT JOIN customers c ON c.id=s.customer_id
     LEFT JOIN material_types m ON m.id=s.material_id
     ORDER BY s.sale_date DESC, s.id DESC LIMIT 8"
);
$lastExpenses = Db::all(
    "SELECT e.*, t.name etype, p.name payer FROM expenses e
     LEFT JOIN expense_types t ON t.id=e.expense_type_id
     LEFT JOIN payers p ON p.id=e.payer_id
     ORDER BY e.expense_date DESC, e.id DESC LIMIT 8"
);
$lastReceipts = Db::all(
    "SELECT r.*, c.name customer_name, s.name src FROM receipts r
     LEFT JOIN customers c ON c.id=r.customer_id
     LEFT JOIN receipt_sources s ON s.id=r.source_id
     ORDER BY r.receipt_date DESC, r.id DESC LIMIT 8"
);

page_header('داشبورد', ['actions' =>
    '<a class="btn btn-primary" href="sales.php?action=new">' . icon('plus') . ' فروش جدید</a>'
  . '<a class="btn" href="receipts.php?action=new">' . icon('money') . ' رسید جدید</a>'
  . '<a class="btn" href="expenses.php?action=new">' . icon('expense') . ' مصرف جدید</a>'
  . '<a class="btn" href="salaries.php?action=new">' . icon('salary') . ' پرداخت معاش</a>'
]);
?>

<?php
// ---------- کارت راهنمای شروع: فقط وقتی سیستم خالی است ----------
$emptyChecks = [
    (int) Db::val('SELECT COUNT(*) FROM `employees`', [], 0),
    (int) Db::val('SELECT COUNT(*) FROM `customers`', [], 0),
    (int) Db::val('SELECT COUNT(*) FROM `sales`', [], 0),
];
$systemEmpty = array_sum($emptyChecks) === 0;
?>
<?php if ($systemEmpty): ?>
<div class="card" id="startHere">
  <div class="card-head">
    <h2><?= icon('help') ?> به سیستم فردای روشن خوش آمدید</h2>
    <span class="badge badge-info">شروع از صفر</span>
  </div>
  <p class="muted">سیستم آماده است و هیچ معلوماتی در آن نیست. برای شروع، این مراحل را به ترتیب انجام دهید:</p>
  <div class="stats" style="margin-bottom:6px">
    <a class="stat info" href="company.php" style="text-decoration:none">
      <div class="stat-label">مرحله ۱</div>
      <div class="stat-value">مشخصات شرکت</div>
      <div class="stat-sub">نام، آدرس، مدیر مالی، سرپرست و ماشینری را ثبت کنید</div>
    </a>
    <a class="stat info" href="settings.php" style="text-decoration:none">
      <div class="stat-label">مرحله ۲</div>
      <div class="stat-value">تنظیمات و ظاهر</div>
      <div class="stat-sub">تقویم، موجودی اول دخل، رنگ و حالت روشن/تیره</div>
    </a>
    <a class="stat info" href="employees.php?action=new" style="text-decoration:none">
      <div class="stat-label">مرحله ۳</div>
      <div class="stat-value">ثبت کارمندان</div>
      <div class="stat-sub">هر کارمند با کد، معاش و تاریخ استخدام</div>
    </a>
    <a class="stat info" href="customers.php?action=new" style="text-decoration:none">
      <div class="stat-label">مرحله ۴</div>
      <div class="stat-value">ثبت مشتریان</div>
      <div class="stat-sub">نام مشتری/شرکت، شخص رابط و شماره تماس</div>
    </a>
  </div>
  <div class="stats">
    <a class="stat good" href="sales.php?action=new" style="text-decoration:none">
      <div class="stat-label">مرحله ۵</div>
      <div class="stat-value">فروشات</div>
      <div class="stat-sub">هر بل فروش را با متراژ، قیمت و کرایه ثبت کنید</div>
    </a>
    <a class="stat warn" href="expenses.php?action=new" style="text-decoration:none">
      <div class="stat-label">مرحله ۶</div>
      <div class="stat-value">مصارف و رسیدات</div>
      <div class="stat-sub">هزینه‌ها، پول‌های دریافتی و پرداختی</div>
    </a>
    <a class="stat" href="salaries.php?action=new" style="text-decoration:none">
      <div class="stat-label">مرحله ۷</div>
      <div class="stat-value">معاشات</div>
      <div class="stat-sub">پرداخت معاش ماه با پاداش، جریمه و اضافه کاری</div>
    </a>
    <a class="stat" href="reports_daily.php" style="text-decoration:none">
      <div class="stat-label">مرحله ۸</div>
      <div class="stat-value">راپورها</div>
      <div class="stat-sub">روزانه، ماهانه و سالانه (پس از ثبت معلومات)</div>
    </a>
  </div>
  <p class="muted" style="margin:8px 0 0">
    <?= icon('info', 14) ?> اگر فقط می‌خواهید سیستم را امتحان کنید، از
    <a href="settings.php#danger">تنظیمات → منطقه خطر</a> می‌توانید «معلومات نمونه» بارگذاری کنید و بعداً همان‌جا آن را پاک کنید.
    راهنمای کامل: <a href="help.php">راهنمای استفاده</a>
  </p>
</div>
<?php endif; ?>

<div class="stats">
  <?php
    stat_card('فروش امروز', fmt_afn($day['sales_total']), 'نقده: ' . fmt($day['sales_cash']) . ' | باقی: ' . fmt($day['sales_credit']), 'good');
    stat_card('موجودی دخل', fmt_afn($cash), 'روش: ' . (cashbox_mode() === 'all' ? 'مجموع مصارف از دخل کم می‌شود' : 'فقط نقد از دخل'), 'info');
    stat_card('فروش این ماه', fmt_afn($month['sales_total']), 'متراژ: ' . fmt($month['volume'], 2) . ' متر مکعب');
    stat_card('رسیدات این ماه', fmt_afn($month['receipts']), 'از ' . fmt($month['receipts_count']) . ' رسید');
    stat_card('مصارف و معاشات این ماه', fmt_afn($month['outflow']),
        'مصارف: ' . fmt($month['expenses_afn']) . ' | معاشات: ' . fmt($month['salaries']), ($month['outflow'] > $month['sales_total'] ? 'bad' : 'warn'));
    stat_card(($month['profit'] >= 0 ? 'سود خالص این ماه' : 'زیان این ماه'),
        fmt_afn(abs($month['profit'])), 'فروش ماه − مصارف و معاشات', ($month['profit'] >= 0 ? 'good' : 'bad'));
    stat_card('باقی مانده بدهی مشتریان', fmt_afn($totalDebt), 'تعداد بدهکاران: ' . fmt(count($debtors)), 'bad');
    stat_card('کارمندان', fmt($empActive) . ' نفر فعال', 'حاضر امروز: ' . fmt($presentToday) . ' نفر');
  ?>
</div>

<div class="grid-2">
  <div class="card">
    <div class="card-head"><h2>آخرین فروشات</h2><a class="btn btn-sm" href="sales.php">همه فروشات</a></div>
    <div class="table-wrap">
      <table class="grid">
        <thead><tr><th>شماره</th><th>تاریخ</th><th>مشتری</th><th>مواد</th><th class="num">مجموع</th><th>پرداخت</th></tr></thead>
        <tbody>
        <?php foreach ($lastSales as $s): ?>
          <tr>
            <td class="nowrap"><?= e($s['sale_no']) ?></td>
            <td class="nowrap"><?= fdate($s['sale_date']) ?></td>
            <td><?= e(str_excerpt($s['customer_name'], 24)) ?></td>
            <td><?= e($s['material']) ?></td>
            <td class="num"><?= fmt($s['total_amount']) ?></td>
            <td><?= pay_badge($s['payment_type']) ?></td>
          </tr>
        <?php endforeach; ?>
        <?php if (!$lastSales): ?><tr><td colspan="6" class="empty">هنوز فروشی ثبت نشده است.</td></tr><?php endif; ?>
        </tbody>
      </table>
    </div>
  </div>

  <div class="card">
    <div class="card-head"><h2>آخرین مصارف</h2><a class="btn btn-sm" href="expenses.php">همه مصارف</a></div>
    <div class="table-wrap">
      <table class="grid">
        <thead><tr><th>شماره</th><th>تاریخ</th><th>شرح</th><th class="num">افغانی</th><th class="num">دالری</th><th>پرداخت کننده</th></tr></thead>
        <tbody>
        <?php foreach ($lastExpenses as $x): ?>
          <tr>
            <td class="nowrap"><?= e($x['expense_no']) ?></td>
            <td class="nowrap"><?= fdate($x['expense_date']) ?></td>
            <td><?= e(str_excerpt($x['description'], 26)) ?></td>
            <td class="num"><?= fmt($x['amount_afn']) ?></td>
            <td class="num"><?= $x['amount_usd'] > 0 ? fmt($x['amount_usd'], 2) : '—' ?></td>
            <td><?= e($x['payer']) ?></td>
          </tr>
        <?php endforeach; ?>
        <?php if (!$lastExpenses): ?><tr><td colspan="6" class="empty">هنوز مصرفی ثبت نشده است.</td></tr><?php endif; ?>
        </tbody>
      </table>
    </div>
  </div>

  <div class="card">
    <div class="card-head"><h2>بیشترین باقی مانده بدهی</h2><a class="btn btn-sm" href="reports_other.php?tab=balances">راپور بدهی‌ها</a></div>
    <div class="table-wrap">
      <table class="grid">
        <thead><tr><th>کد</th><th>نام مشتری / شرکت</th><th>شخص رابط</th><th class="num">باقی مانده بدهی</th></tr></thead>
        <tbody>
        <?php foreach (array_slice($debtors, 0, 6) as $d): ?>
          <tr>
            <td><?= e($d['code']) ?></td>
            <td><a href="reports_other.php?tab=statement&customer_id=<?= (int) $d['id'] ?>"><?= e($d['name']) ?></a></td>
            <td><?= e($d['contact_person']) ?></td>
            <td class="num"><?= fmt($d['balance']) ?></td>
          </tr>
        <?php endforeach; ?>
        <?php if (!$debtors): ?><tr><td colspan="4" class="empty">هیچ مشتری بدهکار نیست.</td></tr><?php endif; ?>
        </tbody>
      </table>
    </div>
  </div>

  <div class="card">
    <div class="card-head"><h2>آخرین رسیدات</h2><a class="btn btn-sm" href="receipts.php">همه رسیدات</a></div>
    <div class="table-wrap">
      <table class="grid">
        <thead><tr><th>شماره</th><th>تاریخ</th><th>مشتری</th><th class="num">مبلغ رسید</th><th>از درک</th><th>توسط</th></tr></thead>
        <tbody>
        <?php foreach ($lastReceipts as $r): ?>
          <tr>
            <td class="nowrap"><?= e($r['receipt_no']) ?></td>
            <td class="nowrap"><?= fdate($r['receipt_date']) ?></td>
            <td><?= e(str_excerpt($r['customer_name'], 24)) ?></td>
            <td class="num"><?= fmt($r['amount']) ?></td>
            <td><?= e($r['src']) ?></td>
            <td><?= e($r['received_by']) ?></td>
          </tr>
        <?php endforeach; ?>
        <?php if (!$lastReceipts): ?><tr><td colspan="6" class="empty">هنوز رسیدی ثبت نشده است.</td></tr><?php endif; ?>
        </tbody>
      </table>
    </div>
  </div>
</div>

<div class="card">
  <div class="card-head"><h2>خلاصه سال مالی جاری (<?= e(fdate($fiscal[0])) ?> تا <?= e(fdate($fiscal[1])) ?>)</h2>
    <a class="btn btn-sm" href="reports_yearly.php">راپور سالانه</a></div>
  <div class="table-wrap">
  <table class="grid">
    <thead><tr><th>کل فروشات</th><th class="num">فروشات نقده</th><th class="num">فروشات قرضه</th><th class="num">کل رسیدات</th>
      <th class="num">کل مصارف</th><th class="num">کل معاشات</th><th class="num">سود / زیان</th><th class="num">متراژ فروش</th></tr></thead>
    <tbody><tr>
      <td><?= fmt($year['sales_total']) ?></td>
      <td class="num"><?= fmt($year['sales_cash']) ?></td>
      <td class="num"><?= fmt($year['sales_credit']) ?></td>
      <td class="num"><?= fmt($year['receipts']) ?></td>
      <td class="num"><?= fmt($year['expenses_afn']) ?></td>
      <td class="num"><?= fmt($year['salaries']) ?></td>
      <td class="num"><b class="<?= $year['profit'] >= 0 ? '' : 'muted' ?>"><?= fmt(abs($year['profit'])) ?> (<?= $year['profit'] >= 0 ? 'سود' : 'زیان' ?>)</b></td>
      <td class="num"><?= fmt($year['volume'], 2) ?></td>
    </tr></tbody>
  </table>
  </div>
  <?php if ($year['expenses_usd'] > 0): ?>
    <p class="muted" style="margin:8px 0 0">مجموع مصارف دالری این سال: <?= fmt_usd($year['expenses_usd']) ?> (به صورت جداگانه نگهداری می‌شود)</p>
  <?php endif; ?>
</div>

<?php page_footer(); ?>
