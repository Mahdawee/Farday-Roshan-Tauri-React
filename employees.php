<?php
/**
 * شیت کارمندان
 */
require_once __DIR__ . '/app/bootstrap.php';
app_boot();
require_login();

$spec = [
    'table'   => 'employees',
    'entity'  => 'employees',
    'title'   => 'کارمندان',
    'singular' => 'کارمند',
    'page_size' => 25,
    'order'   => 'status ASC, emp_code ASC',
    'list_sql' => "SELECT e.*,
                     (SELECT COUNT(*) FROM attendance a WHERE a.employee_id=e.id AND a.status='حاضر') present_days,
                     (SELECT COALESCE(SUM(s.total_pay),0) FROM salaries s WHERE s.employee_id=e.id) paid_total
                   FROM employees e",
    'search'  => ['e.emp_code', 'e.full_name', 'e.father_name', 'e.job_title', 'e.phone', 'e.tazkira_no', 'e.address'],
    'filters' => [
        ['name' => 'status', 'label' => 'وضعیت', 'type' => 'select', 'col' => 'e.status',
         'options' => ['فعال' => 'فعال', 'غیرفعال' => 'غیرفعال'], 'all_label' => 'همه'],
        ['name' => 'job', 'label' => 'وظیفه', 'type' => 'like', 'col' => 'e.job_title', 'placeholder' => 'مثلاً دریور'],
    ],
    'cols' => [
        ['label' => 'شماره', 'render' => fn($r, $i) => fmt($i)],
        ['label' => 'کد کارمند', 'key' => 'emp_code', 'class' => 'nowrap'],
        ['label' => 'نام', 'key' => 'full_name'],
        ['label' => 'نام پدر', 'key' => 'father_name'],
        ['label' => 'وظیفه', 'key' => 'job_title'],
        ['label' => 'تاریخ استخدام', 'key' => 'hire_date', 'fmt' => 'date', 'class' => 'nowrap'],
        ['label' => 'معاش ثابت', 'key' => 'base_salary', 'fmt' => 'money', 'num' => true],
        ['label' => 'شماره تماس', 'key' => 'phone', 'class' => 'nowrap'],
        ['label' => 'شماره تذکره', 'key' => 'tazkira_no', 'class' => 'nowrap'],
        ['label' => 'آدرس', 'key' => 'address'],
        ['label' => 'مدت قرارداد', 'key' => 'contract_duration', 'class' => 'nowrap'],
        ['label' => 'وضعیت', 'key' => 'status', 'fmt' => 'badge', 'map' => ['فعال' => 'ok', 'غیرفعال' => 'bad']],
        ['label' => 'توضیحات', 'key' => 'notes', 'render' => fn($r) => e(str_excerpt($r['notes'], 22))],
        ['label' => 'عملیات', 'render' => fn($r) => row_actions([], $r, [
            'پروفایل' => 'employee_view.php?id=' . (int) $r['id'],
            'حضور' => 'attendance.php?type=month&employee_id=' . (int) $r['id'],
            'معاش' => 'salaries.php?employee_id=' . (int) $r['id'],
        ])],
    ],
    'totals' => [['key' => 'base_salary']],
    'foot_note' => 'مجموع معاش ثابت این صفحه:',
    'fields' => [
        ['name' => 'emp_code', 'label' => 'کد کارمند', 'type' => 'text', 'required' => true, 'unique' => true,
         'col' => 'third', 'help' => 'مثلاً EMP-001'],
        ['name' => 'full_name', 'label' => 'نام و تخلص', 'type' => 'text', 'required' => true, 'col' => 'third'],
        ['name' => 'father_name', 'label' => 'نام پدر', 'type' => 'text', 'col' => 'third'],
        ['name' => 'job_title', 'label' => 'وظیفه', 'type' => 'text', 'col' => 'third',
         'datalist' => fn() => distinct_values('employees', 'job_title')],
        ['name' => 'hire_date', 'label' => 'تاریخ استخدام', 'type' => 'date', 'col' => 'third'],
        ['name' => 'base_salary', 'label' => 'معاش ثابت', 'type' => 'money', 'col' => 'third'],
        ['name' => 'phone', 'label' => 'شماره تماس', 'type' => 'text', 'col' => 'third'],
        ['name' => 'tazkira_no', 'label' => 'شماره تذکره', 'type' => 'text', 'col' => 'third'],
        ['name' => 'address', 'label' => 'آدرس', 'type' => 'text', 'col' => 'half'],
        ['name' => 'contract_duration', 'label' => 'مدت قرارداد', 'type' => 'text', 'col' => 'third',
         'datalist' => fn() => ['یک سال', 'دو سال', 'شش ماه', 'سه ماه', 'دایمی'],
         'help' => 'مثلاً: یک سال، دو سال'],
        ['name' => 'status', 'label' => 'وضعیت', 'type' => 'select', 'required' => true, 'col' => 'third',
         'options' => ['فعال' => 'فعال', 'غیرفعال' => 'غیرفعال']],
        ['name' => 'notes', 'label' => 'توضیحات', 'type' => 'textarea', 'col' => 'full'],
    ],
    'defaults' => function (array $row) {
        $out = [];
        if (empty($row['id'])) {
            $out['emp_code'] = next_code('employees', 'EMP', 3, 'emp_code');
            $out['status'] = 'فعال';
        }
        return $out;
    },
];

crud_handle($spec);

$active = (int) Db::val("SELECT COUNT(*) FROM employees WHERE status='فعال'", [], 0);
$total  = (int) Db::val('SELECT COUNT(*) FROM employees', [], 0);
$sumSalary = Db::num("SELECT COALESCE(SUM(base_salary),0) FROM employees WHERE status='فعال'");

page_header('شیت کارمندان', ['actions' => '<a class="btn btn-primary" href="employees.php?action=new">' . icon('plus') . ' ثبت کارمند جدید</a>']);
?>
<div class="stats">
  <?php
    stat_card('مجموع کارمندان', fmt($total) . ' نفر', 'فعال: ' . fmt($active) . ' نفر');
    stat_card('مجموع معاشات ثابت ماهانه', fmt_afn($sumSalary), 'فقط کارمندان فعال', 'info');
  ?>
</div>
<?php
crud_render($spec);
page_footer();
