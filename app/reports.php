<?php
/**
 * محاسبات راپورها — فردای روشن
 *
 * قواعد حساب (مطابق تنظیمات سیستم):
 *  - فروشات: هر بل فروش یا «نقده» است یا «باقی» (مجموع قیمت + کرایه).
 *  - رسیدات: پول وصول‌شده از مشتریان (از باقی مانده بدهی یا امانت/بیانیه).
 *  - مصارف: مبلغ افغانی و مبلغ دالری جداگانه نگهداری می‌شود (بدون تبدیل به هم).
 *  - سود/زیان فقط بر اساس مبلغ افغانی محاسبه می‌شود.
 *  - معاشات به عنوان مصرف جداگانه محاسبه و در «مجموع مصارف» شامل می‌شود.
 */

/** اقلام مالی یک بازه تاریخ (میلادی) */
function range_summary(string $from, string $to): array
{
    $out = [
        'sales_cash'   => Db::num('SELECT COALESCE(SUM(total_amount),0) FROM sales WHERE sale_date BETWEEN ? AND ? AND payment_type=?', [$from, $to, 'نقده']),
        'sales_credit' => Db::num('SELECT COALESCE(SUM(total_amount),0) FROM sales WHERE sale_date BETWEEN ? AND ? AND payment_type=?', [$from, $to, 'باقی']),
        'sales_count'  => (int) Db::val('SELECT COUNT(*) FROM sales WHERE sale_date BETWEEN ? AND ?', [$from, $to], 0),
        'volume'       => Db::num('SELECT COALESCE(SUM(volume),0) FROM sales WHERE sale_date BETWEEN ? AND ?', [$from, $to]),
        // مجموع کرایه = مجموع (متراژ × کرایه فی متر)
        'freight'      => Db::num('SELECT COALESCE(SUM(volume * freight),0) FROM sales WHERE sale_date BETWEEN ? AND ?', [$from, $to]),
        'receipts'     => Db::num('SELECT COALESCE(SUM(amount),0) FROM receipts WHERE receipt_date BETWEEN ? AND ?', [$from, $to]),
        'receipts_count' => (int) Db::val('SELECT COUNT(*) FROM receipts WHERE receipt_date BETWEEN ? AND ?', [$from, $to], 0),
        'expenses_afn' => Db::num('SELECT COALESCE(SUM(amount_afn),0) FROM expenses WHERE expense_date BETWEEN ? AND ?', [$from, $to]),
        'expenses_usd' => Db::num('SELECT COALESCE(SUM(amount_usd),0) FROM expenses WHERE expense_date BETWEEN ? AND ?', [$from, $to]),
        'expenses_count' => (int) Db::val('SELECT COUNT(*) FROM expenses WHERE expense_date BETWEEN ? AND ?', [$from, $to], 0),
        'salaries'     => Db::num('SELECT COALESCE(SUM(total_pay),0) FROM salaries WHERE pay_date BETWEEN ? AND ?', [$from, $to]),
        'salaries_count' => (int) Db::val('SELECT COUNT(*) FROM salaries WHERE pay_date BETWEEN ? AND ?', [$from, $to], 0),
    ];
    $out['sales_total']    = $out['sales_cash'] + $out['sales_credit'];
    $out['outflow']        = $out['expenses_afn'] + $out['salaries'];
    $out['profit']         = $out['sales_total'] - $out['outflow'];
    $out['net_cash']       = $out['sales_cash'] + $out['receipts'] - $out['outflow'];
    return $out;
}

/** نحوه محاسبه موجودی دخل (تنظیمات) */
function cashbox_mode(): string
{
    return setting('cashbox_mode', 'all') === 'cash_only' ? 'cash_only' : 'all';
}

/** مجموع تغییرات دخل در یک بازه، مطابق روش انتخابی */
function cash_delta(string $from, string $to): float
{
    $s = range_summary($from, $to);
    if (cashbox_mode() === 'cash_only') {
        // فقط پولی که واقعاً از دخل آمده/رفته
        $exp = Db::num(
            "SELECT COALESCE(SUM(e.amount_afn),0) FROM expenses e
             JOIN payers p ON p.id = e.payer_id
             WHERE e.expense_date BETWEEN ? AND ? AND e.payment_method='نقده' AND p.kind='دخل'",
            [$from, $to]
        );
        $sal = Db::num(
            "SELECT COALESCE(SUM(s.total_pay),0) FROM salaries s
             JOIN payers p ON p.id = s.payer_id
             WHERE s.pay_date BETWEEN ? AND ? AND s.payment_type='نقد' AND p.kind='دخل'",
            [$from, $to]
        );
        return $s['sales_cash'] + $s['receipts'] - $exp - $sal;
    }
    return $s['sales_cash'] + $s['receipts'] - $s['expenses_afn'] - $s['salaries'];
}

/** موجودی دخل تا پایان یک تاریخ معین */
function cashbox_balance(?string $upto = null): float
{
    $upto = $upto ?: today_ymd();
    $opening = (float) setting('opening_cash', 0);
    return $opening + cash_delta('1000-01-01', $upto);
}

/** راپور روزانه — یک ردیف برای هر روز بازه */
function report_daily(string $from, string $to): array
{
    $rows = [];
    $running = cashbox_balance(date('Y-m-d', strtotime($from . ' -1 day')));
    $cur = $from;
    $guard = 0;
    $sales = Db::all(
        'SELECT sale_date d,
                COALESCE(SUM(CASE WHEN payment_type=? THEN total_amount ELSE 0 END),0) cash,
                COALESCE(SUM(CASE WHEN payment_type=? THEN total_amount ELSE 0 END),0) credit,
                COALESCE(SUM(volume),0) vol, COUNT(*) cnt
         FROM sales WHERE sale_date BETWEEN ? AND ? GROUP BY sale_date',
        ['نقده', 'باقی', $from, $to]
    );
    $rec = Db::all('SELECT receipt_date d, COALESCE(SUM(amount),0) amt, COUNT(*) cnt FROM receipts WHERE receipt_date BETWEEN ? AND ? GROUP BY receipt_date', [$from, $to]);
    $exp = Db::all('SELECT expense_date d, COALESCE(SUM(amount_afn),0) afn, COALESCE(SUM(amount_usd),0) usd, COUNT(*) cnt FROM expenses WHERE expense_date BETWEEN ? AND ? GROUP BY expense_date', [$from, $to]);
    $sal = Db::all('SELECT pay_date d, COALESCE(SUM(total_pay),0) amt, COUNT(*) cnt FROM salaries WHERE pay_date BETWEEN ? AND ? GROUP BY pay_date', [$from, $to]);

    // در حالت «فقط پول دخل»: مصارف و معاشات پرداخت‌شده از دخل
    $cashOnly = cashbox_mode() === 'cash_only';
    $expCash = $salCash = [];
    if ($cashOnly) {
        $expCash = Db::all(
            "SELECT e.expense_date d, COALESCE(SUM(e.amount_afn),0) amt FROM expenses e
             JOIN payers p ON p.id=e.payer_id
             WHERE e.expense_date BETWEEN ? AND ? AND e.payment_method='نقده' AND p.kind='دخل'
             GROUP BY e.expense_date", [$from, $to]
        );
        $salCash = Db::all(
            "SELECT s.pay_date d, COALESCE(SUM(s.total_pay),0) amt FROM salaries s
             JOIN payers p ON p.id=s.payer_id
             WHERE s.pay_date BETWEEN ? AND ? AND s.payment_type='نقد' AND p.kind='دخل'
             GROUP BY s.pay_date", [$from, $to]
        );
    }

    $idx = function (array $arr, string $key = 'd') {
        $m = [];
        foreach ($arr as $r) {
            $m[$r[$key]] = $r;
        }
        return $m;
    };
    $S = $idx($sales); $R = $idx($rec); $E = $idx($exp); $L = $idx($sal);
    $EC = $idx($expCash); $SL = $idx($salCash);

    while ($cur <= $to && $guard++ < 1000) {
        $sc = (float) ($S[$cur]['cash'] ?? 0);
        $cr = (float) ($S[$cur]['credit'] ?? 0);
        $rc = (float) ($R[$cur]['amt'] ?? 0);
        $ex = (float) ($E[$cur]['afn'] ?? 0);
        $ed = (float) ($E[$cur]['usd'] ?? 0);
        $sa = (float) ($L[$cur]['amt'] ?? 0);
        $outflow = $ex + $sa;
        // تغییر موجودی دخل همان روز
        if ($cashOnly) {
            $running += $sc + $rc - (float) ($EC[$cur]['amt'] ?? 0) - (float) ($SL[$cur]['amt'] ?? 0);
        } else {
            $running += $sc + $rc - $outflow;
        }
        $rows[] = [
            'date'         => $cur,
            'sales_cash'   => $sc,
            'sales_credit' => $cr,
            'sales_total'  => $sc + $cr,
            'volume'       => (float) ($S[$cur]['vol'] ?? 0),
            'receipts'     => $rc,
            'expenses'     => $ex,
            'expenses_usd' => $ed,
            'salaries'     => $sa,
            'outflow'      => $outflow,
            'balance'      => $running,
        ];
        $cur = date('Y-m-d', strtotime($cur . ' +1 day'));
    }
    return $rows;
}

/** راپور ماهانه یک سال (تقویم فعال) */
function report_monthly(int $year): array
{
    $notes = report_notes('monthly');
    $rows = [];
    for ($m = 1; $m <= 12; $m++) {
        [$from, $to] = period_range($year, $m);
        $s = range_summary($from, $to);
        $period = sprintf('%04d-%02d', $year, $m);
        $profit = $s['profit'];
        $rows[] = [
            'year'         => $year,
            'month'        => $m,
            'from'         => $from,
            'to'           => $to,
            'sales_cash'   => $s['sales_cash'],
            'sales_credit' => $s['sales_credit'],
            'sales_total'  => $s['sales_total'],
            'volume'       => $s['volume'],
            'receipts'     => $s['receipts'],
            'salaries'     => $s['salaries'],
            'expenses'     => $s['expenses_afn'],
            'expenses_usd' => $s['expenses_usd'],
            'outflow'      => $s['outflow'],
            'profit'       => max($profit, 0),
            'loss'         => $profit < 0 ? -$profit : 0,
            'net'          => $profit,
            'notes'        => $notes[$period] ?? '',
        ];
    }
    return $rows;
}

/** راپور سالانه — همه سال‌های دارای فعالیت + سال جاری */
function report_yearly(?int $onlyYear = null): array
{
    $notes = report_notes('yearly');
    $years = [];
    if ($onlyYear) {
        $years[] = $onlyYear;
    } else {
        $ymds = [];
        foreach ([['sales', 'sale_date'], ['receipts', 'receipt_date'], ['expenses', 'expense_date'], ['salaries', 'pay_date']] as [$t, $c]) {
            $v = Db::val("SELECT MIN(`$c`) FROM `$t`");
            if ($v) {
                $ymds[] = $v;
            }
        }
        $minYear = cal_year($ymds ? min($ymds) : today_ymd());
        $maxYear = cal_year(today_ymd());
        for ($y = $minYear; $y <= $maxYear; $y++) {
            $years[] = $y;
        }
        $years = array_unique($years);
    }
    $rows = [];
    foreach ($years as $y) {
        [$from, $to] = fiscal_range((int) $y);
        $s = range_summary($from, $to);
        $rows[] = [
            'year'         => (int) $y,
            'from'         => $from,
            'to'           => $to,
            'sales_cash'   => $s['sales_cash'],
            'sales_credit' => $s['sales_credit'],
            'sales_total'  => $s['sales_total'],
            'volume'       => $s['volume'],
            'receipts'     => $s['receipts'],
            'salaries'     => $s['salaries'],
            'expenses'     => $s['expenses_afn'],
            'expenses_usd' => $s['expenses_usd'],
            'outflow'      => $s['outflow'],
            'profit'       => max($s['profit'], 0),
            'loss'         => $s['profit'] < 0 ? -$s['profit'] : 0,
            'net'          => $s['profit'],
            'notes'        => $notes[(string) $y] ?? '',
        ];
    }
    return $rows;
}

/** یادداشت راپورها */
function report_notes(string $scope): array
{
    static $cache = [];
    if (!isset($cache[$scope])) {
        $cache[$scope] = [];
        foreach (Db::all('SELECT `period`,`notes` FROM report_notes WHERE `scope`=?', [$scope]) as $r) {
            $cache[$scope][$r['period']] = (string) $r['notes'];
        }
    }
    return $cache[$scope];
}

function save_report_note(string $scope, string $period, string $notes): void
{
    Db::q('INSERT INTO report_notes (`scope`,`period`,`notes`) VALUES (?,?,?)
           ON DUPLICATE KEY UPDATE `notes`=VALUES(`notes`)', [$scope, $period, $notes]);
}

/** باقی مانده بدهی یک مشتری */
function customer_balance(int $customerId): float
{
    $c = Db::one('SELECT opening_balance FROM customers WHERE id=?', [$customerId]);
    if (!$c) {
        return 0;
    }
    $credit = Db::num('SELECT COALESCE(SUM(total_amount),0) FROM sales WHERE customer_id=? AND payment_type=?', [$customerId, 'باقی']);
    $paid = Db::num(
        'SELECT COALESCE(SUM(r.amount),0) FROM receipts r
         LEFT JOIN receipt_sources s ON s.id = r.source_id
         WHERE r.customer_id=? AND COALESCE(s.affects_balance,1)=1',
        [$customerId]
    );
    return (float) $c['opening_balance'] + $credit - $paid;
}

/** فهرست باقی مانده بدهی همه مشتریان (فقط بدهکاران یا همه) */
function customer_balances(bool $onlyDebtors = true): array
{
    $sql = "SELECT c.*,
              (SELECT COALESCE(SUM(s.total_amount),0) FROM sales s WHERE s.customer_id=c.id AND s.payment_type='باقی') credit_sales,
              (SELECT COALESCE(SUM(r.amount),0) FROM receipts r
                 LEFT JOIN receipt_sources rs ON rs.id=r.source_id
                 WHERE r.customer_id=c.id AND COALESCE(rs.affects_balance,1)=1) paid,
              (SELECT COALESCE(SUM(s.total_amount),0) FROM sales s WHERE s.customer_id=c.id AND s.payment_type='نقده') cash_sales
            FROM customers c ORDER BY c.name";
    $rows = Db::all($sql);
    foreach ($rows as &$r) {
        $r['balance'] = (float) $r['opening_balance'] + (float) $r['credit_sales'] - (float) $r['paid'];
    }
    unset($r);
    if ($onlyDebtors) {
        $rows = array_values(array_filter($rows, fn($r) => abs($r['balance']) > 0.004));
    }
    usort($rows, fn($a, $b) => $b['balance'] <=> $a['balance']);
    return $rows;
}

/** کارت حساب (صورت حساب) یک مشتری */
function customer_ledger(int $customerId, ?string $from = null, ?string $to = null): array
{
    $c = Db::one('SELECT * FROM customers WHERE id=?', [$customerId]);
    if (!$c) {
        return ['customer' => null, 'rows' => [], 'balance' => 0, 'opening' => 0];
    }
    $from = $from ?: '1000-01-01';
    $to   = $to ?: '9999-12-31';

    // بدهی پیش از بازه
    $opening = (float) $c['opening_balance'];
    if ($from !== '1000-01-01') {
        $before = Db::num('SELECT COALESCE(SUM(total_amount),0) FROM sales WHERE customer_id=? AND payment_type=? AND sale_date < ?', [$customerId, 'باقی', $from]);
        $beforePaid = Db::num('SELECT COALESCE(SUM(r.amount),0) FROM receipts r LEFT JOIN receipt_sources s ON s.id=r.source_id
                               WHERE r.customer_id=? AND COALESCE(s.affects_balance,1)=1 AND r.receipt_date < ?', [$customerId, $from]);
        $opening = $opening + $before - $beforePaid;
    }

    $items = [];
    foreach (Db::all('SELECT * FROM sales WHERE customer_id=? AND payment_type=? AND sale_date BETWEEN ? AND ?', [$customerId, 'باقی', $from, $to]) as $s) {
        $items[] = [
            'date'   => $s['sale_date'],
            'type'   => 'فروش (باقی)',
            'desc'   => 'بل نمبر ' . $s['bill_no'] . ' — ' . lookup_name('material_types', $s['material_id'])
                      . ' — ' . fmt($s['volume'], 2) . ' متر مکعب',
            'debit'  => (float) $s['total_amount'],
            'credit' => 0.0,
            'link'   => 'sales.php?action=edit&id=' . $s['id'],
        ];
    }
    foreach (Db::all('SELECT r.*, s.name src FROM receipts r LEFT JOIN receipt_sources s ON s.id=r.source_id
                      WHERE r.customer_id=? AND r.receipt_date BETWEEN ? AND ?', [$customerId, $from, $to]) as $r) {
        $items[] = [
            'date'   => $r['receipt_date'],
            'type'   => 'رسید (' . ($r['src'] ?: 'رسید') . ')',
            'desc'   => 'شماره رسید ' . $r['receipt_no'] . ($r['related_bill_no'] ? ' — بل ' . $r['related_bill_no'] : ''),
            'debit'  => 0.0,
            'credit' => (float) $r['amount'],
            'link'   => 'receipts.php?action=edit&id=' . $r['id'],
        ];
    }
    usort($items, fn($a, $b) => strcmp($a['date'], $b['date']));
    $run = $opening;
    foreach ($items as &$it) {
        $run += $it['debit'] - $it['credit'];
        $it['balance'] = $run;
    }
    unset($it);
    return ['customer' => $c, 'rows' => $items, 'balance' => $run, 'opening' => $opening, 'from' => $from, 'to' => $to];
}

/** فروشات به تفکیک نوع مواد */
function sales_by_material(string $from, string $to): array
{
    return Db::all(
        "SELECT m.name material, COUNT(s.id) cnt, COALESCE(SUM(s.volume),0) volume,
                COALESCE(SUM(s.total_amount),0) total,
                COALESCE(SUM(CASE WHEN s.payment_type='نقده' THEN s.total_amount ELSE 0 END),0) cash,
                COALESCE(SUM(CASE WHEN s.payment_type='باقی' THEN s.total_amount ELSE 0 END),0) credit
         FROM sales s JOIN material_types m ON m.id=s.material_id
         WHERE s.sale_date BETWEEN ? AND ?
         GROUP BY m.id, m.name ORDER BY total DESC",
        [$from, $to]
    );
}

/** مصارف به تفکیک انواع مصرف - مربوط */
function expenses_by_type(string $from, string $to): array
{
    return Db::all(
        "SELECT COALESCE(t.name,'(نامعلوم)') etype, COUNT(e.id) cnt,
                COALESCE(SUM(e.amount_afn),0) afn, COALESCE(SUM(e.amount_usd),0) usd
         FROM expenses e LEFT JOIN expense_types t ON t.id=e.expense_type_id
         WHERE e.expense_date BETWEEN ? AND ?
         GROUP BY t.id, t.name ORDER BY afn DESC",
        [$from, $to]
    );
}

/** مصارف به تفکیک پرداخت کننده */
function expenses_by_payer(string $from, string $to): array
{
    return Db::all(
        "SELECT COALESCE(p.name,'(نامعلوم)') payer, COALESCE(p.kind,'') kind, COUNT(e.id) cnt,
                COALESCE(SUM(e.amount_afn),0) afn, COALESCE(SUM(e.amount_usd),0) usd
         FROM expenses e LEFT JOIN payers p ON p.id=e.payer_id
         WHERE e.expense_date BETWEEN ? AND ?
         GROUP BY p.id, p.name, p.kind ORDER BY afn DESC",
        [$from, $to]
    );
}

/** خلاصه معاشات یک بازه */
function salary_summary(string $from, string $to): array
{
    return Db::all(
        "SELECT e.emp_code, e.full_name, e.job_title,
                COALESCE(SUM(s.base_salary),0) base, COALESCE(SUM(s.bonus),0) bonus,
                COALESCE(SUM(s.fine),0) fine, COALESCE(SUM(s.overtime_pay),0) overtime,
                COALESCE(SUM(s.total_pay),0) total, COUNT(s.id) months
         FROM salaries s JOIN employees e ON e.id=s.employee_id
         WHERE s.pay_date BETWEEN ? AND ?
         GROUP BY e.id, e.emp_code, e.full_name, e.job_title ORDER BY total DESC",
        [$from, $to]
    );
}

/** خلاصه حضور و غیاب یک بازه */
function attendance_summary(string $from, string $to): array
{
    return Db::all(
        "SELECT e.emp_code, e.full_name, e.job_title,
                SUM(a.status='حاضر') present, SUM(a.status='غایب') absent,
                SUM(a.status='رخصت') leave_,
                SUM(a.status='مریض') sick, SUM(a.status='رخصتی رسمی') official,
                COALESCE(SUM(a.overtime_hours),0) overtime
         FROM attendance a JOIN employees e ON e.id=a.employee_id
         WHERE a.work_date BETWEEN ? AND ?
         GROUP BY e.id, e.emp_code, e.full_name, e.job_title ORDER BY e.full_name",
        [$from, $to]
    );
}

/** فروشات به تفکیک مشتری */
function sales_by_customer(string $from, string $to): array
{
    return Db::all(
        "SELECT COALESCE(c.name,'(متفرقه)') customer, COUNT(s.id) cnt,
                COALESCE(SUM(s.volume),0) volume,
                COALESCE(SUM(s.total_amount),0) total,
                COALESCE(SUM(CASE WHEN s.payment_type='نقده' THEN s.total_amount ELSE 0 END),0) cash,
                COALESCE(SUM(CASE WHEN s.payment_type='باقی' THEN s.total_amount ELSE 0 END),0) credit
         FROM sales s LEFT JOIN customers c ON c.id=s.customer_id
         WHERE s.sale_date BETWEEN ? AND ?
         GROUP BY c.id, c.name ORDER BY total DESC",
        [$from, $to]
    );
}

/** لیست سال‌های موجود برای انتخاب در راپورها */
function year_options(): array
{
    $min = null;
    foreach ([['sales', 'sale_date'], ['receipts', 'receipt_date'], ['expenses', 'expense_date'], ['salaries', 'pay_date']] as [$t, $c]) {
        $v = Db::val("SELECT MIN(`$c`) FROM `$t`");
        if ($v && ($min === null || $v < $min)) {
            $min = $v;
        }
    }
    $cur = cal_year();
    $start = $min ? cal_year($min) : $cur;
    $out = [];
    for ($y = $cur + 1; $y >= min($start, $cur - 1); $y--) {
        $out[$y] = $y;
    }
    return $out;
}
