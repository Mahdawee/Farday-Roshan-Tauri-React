<?php
/**
 * شیت مصارف
 */
require_once __DIR__ . '/app/bootstrap.php';
app_boot();
require_login();

$spec = [
    'table'    => 'expenses',
    'entity'   => 'expenses',
    'title'    => 'مصارف',
    'singular' => 'مصرف',
    'page_size' => 25,
    'order'    => 'e.expense_date DESC, e.id DESC',
    'list_sql' => "SELECT e.*, t.name etype, p.name payer
                   FROM expenses e
                   LEFT JOIN expense_types t ON t.id = e.expense_type_id
                   LEFT JOIN payers p ON p.id = e.payer_id",
    'search'   => ['e.expense_no', 'e.description', 'e.purchase_bill_no', 'e.shop_name', 'p.name'],
    'filters'  => [
        ['name' => 'from', 'label' => 'از تاریخ', 'type' => 'date', 'col' => 'e.expense_date', 'op' => '>='],
        ['name' => 'to',   'label' => 'تا تاریخ', 'type' => 'date', 'col' => 'e.expense_date', 'op' => '<='],
        ['name' => 'expense_type_id', 'label' => 'انواع مصرف - مربوط', 'type' => 'select', 'col' => 'e.expense_type_id',
         'options' => fn() => lookup_options('expense_types'), 'all_label' => 'همه انواع'],
        ['name' => 'payer_id', 'label' => 'پرداخت کننده', 'type' => 'select', 'col' => 'e.payer_id',
         'options' => fn() => lookup_options('payers'), 'all_label' => 'همه'],
        ['name' => 'payment_method', 'label' => 'روش پرداخت', 'type' => 'select', 'col' => 'e.payment_method',
         'options' => ['نقده' => 'نقده', 'باقی' => 'باقی'], 'all_label' => 'همه'],
    ],
    'cols' => [
        ['label' => 'شماره', 'key' => 'expense_no', 'class' => 'nowrap'],
        ['label' => 'تاریخ', 'key' => 'expense_date', 'fmt' => 'date', 'class' => 'nowrap'],
        ['label' => 'شرح', 'key' => 'description'],
        ['label' => 'انواع مصرف - مربوط', 'key' => 'etype'],
        ['label' => 'نمبر بل خرید', 'key' => 'purchase_bill_no', 'class' => 'nowrap'],
        ['label' => 'نام فروشگاه / از دوکان', 'key' => 'shop_name'],
        ['label' => 'مبلغ افغانی', 'key' => 'amount_afn', 'fmt' => 'money', 'num' => true],
        ['label' => 'مبلغ دالری', 'key' => 'amount_usd', 'fmt' => 'money_usd', 'num' => true],
        ['label' => 'پرداخت کننده', 'key' => 'payer'],
        ['label' => 'روش پرداخت', 'key' => 'payment_method', 'fmt' => 'badge', 'map' => ['نقده' => 'ok', 'باقی' => 'warn']],
        ['label' => 'توضیحات', 'key' => 'notes', 'render' => fn($r) => e(str_excerpt($r['notes'], 25))],
        ['label' => 'عملیات', 'render' => fn($r) => row_actions([], $r)],
    ],
    'totals' => [['key' => 'amount_afn'], ['key' => 'amount_usd']],
    'foot_note' => 'مجموع این صفحه:',
    'sortable' => ['date' => 'e.expense_date', 'afn' => 'e.amount_afn', 'usd' => 'e.amount_usd'],
    'fields' => [
        ['name' => 'expense_no', 'label' => 'شماره', 'type' => 'readonly', 'col' => 'third',
         'auto' => ['series' => 'E', 'year_from' => 'expense_date', 'pad' => 4],
         'help' => 'شماره به صورت خودکار ساخته می‌شود'],
        ['name' => 'expense_date', 'label' => 'تاریخ', 'type' => 'date', 'required' => true, 'col' => 'third',
         'default' => today_ymd()],
        ['name' => 'expense_type_id', 'label' => 'انواع مصرف - مربوط', 'type' => 'select', 'col' => 'third',
         'lookup' => 'expense_types'],
        ['name' => 'description', 'label' => 'شرح', 'type' => 'text', 'required' => true, 'col' => 'half',
         'placeholder' => 'مثلاً: خرید تیل دیزل برای لودر'],
        ['name' => 'purchase_bill_no', 'label' => 'نمبر بل خرید', 'type' => 'text', 'col' => 'third'],
        ['name' => 'shop_name', 'label' => 'نام فروشگاه / از دوکان', 'type' => 'text', 'col' => 'third',
         'datalist' => fn() => distinct_values('expenses', 'shop_name')],
        ['name' => 'amount_afn', 'label' => 'مبلغ افغانی', 'type' => 'money', 'col' => 'third'],
        ['name' => 'amount_usd', 'label' => 'مبلغ دالری', 'type' => 'money', 'col' => 'third',
         'help' => 'مبلغ دالری جداگانه نگهداری می‌شود و به افغانی تبدیل نمی‌شود'],
        ['name' => 'payer_id', 'label' => 'پرداخت کننده', 'type' => 'select', 'col' => 'third',
         'lookup' => 'payers', 'help' => 'دخل، احمد و ...'],
        ['name' => 'payment_method', 'label' => 'روش پرداخت', 'type' => 'select', 'required' => true, 'col' => 'third',
         'options' => ['نقده' => 'نقده', 'باقی' => 'باقی']],
        ['name' => 'notes', 'label' => 'توضیحات', 'type' => 'textarea', 'col' => 'full'],
    ],
    'defaults' => function (array $row) {
        $out = [];
        if (empty($row['id'])) {
            $out['expense_no'] = Db::peekNumber('E', cal_year());
            $out['payment_method'] = 'نقده';
            $payer = Db::val("SELECT id FROM payers WHERE name='دخل' LIMIT 1");
            if ($payer) {
                $out['payer_id'] = (int) $payer;
            }
        }
        return $out;
    },
    'compute' => function (array $d) {
        if ((float) ($d['amount_afn'] ?? 0) <= 0 && (float) ($d['amount_usd'] ?? 0) <= 0) {
            throw new RuntimeException('یکی از مبلغ افغانی یا مبلغ دالری باید نوشته شود.');
        }
        return $d;
    },
];

crud_handle($spec);

page_header('شیت مصارف', ['actions' => '<a class="btn btn-primary" href="expenses.php?action=new">' . icon('plus') . ' ثبت مصرف جدید</a>']);
crud_render($spec);
page_footer();
