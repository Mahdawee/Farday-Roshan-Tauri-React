<?php
/**
 * سابقه فعالیت‌های کاربران
 */
require_once __DIR__ . '/app/bootstrap.php';
app_boot();
require_admin();

$from = parse_date_input(get('from')) ?: date('Y-m-d', strtotime('-30 day'));
$to   = parse_date_input(get('to'))   ?: today_ymd();
$entity = get('entity');
$page = max(1, (int) get('page', 1));
$per = 50;

$where = 'a.created_at BETWEEN ? AND ?';
$params = [$from . ' 00:00:00', $to . ' 23:59:59'];
if ($entity) {
    $where .= ' AND a.entity=?';
    $params[] = $entity;
}

$total = (int) Db::val("SELECT COUNT(*) FROM activity_log a WHERE $where", $params, 0);
$rows = Db::all("SELECT a.*, u.full_name FROM activity_log a LEFT JOIN users u ON u.id=a.user_id
                 WHERE $where ORDER BY a.id DESC LIMIT " . (($page - 1) * $per) . ", $per", $params);
$entities = Db::all('SELECT DISTINCT entity FROM activity_log ORDER BY entity');

$actions = ['login' => 'ورود', 'logout' => 'خروج', 'create' => 'ثبت', 'update' => 'ویرایش',
            'delete' => 'حذف', 'export' => 'خروجی', 'save' => 'ذخیره', 'backup' => 'پشتیبان'];

page_header('سابقه فعالیت‌ها', ['actions' => print_button()]);
?>
<form method="get" class="filters no-print">
  <div class="filter-item"><label>از تاریخ</label><input type="text" name="from" class="date-input" value="<?= e(fdate($from)) ?>"></div>
  <div class="filter-item"><label>تا تاریخ</label><input type="text" name="to" class="date-input" value="<?= e(fdate($to)) ?>"></div>
  <div class="filter-item"><label>بخش</label>
    <select name="entity"><option value="">همه بخش‌ها</option>
      <?php foreach ($entities as $en): ?>
        <option value="<?= e($en['entity']) ?>" <?= $entity === $en['entity'] ? 'selected' : '' ?>><?= e($en['entity']) ?></option>
      <?php endforeach; ?>
    </select></div>
  <div class="filter-item btn-cell"><button class="btn" type="submit">نمایش</button>
    <a class="btn btn-outline" href="activity.php">بازنشانی</a></div>
</form>

<div class="card">
  <div class="card-head"><h2>سابقه کارها</h2><span class="muted">مجموع: <?= fmt($total) ?> رکورد</span></div>
  <div class="table-wrap">
    <table class="grid">
      <thead><tr><th>#</th><th>زمان</th><th>کاربر</th><th>عمل</th><th>بخش</th><th>شناسه</th><th>تفصیل</th></tr></thead>
      <tbody>
      <?php foreach ($rows as $r): ?>
        <tr>
          <td class="num"><?= (int) $r['id'] ?></td>
          <td class="nowrap"><?= e(fdate(substr($r['created_at'], 0, 10)) . ' — ' . substr($r['created_at'], 11, 5)) ?></td>
          <td><?= e($r['full_name'] ?: $r['username']) ?></td>
          <td><span class="badge <?= $r['action'] === 'delete' ? 'badge-bad' : ($r['action'] === 'create' ? 'badge-ok' : 'badge-info') ?>">
            <?= e($actions[$r['action']] ?? $r['action']) ?></span></td>
          <td><?= e($r['entity']) ?></td>
          <td class="num"><?= e($r['entity_id']) ?></td>
          <td><?= e($r['details']) ?></td>
        </tr>
      <?php endforeach; ?>
      <?php if (!$rows): ?><tr><td colspan="7" class="empty">در این بازه فعالیتی ثبت نشده است.</td></tr><?php endif; ?>
      </tbody>
    </table>
  </div>
  <?php $pages = max(1, (int) ceil($total / $per)); if ($pages > 1): ?>
    <div class="pager no-print">
      <?php if ($page > 1): ?><a class="btn btn-sm" href="<?= e(url_with(['page' => $page - 1])) ?>">قبلی</a><?php endif; ?>
      <span>صفحه <?= fmt($page) ?> از <?= fmt($pages) ?></span>
      <?php if ($page < $pages): ?><a class="btn btn-sm" href="<?= e(url_with(['page' => $page + 1])) ?>">بعدی</a><?php endif; ?>
    </div>
  <?php endif; ?>
</div>
<?php page_footer(); ?>
