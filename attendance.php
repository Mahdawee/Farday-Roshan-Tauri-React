<?php
/**
 * شیت حضور و غیاب کارمندان
 */
require_once __DIR__ . '/app/bootstrap.php';
app_boot();
require_login();

$statuses = ['حاضر', 'غایب', 'رخصت', 'مریض', 'رخصتی رسمی', 'جمعه'];
$letters  = ['حاضر' => 'ح', 'غایب' => 'غ', 'رخصت' => 'ر', 'مریض' => 'م', 'رخصتی رسمی' => 'ع', 'جمعه' => 'ج'];
$colors   = ['حاضر' => 'var(--ok-l)', 'غایب' => 'var(--bad-l)', 'رخصت' => 'var(--warn-l)', 'مریض' => 'var(--info-l)',
             'رخصتی رسمی' => 'var(--bg-2)', 'جمعه' => 'var(--bg-2)'];
$type = get('type', 'day');

// ---------------------------------------------------------------------------
//  ذخیره ورق روزانه (+ امکان پاک کردن ثبت یک کارمند)
// ---------------------------------------------------------------------------
if ($_SERVER['REQUEST_METHOD'] === 'POST' && post('action') === 'save_attendance') {
    csrf_check();
    $date = parse_date_input(post('work_date'));
    $rows = $_POST['att'] ?? [];
    if (!$date) {
        flash('تاریخ درست نیست.', 'error');
        redirect('attendance.php?type=day');
    }
    $saved = 0; $cleared = 0;
    try {
        Db::begin();
        foreach ($rows as $empId => $v) {
            $empId = (int) $empId;
            if ($empId <= 0) {
                continue;
            }
            $clear = !empty($v['clear']);
            if ($clear) {
                $cleared += Db::delete('attendance', '`employee_id`=? AND `work_date`=?', [$empId, $date]);
                continue;
            }
            $status = in_array($v['status'] ?? '', $statuses, true) ? $v['status'] : 'حاضر';
            $data = [
                'employee_id'    => $empId,
                'work_date'      => $date,
                'status'         => $status,
                'check_in'       => !empty($v['check_in']) ? normalize_digits($v['check_in']) . ':00' : null,
                'check_out'      => !empty($v['check_out']) ? normalize_digits($v['check_out']) . ':00' : null,
                'overtime_hours' => parse_number($v['overtime_hours'] ?? 0),
                'notes'          => trim((string) ($v['notes'] ?? '')),
            ];
            $existing = Db::val('SELECT id FROM attendance WHERE employee_id=? AND work_date=?', [$empId, $date]);
            if ($existing) {
                Db::update('attendance', $data, '`id`=?', [$existing]);
            } else {
                Db::insert('attendance', $data);
            }
            $saved++;
        }
        Db::commit();
        log_activity('save', 'attendance', $date, 'ثبت حضور و غیاب روز ' . fdate($date));
        flash('حضور و غیاب روز ' . fdate($date) . ' ثبت شد. (تعداد: ' . fmt($saved) . ' نفر'
            . ($cleared ? '، پاک‌شده: ' . fmt($cleared) : '') . ')', 'success');
    } catch (Throwable $e) {
        Db::rollback();
        flash('ثبت نشد: ' . Db::userError($e), 'error');
    }
    redirect('attendance.php?type=day&date=' . urlencode(post('work_date')));
}

// ---------------------------------------------------------------------------
//  کارمندان فعال
// ---------------------------------------------------------------------------
// کارمندان فعال + کسانی که برای روز جاری ثبت دارند
$employees = Db::all(
    "SELECT id, emp_code, full_name, father_name, job_title, status FROM employees
     WHERE status='فعال' OR id IN (SELECT employee_id FROM attendance WHERE work_date=?)
     ORDER BY emp_code", [today_ymd()]
);
$empActive = $employees;

page_header('شیت حضور و غیاب', ['actions' =>
    '<a class="btn ' . ($type === 'day' ? 'btn-primary' : '') . '" href="attendance.php?type=day">ورق روزانه</a>'
  . '<a class="btn ' . ($type === 'month' ? 'btn-primary' : '') . '" href="attendance.php?type=month">نمای ماهانه</a>'
  . '<a class="btn ' . ($type === 'summary' ? 'btn-primary' : '') . '" href="attendance.php?type=summary">راپور حضور</a>'
  . print_button()]);
?>

<?php if ($type === 'day'):
    $date = parse_date_input(get('date')) ?: today_ymd();
    $existing = [];
    foreach (Db::all('SELECT * FROM attendance WHERE work_date=?', [$date]) as $a) {
        $existing[(int) $a['employee_id']] = $a;
    }
    $isFriday = date('w', strtotime($date)) == 5;
    ?>
    <form method="get" class="filters no-print">
      <input type="hidden" name="type" value="day">
      <div class="filter-item"><label>تاریخ ورق</label>
        <input type="text" name="date" class="date-input" value="<?= e(fdate($date)) ?>"></div>
      <div class="filter-item btn-cell">
        <button class="btn" type="submit">نمایش</button>
        <a class="btn btn-outline" href="attendance.php?type=day">امروز</a>
      </div>
      <div class="filter-item grow" style="align-items:flex-end">
        <div class="row-actions">
          <button type="button" class="btn btn-sm" data-set-all="حاضر">همه حاضر</button>
          <button type="button" class="btn btn-sm" data-set-all="رخصتی رسمی">همه رخصتی رسمی</button>
          <label class="checkbox" style="margin-right:8px"><input type="checkbox" id="markAll"> علامت‌گذاری همه برای پاک کردن</label>
        </div>
      </div>
    </form>

    <form method="post">
      <?= csrf_field() ?>
      <input type="hidden" name="action" value="save_attendance">
      <input type="hidden" name="work_date" value="<?= e(fdate($date)) ?>">
      <div class="card">
        <div class="card-head">
          <h2>ورق حضور و غیاب روز <?= e(fdate($date, true)) ?> — <?= e(weekday_name($date)) ?><?= $isFriday ? ' (جمعه)' : '' ?></h2>
          <span class="badge badge-<?= $existing ? (count($existing) >= count($empActive) ? 'ok' : 'warn') : 'info' ?>">
            ثبت‌شده: <?= fmt(count($existing)) ?> از <?= fmt(count($empActive)) ?></span>
          <span class="muted">تعداد کارمندان: <?= fmt(count($empActive)) ?></span>
        </div>
        <div class="table-wrap">
          <table class="grid">
            <thead><tr>
              <th>شماره</th><th>کد کارمند</th><th>نام</th><th>نام پدر</th><th>وظیفه</th>
              <th>وضعیت</th><th>ساعت ورود</th><th>ساعت خروج</th><th>اضافه کاری (ساعت)</th><th>ملاحظات</th><th class="no-print">پاک کردن</th>
            </tr></thead>
            <tbody>
            <?php foreach ($empActive as $i => $emp):
                $a = $existing[(int) $emp['id']] ?? null;
                $st = $a['status'] ?? ($isFriday ? 'جمعه' : 'حاضر');
                ?>
              <tr>
                <td><?= fmt($i + 1) ?></td>
                <td class="nowrap"><?= e($emp['emp_code']) ?></td>
                <td><?= e($emp['full_name']) ?></td>
                <td><?= e($emp['father_name']) ?></td>
                <td><?= e($emp['job_title']) ?></td>
                <td>
                  <select name="att[<?= (int) $emp['id'] ?>][status]" class="att-status">
                    <?php foreach ($statuses as $s): ?>
                      <option value="<?= e($s) ?>" <?= $st === $s ? 'selected' : '' ?>><?= e($s) ?></option>
                    <?php endforeach; ?>
                  </select>
                </td>
                <td><input type="text" name="att[<?= (int) $emp['id'] ?>][check_in]" style="width:90px"
                           value="<?= e($a && $a['check_in'] ? substr($a['check_in'], 0, 5) : ($st === 'حاضر' ? '08:00' : '')) ?>" placeholder="08:00"></td>
                <td><input type="text" name="att[<?= (int) $emp['id'] ?>][check_out]" style="width:90px"
                           value="<?= e($a && $a['check_out'] ? substr($a['check_out'], 0, 5) : ($st === 'حاضر' ? '16:30' : '')) ?>" placeholder="16:30"></td>
                <td><input type="text" name="att[<?= (int) $emp['id'] ?>][overtime_hours]" style="width:70px" class="num-input"
                           value="<?= e($a ? rtrim(rtrim((string) $a['overtime_hours'], '0'), '.') : '0') ?>"></td>
                <td><input type="text" name="att[<?= (int) $emp['id'] ?>][notes]" value="<?= e($a['notes'] ?? '') ?>"></td>
                <td class="no-print"><input type="checkbox" class="att-check" name="att[<?= (int) $emp['id'] ?>][clear]" value="1"></td>
              </tr>
            <?php endforeach; ?>
            <?php if (!$empActive): ?>
              <tr><td colspan="11" class="empty">ابتدا کارمندان را در شیت کارمندان ثبت کنید.</td></tr>
            <?php endif; ?>
            </tbody>
          </table>
        </div>
        <div class="form-actions">
          <button class="btn btn-primary" type="submit"><?= icon('save') ?> ذخیره حضور و غیاب این روز</button>
          <span class="muted" style="align-self:center;font-size:12.5px">ورق‌های ثبت‌شده دوباره قابل ویرایش هستند.</span>
        </div>
      </div>
    </form>

<?php elseif ($type === 'month'):
    $year  = (int) get('year', cal_year());
    $month = (int) get('month', cal_month());
    $empId = (int) get('employee_id', 0);
    [$from, $to] = period_range($year, $month);
    $days = cal_mode() === 'miladi' ? (int) date('t', strtotime($from)) : jalali_month_days($year, $month);
    // فهرست کارمندان (همه یا یک کارمند)
    if ($empId) {
        $list = Db::all("SELECT id, emp_code, full_name, job_title FROM employees WHERE id=? ORDER BY emp_code", [$empId]);
    } else {
        $list = Db::all("SELECT id, emp_code, full_name, job_title FROM employees ORDER BY emp_code");
    }

    $data = [];
    $sql = "SELECT * FROM attendance WHERE work_date BETWEEN ? AND ?";
    $params = [$from, $to];
    if ($empId) {
        $sql .= ' AND employee_id=?';
        $params[] = $empId;
    }
    foreach (Db::all($sql, $params) as $a) {
        $data[(int) $a['employee_id']][$a['work_date']] = $a;
    }
    // روزهای ماه
    $dayList = [];
    for ($d = 1; $d <= $days; $d++) {
        $g = cal_mode() === 'miladi'
            ? sprintf('%04d-%02d-%02d', $year, $month, $d)
            : sprintf('%04d-%02d-%02d', ...jalali_to_gregorian($year, $month, $d));
        $dayList[$d] = $g;
    }
    ?>
    <form method="get" class="filters no-print">
      <input type="hidden" name="type" value="month">
      <div class="filter-item"><label>سال</label><input type="text" name="year" value="<?= e((string) $year) ?>"></div>
      <div class="filter-item"><label>ماه</label>
        <select name="month"><?php foreach (month_list() as $m => $l): ?>
          <option value="<?= $m ?>" <?= $month == $m ? 'selected' : '' ?>><?= e($l) ?></option><?php endforeach; ?></select>
      </div>
      <div class="filter-item"><label>کارمند</label>
        <select name="employee_id"><option value="">همه کارمندان</option>
          <?php foreach ($empActive as $em): ?>
            <option value="<?= (int) $em['id'] ?>" <?= $empId === (int) $em['id'] ? 'selected' : '' ?>><?= e($em['full_name']) ?></option>
          <?php endforeach; ?></select>
      </div>
      <div class="filter-item btn-cell"><button class="btn" type="submit">نمایش</button>
        <a class="btn btn-outline" href="attendance.php?type=day">اصلاح ورق روزانه</a></div>
    </form>

    <div class="card">
      <div class="card-head"><h2>حضور و غیاب ماه <?= e(fmonth($year, $month)) ?></h2>
        <span class="muted">ح: حاضر | غ: غایب | ر: رخصت | م: مریض | ع: رخصتی رسمی | ج: جمعه | — : ثبت نشده</span></div>
      <div class="table-wrap">
        <table class="grid">
          <thead><tr>
            <th>کد</th><th>نام</th><th>وظیفه</th>
            <?php foreach ($dayList as $d => $g): ?>
              <th class="num" title="<?= e(fdate($g)) ?>"><?= fmt($d) ?></th>
            <?php endforeach; ?>
            <th class="num">حاضر</th><th class="num">غایب</th><th class="num">رخصت/مریض</th>
            <th class="num" title="روزهایی که وضعیت ثبت نشده">ثبت نشده</th><th class="num">اضافه کاری</th>
          </tr></thead>
          <tbody>
          <?php foreach ($list as $emp):
              $present = $absent = $leave = 0; $ot = 0.0; ?>
            <tr>
              <td class="nowrap"><?= e($emp['emp_code']) ?></td>
              <td class="nowrap"><a href="employee_view.php?id=<?= (int) $emp['id'] ?>"><?= e($emp['full_name']) ?></a></td>
              <td class="nowrap"><?= e($emp['job_title']) ?></td>
              <?php foreach ($dayList as $d => $g):
                  $a = $data[(int) $emp['id']][$g] ?? null;
                  $st = $a['status'] ?? '';
                  if ($st === 'حاضر') { $present++; }
                  if ($st === 'غایب') { $absent++; }
                  if ($st === 'رخصت' || $st === 'مریض') { $leave++; }
                  if ($a) { $ot += (float) $a['overtime_hours']; } ?>
                <td class="num" style="background:<?= $colors[$st] ?? 'transparent' ?>"
                    title="<?= e($st ?: 'ثبت نشده') ?>"><?= $st ? e($letters[$st]) : '—' ?></td>
              <?php endforeach; ?>
              <?php
                // روزهایی که وضعیت ثبت نشده است
                $blank = 0;
                foreach ($dayList as $gd) {
                    if (!isset($data[(int) $emp['id']][$gd])) { $blank++; }
                }
              ?>
              <td class="num"><?= fmt($present) ?></td>
              <td class="num"><?= fmt($absent) ?></td>
              <td class="num"><?= fmt($leave) ?></td>
              <td class="num t-warn"><?= $blank ? fmt($blank) : '—' ?></td>
              <td class="num"><?= fmt($ot, 1) ?></td>
            </tr>
          <?php endforeach; ?>
          <?php if (!$list): ?><tr><td colspan="10" class="empty">کارمندی یافت نشد.</td></tr><?php endif; ?>
          </tbody>
        </table>
      </div>
      <p class="muted" style="font-size:12.5px">برای اصلاح، به «ورق روزانه» همان تاریخ بروید و دوباره ذخیره کنید.</p>
    </div>

<?php else:
    $from = parse_date_input(get('from')) ?: date('Y-m-d', strtotime('-30 day'));
    $to   = parse_date_input(get('to')) ?: today_ymd();
    $rows = attendance_summary($from, $to);
    ?>
    <form method="get" class="filters no-print">
      <input type="hidden" name="type" value="summary">
      <div class="filter-item"><label>از تاریخ</label><input type="text" name="from" class="date-input" value="<?= e(fdate($from)) ?>"></div>
      <div class="filter-item"><label>تا تاریخ</label><input type="text" name="to" class="date-input" value="<?= e(fdate($to)) ?>"></div>
      <div class="filter-item btn-cell"><button class="btn" type="submit">نمایش</button>
        <a class="btn btn-outline" href="<?= e(url_with(['from' => null, 'to' => null])) ?>">سی روز اخیر</a></div>
    </form>

    <div class="card">
      <div class="print-title">
        <h2><?= e(print_header_text()) ?></h2>
        <div class="sub">راپور حضور و غیاب از <?= e(fdate($from)) ?> تا <?= e(fdate($to)) ?></div>
      </div>
      <div class="card-head no-print"><h2>راپور حضور و غیاب از <?= e(fdate($from)) ?> تا <?= e(fdate($to)) ?></h2></div>
      <div class="table-wrap">
        <table class="report">
          <thead><tr><th>کد</th><th>نام</th><th>وظیفه</th><th class="num">حاضر</th><th class="num">غایب</th>
            <th class="num">رخصت/مریض</th><th class="num">رخصتی رسمی</th><th class="num">اضافه کاری (ساعت)</th></tr></thead>
          <tbody>
          <?php
          $t = ['present' => 0, 'absent' => 0, 'leave_' => 0, 'official' => 0, 'overtime' => 0];
          foreach ($rows as $r):
              $t['present'] += (int) $r['present']; $t['absent'] += (int) $r['absent'];
              $t['leave_'] += (int) $r['leave_'] + (int) $r['sick']; $t['official'] += (int) $r['official'];
              $t['overtime'] += (float) $r['overtime']; ?>
            <tr>
              <td><?= e($r['emp_code']) ?></td>
              <td><?= e($r['full_name']) ?></td>
              <td><?= e($r['job_title']) ?></td>
              <td class="num"><?= fmt($r['present']) ?></td>
              <td class="num"><?= fmt($r['absent']) ?></td>
              <td class="num"><?= fmt((int) $r['leave_'] + (int) $r['sick']) ?></td>
              <td class="num"><?= fmt($r['official']) ?></td>
              <td class="num"><?= fmt($r['overtime'], 1) ?></td>
            </tr>
          <?php endforeach; ?>
          <?php if (!$rows): ?><tr><td colspan="8" class="empty">در این بازه معلوماتی ثبت نشده است.</td></tr><?php endif; ?>
          </tbody>
          <?php if ($rows): ?>
          <tfoot><tr><td colspan="3">مجموع</td>
            <td class="num"><?= fmt($t['present']) ?></td><td class="num"><?= fmt($t['absent']) ?></td>
            <td class="num"><?= fmt($t['leave_']) ?></td><td class="num"><?= fmt($t['official']) ?></td>
            <td class="num"><?= fmt($t['overtime'], 1) ?></td></tr></tfoot>
          <?php endif; ?>
        </table>
      </div>
      <a class="btn btn-outline btn-sm no-print" href="reports_other.php?tab=attendance&from=<?= e(fdate($from)) ?>&to=<?= e(fdate($to)) ?>"><?= icon('download') ?> خروجی اکسل این راپور</a>
    </div>
<?php endif; ?>

<?php page_footer(); ?>
