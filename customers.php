<?php
/**
 * شیت مشتریان
 */
require_once __DIR__ . '/app/bootstrap.php';
app_boot();
require_login();

$spec = [
    'table'   => 'customers',
    'entity'  => 'customers',
    'title'   => 'مشتریان',
    'singular' => 'مشتری',
    'page_size' => 25,
    'order'   => 'c.name ASC',
    'list_sql' => "SELECT c.*,
                     (SELECT COALESCE(SUM(s.total_amount),0) FROM sales s WHERE s.customer_id=c.id AND s.payment_type='باقی') credit_sales,
                     (SELECT COALESCE(SUM(r.amount),0) FROM receipts r
                        LEFT JOIN receipt_sources rs ON rs.id=r.source_id
                        WHERE r.customer_id=c.id AND COALESCE(rs.affects_balance,1)=1) paid,
                     (SELECT COALESCE(SUM(s.total_amount),0) FROM sales s WHERE s.customer_id=c.id) all_sales
                   FROM customers c",
    'search'  => ['c.code', 'c.name', 'c.contact_person', 'c.phone', 'c.vehicle_plate', 'c.address'],
    'filters' => [
        ['name' => 'balance', 'label' => 'وضعیت حساب', 'type' => 'raw', 'all_label' => 'همه',
         'labels' => ['debt' => 'بدهکار', 'clear' => 'تصفیه شده', 'zero' => 'بدون معامله'],
         'values' => [
             'debt'  => "(c.opening_balance + (SELECT COALESCE(SUM(s.total_amount),0) FROM sales s WHERE s.customer_id=c.id AND s.payment_type='باقی')
                        - (SELECT COALESCE(SUM(r.amount),0) FROM receipts r LEFT JOIN receipt_sources rs ON rs.id=r.source_id
                           WHERE r.customer_id=c.id AND COALESCE(rs.affects_balance,1)=1)) > 0.004",
             'clear' => "ABS(c.opening_balance + (SELECT COALESCE(SUM(s.total_amount),0) FROM sales s WHERE s.customer_id=c.id AND s.payment_type='باقی')
                        - (SELECT COALESCE(SUM(r.amount),0) FROM receipts r LEFT JOIN receipt_sources rs ON rs.id=r.source_id
                           WHERE r.customer_id=c.id AND COALESCE(rs.affects_balance,1)=1)) <= 0.004
                        AND EXISTS (SELECT 1 FROM sales sx WHERE sx.customer_id=c.id)",
             'zero'  => "NOT EXISTS (SELECT 1 FROM sales sz WHERE sz.customer_id=c.id)",
         ]],
    ],
    'cols' => [
        ['label' => 'شماره', 'render' => fn($r, $i) => fmt($i)],
        ['label' => 'کد مشتری', 'key' => 'code', 'class' => 'nowrap'],
        ['label' => 'نام مشتری / شرکت', 'key' => 'name'],
        ['label' => 'شخص رابط', 'key' => 'contact_person'],
        ['label' => 'شماره تماس', 'key' => 'phone', 'class' => 'nowrap'],
        ['label' => 'پلیت موتر', 'key' => 'vehicle_plate', 'class' => 'nowrap'],
        ['label' => 'باقی مانده بدهی', 'render' => function ($r) {
            $b = (float) $r['opening_balance'] + (float) $r['credit_sales'] - (float) $r['paid'];
            if (abs($b) < 0.005) {
                return '<span class="badge badge-ok">تصفیه شده</span>';
            }
            return '<b class="' . ($b > 0 ? 't-neg' : 't-pos') . '">' . fmt($b) . '</b>';
        }, 'num' => true],
        ['label' => 'مجموع فروشات', 'key' => 'all_sales', 'fmt' => 'money', 'num' => true],
        ['label' => 'توضیحات', 'key' => 'notes', 'render' => fn($r) => e(str_excerpt($r['notes'], 24))],
        ['label' => 'عملیات', 'render' => fn($r) => row_actions([], $r, [
            'کارت حساب' => 'reports_other.php?tab=statement&customer_id=' . (int) $r['id'],
            'فروش جدید' => 'sales.php?action=new&customer_id=' . (int) $r['id'],
        ])],
    ],
    'totals' => [['key' => 'all_sales']],
    'foot_note' => 'مجموع فروشات این صفحه:',
    'fields' => [
        ['name' => 'code', 'label' => 'کد مشتری', 'type' => 'text', 'required' => true, 'unique' => true, 'col' => 'third',
         'help' => 'مثلاً CUS-001'],
        ['name' => 'name', 'label' => 'نام مشتری / شرکت', 'type' => 'text', 'required' => true, 'col' => 'half'],
        ['name' => 'contact_person', 'label' => 'شخص رابط', 'type' => 'text', 'col' => 'third'],
        ['name' => 'phone', 'label' => 'شماره تماس', 'type' => 'text', 'col' => 'third'],
        ['name' => 'vehicle_plate', 'label' => 'پلیت موتر', 'type' => 'text', 'col' => 'third',
         'datalist' => fn() => distinct_values('customers', 'vehicle_plate')],
        ['name' => 'opening_balance', 'label' => 'باقی مانده بدهی اولیه (قبل از سیستم)', 'type' => 'money', 'col' => 'third',
         'help' => 'اگر از قبل بدهکار است اینجا بنویسید، وگرنه صفر'],
        ['name' => 'address', 'label' => 'آدرس', 'type' => 'text', 'col' => 'full'],
        ['name' => 'notes', 'label' => 'توضیحات', 'type' => 'textarea', 'col' => 'full'],
    ],
    'defaults' => function (array $row) {
        $out = [];
        if (empty($row['id'])) {
            $out['code'] = next_code('customers', 'CUS');
            $out['opening_balance'] = 0;
        }
        return $out;
    },
];

crud_handle($spec);

$debtors = customer_balances(true);
$totalDebt = sum_col($debtors, 'balance');

page_header('شیت مشتریان', ['actions' =>
    '<a class="btn btn-primary" href="customers.php?action=new">' . icon('plus') . ' ثبت مشتری جدید</a>'
  . '<a class="btn" href="reports_other.php?tab=balances">' . icon('list') . ' راپور باقی مانده بدهی‌ها</a>']);
?>
<div class="stats">
  <?php
    stat_card('تعداد مشتریان', fmt((int) Db::val('SELECT COUNT(*) FROM customers', [], 0)) . ' مورد');
    stat_card('مجموع باقی مانده بدهی', fmt_afn($totalDebt), 'تعداد بدهکاران: ' . fmt(count($debtors)), 'bad');
    stat_card('مجموع فروشات قرضه', fmt_afn(Db::num("SELECT COALESCE(SUM(total_amount),0) FROM sales WHERE payment_type='باقی'")), '', 'warn');
    stat_card('مجموع رسیدات وصول شده', fmt_afn(Db::num('SELECT COALESCE(SUM(amount),0) FROM receipts')), '', 'good');
  ?>
</div>
<?php
crud_render($spec);
page_footer();
