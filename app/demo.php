<?php
/**
 * معلومات نمونه برای آزمایش سیستم (اختیاری — از install.php صدا زده می‌شود)
 */

function demo_data(PDO $pdo, string $dbName): string
{
    // اگر معلوماتی موجود است، تکرار نکن
    $exists = (int) $pdo->query('SELECT COUNT(*) FROM employees')->fetchColumn();
    if ($exists > 0) {
        return 'معلومات نمونه قبلاً ثبت شده بود (تکرار نشد).';
    }

    $now   = new DateTime();
    $today = $now->format('Y-m-d');
    [$jy, $jm, $jd] = gregorian_to_jalali((int) date('Y'), (int) date('n'), (int) date('j'));
    $ins = function (string $table, array $data) use ($pdo) {
        $cols = array_keys($data);
        $sql = 'INSERT INTO `' . $table . '` (`' . implode('`,`', $cols) . '`) VALUES ('
             . implode(',', array_fill(0, count($cols), '?')) . ')';
        $pdo->prepare($sql)->execute(array_values($data));
        return (int) $pdo->lastInsertId();
    };

    // ---------------- مشخصات شرکت ----------------
    $pdo->exec("UPDATE company SET address='کابل، ناحیه ۹، سرک عمومی، شهرک صناعتی',
        finance_manager='حاجی محمد نعیم', supervisor='انجنیر احمد شاه',
        fiscal_year_note='حمل — حوت', employees_count=20, phone='0700 000 000',
        notes='شرکت تولیدی و فروش مواد ساختمانی'");

    // ---------------- ماشینری ----------------
    foreach ([
        ['لودر کوماتسو', 2], ['کرین', 1], ['کمپرسی (ده چرخ)', 4], ['میکسر', 1],
        ['جنراتور', 2], ['تراکتور', 1], ['سنگ شکن (جاو کرش)', 2],
    ] as $i => [$n, $c]) {
        $ins('machines', ['name' => $n, 'count' => $c, 'status' => 'فعال', 'sort_order' => ($i + 1) * 10]);
    }

    // ---------------- کارمندان (۲۰ نفر) ----------------
    $first = ['احمد', 'محمد', 'عبدالله', 'نصرالله', 'غلام', 'سید', 'حکمت', 'نجیب', 'فرهاد', 'نثار',
              'زلمی', 'شکریه', 'نادیه', 'لیلا', 'مریم', 'بلال', 'اسد', 'توحید', 'وحید', 'اسماعیل'];
    $last  = ['شاه', 'نظری', 'احمدی', 'کریمی', 'رحیمی', 'امینی', 'صافی', 'حیدری', 'پوپل', 'جوادی',
              'غفوری', 'سلطانی', 'یوسفی', 'قادری', 'منصوری', 'رستمی', 'بارکزی', 'عتیق', 'زاهدی', 'بلخی'];
    $father = ['عبدالغفور', 'محمد اکرم', 'نور محمد', 'عبدالرحمن', 'سید کاظم', 'غلام سخی', 'محمد یعقوب',
               'عبدالقدیر', 'نورالحق', 'محمد اسماعیل'];
    $jobs = ['مدیر تولید', 'سرپرست کارگاه', 'دریور', 'دریور', 'مشینچی لودر', 'مشینچی کرین',
             'کارگر', 'کارگر', 'کارگر', 'کارگر', 'کارگر', 'کارگر', 'کارگر', 'کارگر',
             'محاسب', 'منشی', 'نگهبان', 'نگهبان', 'آشپز', 'مسئول خرید'];
    $empIds = [];
    for ($i = 0; $i < 20; $i++) {
        $name = $first[$i] . ' ' . $last[$i];
        $hire = sprintf('%04d-%02d-%02d', 2021 + ($i % 4), 3 + ($i % 8), 1 + ($i % 27));
        $salary = 14000 + ($i % 7) * 3500;
        $empIds[] = $ins('employees', [
            'emp_code'          => 'EMP-' . str_pad((string) ($i + 1), 3, '0', STR_PAD_LEFT),
            'full_name'         => $name,
            'father_name'       => $father[$i % count($father)],
            'job_title'         => $jobs[$i],
            'hire_date'         => $hire,
            'base_salary'       => $salary,
            'phone'             => '07' . str_pad((string) (10000000 + $i * 137911), 8, '0', STR_PAD_LEFT),
            'tazkira_no'         => '13' . str_pad((string) (1000 + $i * 37), 8, '0', STR_PAD_LEFT),
            'address'           => 'کابل، ناحیه ' . (1 + $i % 13),
            'contract_duration' => ($i % 3 === 0) ? 'دو سال' : 'یک سال',
            'status'            => 'فعال',
            'notes'             => $i < 3 ? 'کارمند کلیدی شرکت' : '',
        ]);
    }

    // ---------------- مشتریان ----------------
    $custNames = [
        'شرکت ساختمانی شهر نو', 'قرارگاه عمرانی راه', 'شرکت انکشافی پامیر', 'حاجی رحیم الله',
        'شرکت برشنا', 'قرارگاه نظامی', 'شرکت ساختمانی نوی کابل', 'انجنیر نصیر احمد',
        'شرکت اعماراتی زرمینه', 'حاجی زلمی', 'شرکت ترانسپورتی هزاره', 'مکتب خصوصی فردوسی',
    ];
    $custIds = [];
    foreach ($custNames as $i => $cn) {
        $custIds[] = $ins('customers', [
            'code'            => 'CUS-' . str_pad((string) ($i + 1), 3, '0', STR_PAD_LEFT),
            'name'            => $cn,
            'contact_person'  => 'انجنیر ' . $first[($i * 3) % 20] . ' ' . $last[($i * 5) % 20],
            'phone'           => '07' . str_pad((string) (20000000 + $i * 591637), 8, '0', STR_PAD_LEFT),
            'vehicle_plate'   => 'کابل ' . (1000 + $i * 13),
            'opening_balance' => $i % 4 === 0 ? 25000 + $i * 5000 : 0,
            'address'         => 'کابل، ناحیه ' . (2 + $i % 11),
            'notes'           => '',
        ]);
    }

    // ---------------- سایر معلومات کشویی ----------------
    $materials = $pdo->query('SELECT id, name FROM material_types ORDER BY sort_order')->fetchAll(PDO::FETCH_KEY_PAIR);
    $matIds    = array_keys($materials);
    $expTypes  = $pdo->query('SELECT id FROM expense_types')->fetchAll(PDO::FETCH_COLUMN);
    $payerIds  = $pdo->query('SELECT id FROM payers')->fetchAll(PDO::FETCH_COLUMN);
    $sourceIds = $pdo->query('SELECT id FROM receipt_sources')->fetchAll(PDO::FETCH_COLUMN);

    $drivers = ['احمد ولی', 'محمد یوسف', 'نصرالله', 'عبدالباسط', 'گل آقا', 'رحمت الله', 'نیک محمد'];
    $destinations = ['کابل، ناحیه ۵', 'کابل، ناحیه ۹', 'پروان، چاریکار', 'لغمان', 'لوگر، پل علم',
                     'میدان وردک', 'بامیان', 'کابل، شهرک صناعتی'];
    $plates = ['کابل ۱۲۳۴', 'کابل ۵۵۲۱', 'هرات ۴۴۱۲', 'کابل ۸۸۷۷', 'پروان ۳۳۹۱', 'کابل ۱۱۷۶'];
    $related = ['اکتروز سبز شرکت', 'مان کرایی احمد', 'باربری شخصی شرکت', 'کرایه باربری نور', ''];

    $saleSeq = 0; $expSeq = 0; $recSeq = 0; $salSeq = 0;
    $prices = ['ماسه اول' => 700, 'ماسه دوم' => 550, 'ریگ' => 800, 'سنگ غرقه' => 1200,
               'خاک' => 350, 'خامه' => 650, 'ماشک' => 900, 'ریگ باد' => 750, 'سنگ پارچاو' => 1000];

    // ---------------- فروشات (۶ ماه اخیر) ----------------
    for ($d = 175; $d >= 0; $d--) {
        $date = date('Y-m-d', strtotime("-$d day"));
        $cnt = ($d % 7 === 6) ? 0 : random_int(1, 4); // جمعه‌ها تعطیل
        for ($k = 0; $k < $cnt; $k++) {
            $mid = $matIds[array_rand($matIds)];
            $mname = $materials[$mid];
            $volume = random_int(5, 30);
            $price = $prices[$mname] ?? random_int(400, 1200);
            $freightRate = random_int(2, 12) * 50;           // کرایه فی متر (م³)
            $freight = $volume * $freightRate;                 // مجموع کرایه
            $total = $volume * $price + $freight;
            $pay = (random_int(1, 10) <= 7) ? 'نقده' : 'باقی';
            $saleSeq++;
            $parts = gregorian_to_jalali((int) date('Y', strtotime($date)), (int) date('n', strtotime($date)), (int) date('j', strtotime($date)));
            $ins('sales', [
                'sale_no'       => 'S-' . $parts[0] . '-' . str_pad((string) $saleSeq, 4, '0', STR_PAD_LEFT),
                'sale_date'     => $date,
                'customer_id'   => $custIds[array_rand($custIds)],
                'bill_no'       => 'BL-' . $parts[0] . str_pad((string) random_int(1, 900), 3, '0', STR_PAD_LEFT),
                'driver_name'   => $drivers[array_rand($drivers)],
                'vehicle_plate' => $plates[array_rand($plates)],
                'destination'   => $destinations[array_rand($destinations)],
                'material_id'   => $mid,
                'volume'        => $volume,
                'unit_price'    => $price,
                'freight'       => $freightRate,
                'total_amount'  => $total,
                'related_to'    => $related[array_rand($related)],
                'payment_type'  => $pay,
                'notes'         => '',
            ]);
        }
    }
    $parts = gregorian_to_jalali((int) date('Y'), (int) date('n'), (int) date('j'));
    $pdo->exec("INSERT INTO counters (series,yr,value) VALUES ('S',{$parts[0]},{$saleSeq})
                ON DUPLICATE KEY UPDATE value={$saleSeq}");

    // ---------------- مصارف ----------------
    for ($d = 175; $d >= 0; $d -= 2) {
        $date = date('Y-m-d', strtotime("-$d day"));
        foreach ([1, 2] as $k) {
            if (random_int(0, 10) < 3) { continue; }
            $afn = random_int(1, 40) * 500;
            $usd = (random_int(0, 10) < 2) ? random_int(20, 300) : 0;
            $expSeq++;
            $p = gregorian_to_jalali((int) date('Y', strtotime($date)), (int) date('n', strtotime($date)), (int) date('j', strtotime($date)));
            $ins('expenses', [
                'expense_no'       => 'E-' . $p[0] . '-' . str_pad((string) $expSeq, 4, '0', STR_PAD_LEFT),
                'expense_date'     => $date,
                'description'      => ['خرید تیل دیزل', 'خرید پرزه جات موتر', 'ترمیم لودر', 'خرید روغن',
                                       'کرایه موتر کرایه‌ای', 'خرید مواد دفتری', 'خرچ پذیرایی مهمان',
                                       'پرداخت برق', 'خرید سنگ و خاک از معدن', 'خرید تایرسازی'][random_int(0, 9)],
                'expense_type_id'  => $expTypes[array_rand($expTypes)],
                'related_to'       => 'کارگاه سنگ شکن',
                'purchase_bill_no' => 'P-' . random_int(100, 999),
                'shop_name'        => ['دوکان حاجی رحیم', 'مارکت نور', 'پرزه جات کابل', 'تیل فروشی برادران', 'دوکان احمدی'][random_int(0, 4)],
                'amount_afn'       => $afn,
                'amount_usd'       => $usd,
                'payer_id'         => $payerIds[array_rand($payerIds)],
                'payment_method'   => (random_int(1, 10) <= 7) ? 'نقده' : 'باقی',
                'notes'            => '',
            ]);
        }
    }
    $pdo->exec("INSERT INTO counters (series,yr,value) VALUES ('E',{$parts[0]},{$expSeq})
                ON DUPLICATE KEY UPDATE value={$expSeq}");

    // ---------------- رسیدات ----------------
    for ($d = 170; $d >= 0; $d -= 4) {
        $date = date('Y-m-d', strtotime("-$d day"));
        if (random_int(0, 10) < 3) { continue; }
        $recSeq++;
        $p = gregorian_to_jalali((int) date('Y', strtotime($date)), (int) date('n', strtotime($date)), (int) date('j', strtotime($date)));
        $ins('receipts', [
            'receipt_no'      => 'R-' . $p[0] . '-' . str_pad((string) $recSeq, 4, '0', STR_PAD_LEFT),
            'receipt_date'    => $date,
            'customer_id'     => $custIds[array_rand($custIds)],
            'amount'          => random_int(4, 80) * 1000,
            'related_bill_no' => 'BL-' . random_int(100, 999),
            'source_id'       => $sourceIds[array_rand($sourceIds)],
            'received_by'     => ['احمد', 'مدیر مالی', 'نصرالله', 'دخل'][random_int(0, 3)],
            'notes'           => 'پرداخت قسمی از بدهی',
        ]);
    }
    $pdo->exec("INSERT INTO counters (series,yr,value) VALUES ('R',{$parts[0]},{$recSeq})
                ON DUPLICATE KEY UPDATE value={$recSeq}");

    // ---------------- معاشات (۳ ماه اخیر) ----------------
    for ($mBack = 3; $mBack >= 1; $mBack--) {
        $ref = strtotime("-$mBack month");
        $pyParts = gregorian_to_jalali((int) date('Y', $ref), (int) date('n', $ref), 5);
        [$f, $t] = period_range($pyParts[0], $pyParts[1]);
        foreach ($empIds as $idx => $eid) {
            $sal = (float) $pdo->query("SELECT base_salary FROM employees WHERE id=$eid")->fetchColumn();
            $bonus = random_int(0, 10) < 3 ? 2000 : 0;
            $fine = random_int(0, 10) < 2 ? 1000 : 0;
            $ot = random_int(0, 6) * 500;
            $salSeq++;
            $ins('salaries', [
                'salary_no'    => 'SL-' . $pyParts[0] . '-' . str_pad((string) $salSeq, 4, '0', STR_PAD_LEFT),
                'pay_year'     => $pyParts[0],
                'pay_month'    => $pyParts[1],
                'pay_date'     => $t,
                'employee_id'  => $eid,
                'base_salary'  => $sal,
                'bonus'        => $bonus,
                'fine'         => $fine,
                'overtime_pay' => $ot,
                'total_pay'    => $sal + $bonus + $ot - $fine,
                'payer_id'     => $payerIds[0],
                'payment_type' => $idx % 9 === 0 ? 'حواله' : 'نقد',
                'notes'        => '',
            ]);
        }
    }
    $pdo->exec("INSERT INTO counters (series,yr,value) VALUES ('SL',{$parts[0]},{$salSeq})
                ON DUPLICATE KEY UPDATE value={$salSeq}");

    // ---------------- حضور و غیاب (۴۵ روز اخیر) ----------------
    $statuses = ['حاضر', 'حاضر', 'حاضر', 'حاضر', 'حاضر', 'غایب', 'رخصت', 'مریض'];
    for ($d = 45; $d >= 0; $d--) {
        $date = date('Y-m-d', strtotime("-$d day"));
        $isFriday = date('w', strtotime($date)) == 5;
        foreach ($empIds as $eid) {
            $st = $isFriday ? 'جمعه' : $statuses[random_int(0, 7)];
            $ins('attendance', [
                'employee_id'    => $eid,
                'work_date'      => $date,
                'status'         => $st,
                'check_in'       => $st === 'حاضر' ? '08:00:00' : null,
                'check_out'      => $st === 'حاضر' ? '16:30:00' : null,
                'overtime_hours' => ($st === 'حاضر' && random_int(0, 3) === 0) ? 2 : 0,
                'notes'          => '',
            ]);
        }
    }

    return '۲۰ کارمند، ' . count($custNames) . ' مشتری، ' . $saleSeq . ' فروش، ' . $expSeq . ' مصرف، '
         . $recSeq . ' رسید، ' . $salSeq . ' معاش و حضور و غیاب ۴۵ روز.';
}
