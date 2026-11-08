<?php
/**
 * شیت فروشات
 */
require_once __DIR__ . '/app/bootstrap.php';
app_boot();
require_login();

/** لیست مشتریان برای حالت کشویی */
function customers_options(): array
{
    $out = [];
    foreach (Db::all('SELECT id, code, name FROM customers ORDER BY name') as $c) {
        $out[(int) $c['id']] = $c['name'] . ' (' . $c['code'] . ')';
    }
    return $out;
}

$spec = [
    'table'    => 'sales',
    'entity'   => 'sales',
    'title'    => 'فروشات',
    'singular' => 'بل فروش',
    'page_size' => 25,
    'order'    => 's.sale_date DESC, s.id DESC',
    'list_sql' => "SELECT s.*, (s.volume * s.freight) AS freight_total, (s.volume * s.unit_price) AS goods_total,
                          c.name customer_name, c.code customer_code, m.name material_name
                   FROM sales s
                   LEFT JOIN customers c ON c.id = s.customer_id
                   LEFT JOIN material_types m ON m.id = s.material_id",
    'search'   => ['s.sale_no', 's.bill_no', 's.driver_name', 's.vehicle_plate', 's.destination',
                   'c.name', 'c.code', 'm.name'],
    'filters'  => [
        ['name' => 'from', 'label' => 'از تاریخ', 'type' => 'date', 'col' => 's.sale_date', 'op' => '>='],
        ['name' => 'to',   'label' => 'تا تاریخ', 'type' => 'date', 'col' => 's.sale_date', 'op' => '<='],
        ['name' => 'customer_id', 'label' => 'مشتری', 'type' => 'select', 'col' => 's.customer_id',
         'options' => fn() => customers_options(), 'all_label' => 'همه مشتریان'],
        ['name' => 'material_id', 'label' => 'نوع مواد', 'type' => 'select', 'col' => 's.material_id',
         'options' => fn() => material_options(), 'all_label' => 'همه مواد'],
        ['name' => 'payment_type', 'label' => 'نوع پرداخت', 'type' => 'select', 'col' => 's.payment_type',
         'options' => ['نقده' => 'نقده', 'باقی' => 'باقی'], 'all_label' => 'همه'],
    ],
    'cols' => [
        ['label' => 'شماره', 'key' => 'sale_no', 'class' => 'nowrap'],
        ['label' => 'تاریخ', 'key' => 'sale_date', 'fmt' => 'date', 'class' => 'nowrap'],
        ['label' => 'کد مشتری', 'key' => 'customer_code', 'class' => 'nowrap'],
        ['label' => 'نام مشتری', 'key' => 'customer_name'],
        ['label' => 'بلنمبر فروش', 'key' => 'bill_no', 'class' => 'nowrap'],
        ['label' => 'نام دریور', 'key' => 'driver_name'],
        ['label' => 'پلیت موتر', 'key' => 'vehicle_plate', 'class' => 'nowrap'],
        ['label' => 'مقصد', 'key' => 'destination'],
        ['label' => 'نوع مواد', 'key' => 'material_name'],
        ['label' => 'متراژ (م³)', 'key' => 'volume', 'fmt' => 'volume', 'num' => true],
        ['label' => 'قیمت فی متر', 'key' => 'unit_price', 'fmt' => 'money', 'num' => true],
        ['label' => 'کرایه فی متر', 'key' => 'freight', 'fmt' => 'money', 'num' => true],
        ['label' => 'مجموع کرایه', 'key' => 'freight_total', 'fmt' => 'money', 'num' => true],
        ['label' => 'مجموع قیمت و کرایه', 'key' => 'total_amount', 'fmt' => 'money', 'num' => true],
        ['label' => 'نوع پرداخت', 'key' => 'payment_type', 'fmt' => 'badge', 'map' => ['نقده' => 'ok', 'باقی' => 'warn']],
        ['label' => 'توضیحات', 'key' => 'notes', 'render' => fn($r) => e(str_excerpt($r['notes'], 28))],
        ['label' => 'عملیات', 'render' => function ($r) {
            return row_actions([], $r, [
                'بل' => 'sales_print.php?id=' . (int) $r['id'],
                'حساب مشتری' => 'reports_other.php?tab=statement&customer_id=' . (int) $r['customer_id'],
            ]);
        }],
    ],
    'totals' => [['key' => 'volume'], ['key' => 'freight_total'], ['key' => 'total_amount']],
    'foot_note' => 'مجموع این صفحه:',
    'sortable' => ['sale_date' => 's.sale_date', 'total' => 's.total_amount', 'volume' => 's.volume'],
    'fields' => [
        ['name' => 'sale_no', 'label' => 'شماره', 'type' => 'readonly', 'col' => 'third',
         'auto' => ['series' => 'S', 'year_from' => 'sale_date', 'pad' => 4],
         'help' => 'شماره به صورت خودکار ساخته می‌شود'],
        ['name' => 'sale_date', 'label' => 'تاریخ', 'type' => 'date', 'required' => true, 'col' => 'third',
         'default' => today_ymd()],
        ['name' => 'customer_id', 'label' => 'کد مشتری / نام مشتری', 'type' => 'select', 'required' => true,
         'col' => 'third', 'options' => fn() => customers_options(),
         'help' => 'مشتری جدید را اول از شیت مشتریان ثبت کنید'],
        ['name' => 'bill_no', 'label' => 'بلنمبر فروش', 'type' => 'text', 'col' => 'third'],
        ['name' => 'driver_name', 'label' => 'نام دریور', 'type' => 'text', 'col' => 'third',
         'datalist' => fn() => distinct_values('sales', 'driver_name')],
        ['name' => 'vehicle_plate', 'label' => 'پلیت موتر', 'type' => 'text', 'col' => 'third',
         'datalist' => fn() => distinct_values('sales', 'vehicle_plate')],
        ['name' => 'destination', 'label' => 'مقصد', 'type' => 'text', 'col' => 'third',
         'datalist' => fn() => distinct_values('sales', 'destination')],
        ['name' => 'material_id', 'label' => 'نوع مواد', 'type' => 'select', 'required' => true, 'col' => 'third',
         'lookup' => 'material_types'],
        ['name' => 'volume', 'label' => 'متراژ (متر مکعب)', 'type' => 'money', 'required' => true, 'col' => 'third',
         'placeholder' => 'مثلاً 12'],
        ['name' => 'unit_price', 'label' => 'قیمت فی متر', 'type' => 'money', 'required' => true, 'col' => 'third'],
        ['name' => 'freight', 'label' => 'کرایه فی متر', 'type' => 'money', 'col' => 'third',
         'help' => 'کرایه به ازای هر متر مکعب (م³) — مجموع کرایه خودکار حساب می‌شود'],
        ['name' => 'freight_total', 'label' => 'مجموع کرایه', 'type' => 'readonly', 'col' => 'third',
         'no_save' => true, 'help' => 'متراژ × کرایه فی متر'],
        ['name' => 'total_amount', 'label' => 'مجموع قیمت و کرایه', 'type' => 'readonly', 'col' => 'third',
         'help' => '(متراژ × قیمت فی متر) + (متراژ × کرایه فی متر)'],
        ['name' => 'payment_type', 'label' => 'نوع پرداخت', 'type' => 'select', 'required' => true, 'col' => 'third',
         'options' => ['نقده' => 'نقده', 'باقی' => 'باقی']],
        ['name' => 'notes', 'label' => 'توضیحات', 'type' => 'textarea', 'col' => 'full'],
    ],
    'defaults' => function (array $row) {
        $out = [];
        if (empty($row['id'])) {
            $out['sale_no'] = Db::peekNumber('S', cal_year());
            $out['payment_type'] = 'نقده';
            if (get('customer_id')) {
                $out['customer_id'] = (int) get('customer_id');
            }
        }
        return $out;
    },
    'compute' => function (array $d) {
        // کرایه «فی متر» است: مجموع = (متراژ × قیمت فی متر) + (متراژ × کرایه فی متر)
        $volume = (float) ($d['volume'] ?? 0);
        $goods  = $volume * (float) ($d['unit_price'] ?? 0);
        $freight = $volume * (float) ($d['freight'] ?? 0);
        $d['total_amount'] = round($goods + $freight, 2);
        return $d;
    },
    'form_extra' => '<div class="alert alert-info">مجموع به صورت خودکار محاسبه می‌شود: '
                  . '<b>مجموع قیمت و کرایه = (متراژ × قیمت فی متر) + (متراژ × کرایه فی متر)</b>. '
                  . 'کرایه را «فی متر» (به ازای هر متر مکعب) بنویسید؛ مثلاً متراژ ۱۰ و کرایه فی متر ۳۰۰ → مجموع کرایه ۳٬۰۰۰ افغانی. '
                  . 'برای مشتریان قرضه‌دار، «نوع پرداخت» را روی «باقی» بگذارید تا در باقی مانده بدهی او شامل شود.</div>',
];

crud_handle($spec);

page_header('شیت فروشات', ['actions' => '<a class="btn btn-primary" href="sales.php?action=new">' . icon('plus') . ' ثبت فروش جدید</a>']);
crud_render($spec);
page_footer();
