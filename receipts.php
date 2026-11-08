<?php
/**
 * شیت رسیدات
 */
require_once __DIR__ . '/app/bootstrap.php';
app_boot();
require_login();

function receipts_customers(): array
{
    $out = [];
    foreach (Db::all('SELECT id, code, name FROM customers ORDER BY name') as $c) {
        $out[(int) $c['id']] = $c['name'] . ' (' . $c['code'] . ')';
    }
    return $out;
}

$spec = [
    'table'   => 'receipts',
    'entity'  => 'receipts',
    'title'   => 'رسیدات',
    'singular' => 'رسید',
    'page_size' => 25,
    'order'   => 'r.receipt_date DESC, r.id DESC',
    'list_sql' => "SELECT r.*, c.name customer_name, c.code customer_code, s.name src
                   FROM receipts r
                   LEFT JOIN customers c ON c.id = r.customer_id
                   LEFT JOIN receipt_sources s ON s.id = r.source_id",
    'search'  => ['r.receipt_no', 'r.related_bill_no', 'r.received_by', 'r.notes', 'c.name', 'c.code'],
    'filters' => [
        ['name' => 'from', 'label' => 'از تاریخ', 'type' => 'date', 'col' => 'r.receipt_date', 'op' => '>='],
        ['name' => 'to',   'label' => 'تا تاریخ', 'type' => 'date', 'col' => 'r.receipt_date', 'op' => '<='],
        ['name' => 'customer_id', 'label' => 'مشتری', 'type' => 'select', 'col' => 'r.customer_id',
         'options' => fn() => receipts_customers(), 'all_label' => 'همه مشتریان'],
        ['name' => 'source_id', 'label' => 'از درک', 'type' => 'select', 'col' => 'r.source_id',
         'options' => fn() => lookup_options('receipt_sources'), 'all_label' => 'همه'],
    ],
    'cols' => [
        ['label' => 'شماره', 'key' => 'receipt_no', 'class' => 'nowrap'],
        ['label' => 'تاریخ', 'key' => 'receipt_date', 'fmt' => 'date', 'class' => 'nowrap'],
        ['label' => 'کد مشتری', 'key' => 'customer_code', 'class' => 'nowrap'],
        ['label' => 'نام مشتری', 'key' => 'customer_name'],
        ['label' => 'مبلغ رسید', 'key' => 'amount', 'fmt' => 'money', 'num' => true],
        ['label' => 'شماره بل مربوط', 'key' => 'related_bill_no', 'class' => 'nowrap'],
        ['label' => 'از درک', 'key' => 'src'],
        ['label' => 'توسط', 'key' => 'received_by'],
        ['label' => 'شرح', 'key' => 'notes'],
        ['label' => 'عملیات', 'render' => fn($r) => row_actions([], $r, [
            'حساب مشتری' => 'reports_other.php?tab=statement&customer_id=' . (int) $r['customer_id'],
        ])],
    ],
    'totals' => [['key' => 'amount']],
    'foot_note' => 'مجموع این صفحه:',
    'sortable' => ['date' => 'r.receipt_date', 'amount' => 'r.amount'],
    'fields' => [
        ['name' => 'receipt_no', 'label' => 'شماره', 'type' => 'readonly', 'col' => 'third',
         'auto' => ['series' => 'R', 'year_from' => 'receipt_date', 'pad' => 4],
         'help' => 'شماره به صورت خودکار ساخته می‌شود'],
        ['name' => 'receipt_date', 'label' => 'تاریخ', 'type' => 'date', 'required' => true, 'col' => 'third',
         'default' => today_ymd()],
        ['name' => 'customer_id', 'label' => 'کد مشتری / نام مشتری', 'type' => 'select', 'required' => true,
         'col' => 'third', 'options' => fn() => receipts_customers()],
        ['name' => 'amount', 'label' => 'مبلغ رسید', 'type' => 'money', 'required' => true, 'col' => 'third'],
        ['name' => 'related_bill_no', 'label' => 'شماره بل مربوط', 'type' => 'text', 'col' => 'third',
         'datalist' => fn() => distinct_values('receipts', 'related_bill_no')],
        ['name' => 'source_id', 'label' => 'از درک', 'type' => 'select', 'col' => 'third',
         'lookup' => 'receipt_sources',
         'help' => 'باقی داری، امانت، بیانیه ...'],
        ['name' => 'received_by', 'label' => 'توسط', 'type' => 'text', 'col' => 'third',
         'datalist' => fn() => distinct_values('receipts', 'received_by'),
         'help' => 'نام شخصی که پول را دریافت کرد'],
        ['name' => 'notes', 'label' => 'شرح', 'type' => 'textarea', 'col' => 'full'],
    ],
    'defaults' => function (array $row) {
        $out = [];
        if (empty($row['id'])) {
            $out['receipt_no'] = Db::peekNumber('R', cal_year());
            $src = Db::val("SELECT id FROM receipt_sources WHERE name='باقی داری' LIMIT 1");
            if ($src) {
                $out['source_id'] = (int) $src;
            }
        }
        return $out;
    },
    'afterSave' => function (array $d, int $id, bool $wasUpdate) {
        // هیچ عملیات اضافی لازم نیست؛ باقی مانده بدهی به صورت زنده محاسبه می‌شود
    },
];

crud_handle($spec);

page_header('شیت رسیدات', ['actions' => '<a class="btn btn-primary" href="receipts.php?action=new">' . icon('plus') . ' ثبت رسید جدید</a>']);
crud_render($spec);
page_footer();
