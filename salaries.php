<?php
/**
 * شیت معاشات
 */
require_once __DIR__ . '/app/bootstrap.php';
app_boot();
require_login();

function salary_employees(): array
{
    $out = [];
    foreach (Db::all("SELECT id, emp_code, full_name, base_salary FROM employees ORDER BY status, full_name") as $e) {
        $out[(int) $e['id']] = $e['full_name'] . ' (' . $e['emp_code'] . ')';
    }
    return $out;
}

$spec = [
    'table'   => 'salaries',
    'entity'  => 'salaries',
    'title'   => 'معاشات',
    'singular' => 'پرداخت معاش',
    'page_size' => 25,
    'order'   => 's.pay_date DESC, s.id DESC',
    'list_sql' => "SELECT s.*, e.full_name emp_name, e.emp_code, e.job_title, p.name payer
                   FROM salaries s
                   JOIN employees e ON e.id = s.employee_id
                   LEFT JOIN payers p ON p.id = s.payer_id",
    'search'  => ['s.salary_no', 'e.full_name', 'e.emp_code', 'p.name'],
    'filters' => [
        ['name' => 'from', 'label' => 'از تاریخ', 'type' => 'date', 'col' => 's.pay_date', 'op' => '>='],
        ['name' => 'to',   'label' => 'تا تاریخ', 'type' => 'date', 'col' => 's.pay_date', 'op' => '<='],
        ['name' => 'employee_id', 'label' => 'کارمند', 'type' => 'select', 'col' => 's.employee_id',
         'options' => fn() => salary_employees(), 'all_label' => 'همه کارمندان'],
        ['name' => 'payment_type', 'label' => 'نوع پرداخت', 'type' => 'select', 'col' => 's.payment_type',
         'options' => ['نقد' => 'نقد', 'حواله' => 'حواله'], 'all_label' => 'همه'],
    ],
    'cols' => [
        ['label' => 'شماره', 'key' => 'salary_no', 'class' => 'nowrap'],
        ['label' => 'ماه/سال', 'key' => 'pay_month', 'fmt' => 'month', 'class' => 'nowrap'],
        ['label' => 'تاریخ پرداخت', 'key' => 'pay_date', 'fmt' => 'date', 'class' => 'nowrap'],
        ['label' => 'کد کارمند', 'key' => 'emp_code', 'class' => 'nowrap'],
        ['label' => 'نام', 'key' => 'emp_name'],
        ['label' => 'وظیفه', 'key' => 'job_title'],
        ['label' => 'معاش ثابت', 'key' => 'base_salary', 'fmt' => 'money', 'num' => true],
        ['label' => 'پاداش', 'key' => 'bonus', 'fmt' => 'money', 'num' => true],
        ['label' => 'جریمه', 'key' => 'fine', 'fmt' => 'money', 'num' => true],
        ['label' => 'اضافه کاری', 'key' => 'overtime_pay', 'fmt' => 'money', 'num' => true],
        ['label' => 'مجموع پرداخت', 'key' => 'total_pay', 'fmt' => 'money', 'num' => true],
        ['label' => 'پرداخت کننده', 'key' => 'payer'],
        ['label' => 'نوع پرداخت', 'key' => 'payment_type', 'fmt' => 'badge', 'map' => ['نقد' => 'ok', 'حواله' => 'info']],
        ['label' => 'عملیات', 'render' => fn($r) => row_actions([], $r, [
            'پروفایل' => 'employee_view.php?id=' . (int) $r['employee_id'],
            'رسید' => 'salary_print.php?id=' . (int) $r['id'],
        ])],
    ],
    'totals' => [['key' => 'base_salary'], ['key' => 'bonus'], ['key' => 'fine'], ['key' => 'overtime_pay'], ['key' => 'total_pay']],
    'foot_note' => 'مجموع این صفحه:',
    'sortable' => ['date' => 's.pay_date', 'total' => 's.total_pay'],
    'fields' => [
        ['name' => 'salary_no', 'label' => 'شماره', 'type' => 'readonly', 'col' => 'third',
         'auto' => ['series' => 'SL', 'year_from' => 'pay_date', 'pad' => 4],
         'help' => 'شماره به صورت خودکار ساخته می‌شود'],
        ['name' => 'pay_month', 'label' => 'ماه', 'type' => 'select', 'required' => true, 'col' => 'third',
         'options' => fn() => month_list()],
        ['name' => 'pay_year', 'label' => 'سال', 'type' => 'int', 'required' => true, 'col' => 'third',
         'default' => (string) cal_year()],
        ['name' => 'pay_date', 'label' => 'تاریخ پرداخت', 'type' => 'date', 'required' => true, 'col' => 'third',
         'default' => today_ymd()],
        ['name' => 'employee_id', 'label' => 'کد کارمند / نام', 'type' => 'select', 'required' => true,
         'col' => 'third', 'options' => fn() => salary_employees()],
        ['name' => 'base_salary', 'label' => 'معاش ثابت', 'type' => 'money', 'required' => true, 'col' => 'third',
         'help' => 'با انتخاب کارمند به صورت خودکار پر می‌شود'],
        ['name' => 'bonus', 'label' => 'پاداش', 'type' => 'money', 'col' => 'third'],
        ['name' => 'fine', 'label' => 'جریمه', 'type' => 'money', 'col' => 'third'],
        ['name' => 'overtime_pay', 'label' => 'اضافه کاری', 'type' => 'money', 'col' => 'third'],
        ['name' => 'total_pay', 'label' => 'مجموع پرداخت', 'type' => 'readonly', 'col' => 'third',
         'help' => 'معاش ثابت + پاداش + اضافه کاری − جریمه'],
        ['name' => 'payer_id', 'label' => 'پرداخت کننده', 'type' => 'select', 'col' => 'third',
         'lookup' => 'payers'],
        ['name' => 'payment_type', 'label' => 'نوع پرداخت', 'type' => 'select', 'required' => true, 'col' => 'third',
         'options' => ['نقد' => 'نقد', 'حواله' => 'حواله']],
        ['name' => 'notes', 'label' => 'توضیحات', 'type' => 'textarea', 'col' => 'full'],
    ],
    'defaults' => function (array $row) {
        $out = [];
        if (empty($row['id'])) {
            $out['salary_no'] = Db::peekNumber('SL', cal_year());
            $out['pay_year'] = cal_year();
            $out['pay_month'] = cal_month();
            $out['payment_type'] = 'نقد';
            if (get('employee_id')) {
                $eid = (int) get('employee_id');
                $out['employee_id'] = $eid;
                $out['base_salary'] = Db::num('SELECT base_salary FROM employees WHERE id=?', [$eid]);
            }
        }
        return $out;
    },
    'compute' => function (array $d) {
        $d['total_pay'] = round((float) $d['base_salary'] + (float) $d['bonus'] + (float) $d['overtime_pay'] - (float) $d['fine'], 2);
        return $d;
    },
    'form_extra' => '<script>
      (function(){
        var map = ' . json_encode(array_reduce(
            Db::all('SELECT id, base_salary FROM employees'),
            function ($c, $e) {
                $c[(string) $e['id']] = (float) $e['base_salary'];
                return $c;
            },
            []
        ), JSON_UNESCAPED_UNICODE) . ';
        var sel = document.getElementById("f_employee_id");
        var base = document.getElementById("f_base_salary");
        if (sel && base) {
          sel.addEventListener("change", function(){
            var v = map[sel.value];
            if (v !== undefined && (!base.value || parseFloat(base.value.replace(/,/g,"")) === 0)) {
              base.value = v;
              base.dispatchEvent(new Event("input", {bubbles:true}));
            }
          });
        }
      })();
    </script>',
];

crud_handle($spec);

page_header('شیت معاشات', ['actions' => '<a class="btn btn-primary" href="salaries.php?action=new">' . icon('plus') . ' پرداخت معاش جدید</a>']);
crud_render($spec);
page_footer();
