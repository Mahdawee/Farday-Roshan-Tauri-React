<?php
/**
 * تنظیمات جداول کشویی — هر کدام در یک صفحه منظم و مستقل:
 *   ۱) اقلام و مواد        ۲) انواع مصرف - مربوط
 *   ۳) پرداخت‌کننده‌گان     ۴) منابع و رسیدات
 *
 * آدرس: settings_lookups.php?t=material_types  (و ...)
 *
 * منطق کار:
 *   • ویرایش نام/واحد/ترتیب → فرم اصلی «ذخیره تغییرات» (با نشانگر ذخیره‌نشده)
 *   • حذف، فعال/غیرفعال و ترتیب → کارهای فوری همان ردیف (بدون انتظار برای ذخیره)
 *   • همه پیام‌ها و پرسش‌ها با «توست» نشان داده می‌شوند (alert مرورگر استفاده نمی‌شود)
 */
require_once __DIR__ . '/app/bootstrap.php';
app_boot();
require_admin();

$LOOKUPS = lookup_tables();
$t = (string) get('t', 'material_types');
if (!isset($LOOKUPS[$t])) {
    $t = 'material_types';
}
$meta = $LOOKUPS[$t];
$table = $meta['table'];

/** شمارش استفاده هر ردیف در اسناد (یک کوئری برای همه ردیف‌ها) */
function lookup_usage(array $meta): array
{
    $out = [];
    foreach (Db::all($meta['usage']) as $r) {
        if ($r['rid'] === null) {
            continue;
        }
        $out[(int) $r['rid']] = (int) $r['n'];
    }
    return $out;
}

/** نام نمایشی ردیف برای پیام‌های این صفحه */
function lookup_label(array $row): string
{
    $n = trim((string) ($row['name'] ?? ''));
    return $n === '' ? 'ردیف #' . (int) ($row['id'] ?? 0) : '«' . $n . '»';
}

/** ترتیب ردیف‌ها را از نو شماره‌گذاری می‌کند (۱۰، ۲۰، ۳۰ ...) */
function lookup_renumber(string $table): void
{
    $ids = array_map('intval', array_column(Db::all("SELECT `id` FROM `$table` ORDER BY `sort_order`, `name`, `id`"), 'id'));
    $order = 10;
    foreach ($ids as $id) {
        Db::update($table, ['sort_order' => $order], '`id`=?', [$id]);
        $order += 10;
    }
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $action = (string) post('action');
    $t = (string) post('t', $t);
    if (!isset($LOOKUPS[$t])) {
        $t = 'material_types';
    }
    $meta  = $LOOKUPS[$t];
    $table = $meta['table'];
    $extra = $meta['extra'];
    $back  = 'settings_lookups.php?t=' . urlencode($t);

    // ================= ۱) ذخیره ویرایش‌ها + ردیف جدید =================
    if ($action === 'lookup_save') {
        $rows   = (array) ($_POST['rows'] ?? []);
        $new    = (array) ($_POST['new'] ?? []);
        $saved = $added = 0;
        $errors = [];

        foreach ($rows as $id => $row) {
            $id = (int) $id;
            if ($id <= 0) {
                continue;
            }
            $name = trim((string) ($row['name'] ?? ''));
            if ($name === '') {
                $errors[] = 'نام خالی را نمی‌توان ذخیره کرد (ردیف ' . $id . ').';
                continue;
            }
            $data = ['name' => $name, 'sort_order' => (int) parse_number($row['sort_order'] ?? 0)];
            if ($extra) {
                $data[$extra['col']] = extra_value($extra, $row);
            }
            try {
                Db::update($table, $data, '`id`=?', [$id]);
                $saved++;
            } catch (Throwable $e) {
                $errors[] = 'نام تکراری: «' . $name . '» ذخیره نشد.';
            }
        }

        // ردیف جدید
        if (!empty($new) && trim((string) ($new['name'] ?? '')) !== '') {
            $data = [
                'name'       => trim((string) $new['name']),
                'sort_order' => (int) parse_number($new['sort_order'] ?? 0),
                'active'     => 1,
            ];
            if ($extra) {
                $data[$extra['col']] = extra_value($extra, $new);
            }
            if (empty($data['sort_order'])) {
                $data['sort_order'] = (int) Db::num("SELECT COALESCE(MAX(`sort_order`),0) FROM `$table`") + 10;
            }
            try {
                Db::insert($table, $data);
                $added++;
            } catch (Throwable $e) {
                $errors[] = 'ثبت نشد (نام تکراری است): «' . $data['name'] . '»';
            }
        }

        if ($saved || $added) {
            $msg = [];
            if ($saved) {
                $msg[] = fmt($saved) . ' ردیف ویرایش شد';
            }
            if ($added) {
                $msg[] = fmt($added) . ' ردیف جدید اضافه شد';
            }
            flash(implode(' — ', $msg) . '.', 'success');
            log_activity('update', 'lookup', $table, implode(' — ', $msg));
        }
        if ($errors) {
            flash(implode('<br>', array_slice($errors, 0, 4)), 'error');
        }
        if (!$saved && !$added && !$errors) {
            flash('تغییری برای ذخیره وجود نداشت.', 'info');
        }
        redirect($back);
    }

    // ================= ۲) حذف یک ردیف (منطق دقیق و امن) =================
    if ($action === 'lookup_delete') {
        $id   = (int) post('id');
        $mode = (string) post('mode', 'auto');   // auto | delete | deactivate
        $row  = Db::one("SELECT * FROM `$table` WHERE `id`=?", [$id]);
        if (!$row) {
            flash('این ردیف پیدا نشد — شاید قبلاً حذف شده است.', 'error');
            redirect($back);
        }
        $usage = lookup_usage($meta);
        $n = (int) ($usage[$id] ?? 0);
        $label = lookup_label($row);

        // ردیفی که در اسناد استفاده شده، حذف نمی‌شود تا سابقه اسناد خراب نشود
        if ($n > 0 && $mode !== 'deactivate') {
            Db::update($table, ['active' => 0], '`id`=?', [$id]);
            log_activity('update', 'lookup', $id, 'غیرفعال شدن به جای حذف — ' . $n . ' سند');
            flash($label . ' در ' . fmt($n) . ' سند استفاده شده است؛ برای اینکه اسناد قبلی خراب نشوند، حذف نشد و'
                . ' <b>غیرفعال</b> شد. (در کشوهای شیت‌ها دیده نمی‌شود ولی در اسناد قدیمی باقی می‌ماند)', 'warn');
            redirect($back);
        }
        if ($mode === 'deactivate') {
            Db::update($table, ['active' => 0], '`id`=?', [$id]);
            log_activity('update', 'lookup', $id, 'غیرفعال شدن دستی');
            if ($n) {
                flash($label . ' غیرفعال شد — در ' . fmt($n) . ' سند استفاده شده است، پس برای محفوظ ماندن سابقه اسناد'
                    . ' حذف نشد. (در کشوهای شیت‌ها دیگر دیده نمی‌شود)', 'warn');
            } else {
                flash($label . ' غیرفعال شد — در کشوهای شیت‌ها دیده نمی‌شود ولی معلومات آن محفوظ است.', 'success');
            }
            redirect($back);
        }
        try {
            Db::delete($table, '`id`=?', [$id]);
            log_activity('delete', 'lookup', $id, 'حذف ردیف فهرست');
            flash($label . ' برای همیشه حذف شد.' . ($n ? '' : ' (در هیچ سندی استفاده نشده بود)'), 'success');
        } catch (Throwable $e) {
            Db::update($table, ['active' => 0], '`id`=?', [$id]);
            flash($label . ' حذف نشد چون در اسناد استفاده شده است — به جای حذف، غیرفعال شد.', 'warn');
        }
        redirect($back);
    }

    // ================= ۳) فعال/غیرفعال کردن یک ردیف =================
    if ($action === 'lookup_toggle') {
        $id  = (int) post('id');
        $row = Db::one("SELECT * FROM `$table` WHERE `id`=?", [$id]);
        if (!$row) {
            flash('این ردیف پیدا نشد.', 'error');
            redirect($back);
        }
        $now = (int) $row['active'] === 1 ? 0 : 1;
        $activeCount = (int) Db::num("SELECT COUNT(*) FROM `$table` WHERE `active`=1");
        Db::update($table, ['active' => $now], '`id`=?', [$id]);
        log_activity('update', 'lookup', $id, $now ? 'فعال شدن' : 'غیرفعال شدن');
        $label = lookup_label($row);
        if ($now) {
            flash($label . ' فعال شد — حالا در کشوی شیت‌ها دیده می‌شود.', 'success');
        } elseif ($activeCount <= 1) {
            flash($label . ' غیرفعال شد — توجه: الآن هیچ ردیف فعالی در این فهرست نیست، پس کشوی مربوطه در شیت‌ها خالی می‌شود.', 'warn');
        } else {
            flash($label . ' غیرفعال شد — در کشوهای شیت‌ها دیده نمی‌شود ولی اسناد قبلی محفوظ است.', 'success');
        }
        redirect($back);
    }

    // ================= ۴) جابجایی ترتیب (یک پله بالا/پایین) =================
    if ($action === 'lookup_move') {
        $id  = (int) post('id');
        $dir = (string) post('dir') === 'up' ? -1 : 1;
        $ids = array_map('intval', array_column(Db::all("SELECT `id` FROM `$table` ORDER BY `sort_order`, `name`, `id`"), 'id'));
        $pos = array_search($id, $ids, true);
        if ($pos !== false) {
            $to = $pos + $dir;
            if ($to >= 0 && $to < count($ids)) {
                $tmp = $ids[$to];
                $ids[$to] = $ids[$pos];
                $ids[$pos] = $tmp;
                $order = 10;
                foreach ($ids as $rid) {
                    Db::update($table, ['sort_order' => $order], '`id`=?', [$rid]);
                    $order += 10;
                }
                $row = Db::one("SELECT `name` FROM `$table` WHERE `id`=?", [$id]);
                flash('ترتیب ' . lookup_label($row ?: ['name' => '']) . ' تغییر کرد (' . ($dir < 0 ? 'یک پله بالاتر' : 'یک پله پایین‌تر') . ').', 'success');
            }
        }
        redirect($back);
    }

    // ================= ۵) افزودن اقلام نمونه =================
    if ($action === 'lookup_samples') {
        $have = [];
        foreach (Db::all("SELECT `name` FROM `$table`") as $r) {
            $have[$r['name']] = true;
        }
        $order = (int) Db::num("SELECT COALESCE(MAX(`sort_order`),0) FROM `$table`");
        $added = 0;
        foreach ($meta['sample'] as $name) {
            if (isset($have[$name])) {
                continue;
            }
            $order += 10;
            $data = ['name' => $name, 'sort_order' => $order, 'active' => 1];
            if ($extra) {
                $data[$extra['col']] = $extra['type'] === 'bool' ? 0 : $extra['default'];
            }
            try {
                Db::insert($table, $data);
                $added++;
            } catch (Throwable $e) {
                // رد شود
            }
        }
        flash($added
            ? fmt($added) . ' ردیف نمونه اضافه شد — حالا می‌توانید نام‌ها را به دلخواه خودتان تغییر دهید.'
            : 'اقلام نمونه از قبل موجود بود.', $added ? 'success' : 'info');
        redirect($back);
    }

    // ================= ۶) فعال/غیرفعال کردن همه =================
    if ($action === 'lookup_all') {
        $v = (string) post('allactive', '1') === '1' ? 1 : 0;
        $n = (int) Db::num("SELECT COUNT(*) FROM `$table`");
        Db::q("UPDATE `$table` SET `active`=? ", [$v]);
        log_activity('update', 'lookup', $table, $v ? 'فعال کردن همه' : 'غیرفعال کردن همه');
        if ($v) {
            flash('همه ' . fmt($n) . ' ردیف فعال شد.', 'success');
        } elseif ($n) {
            flash('همه ردیف‌ها غیرفعال شد — تا وقتی دوباره فعال نکنید، کشوی این فهرست در شیت‌ها خالی می‌شود.', 'warn');
        }
        redirect($back);
    }

    redirect('settings_lookups.php');
}

/** مقدار ستون اضافی (واحد / نوع / تیک) */
function extra_value(array $extra, array $row)
{
    switch ($extra['type']) {
        case 'text':
            $v = trim((string) ($row[$extra['col']] ?? ''));
            return $v === '' ? $extra['default'] : mb_substr($v, 0, 40);
        case 'kind':
            $v = (string) ($row[$extra['col']] ?? '');
            return in_array($v, ['دخل', 'شخصی', 'بانک', 'شرکت'], true) ? $v : 'شخصی';
        case 'bool':
            return empty($row[$extra['col']]) ? 0 : 1;
    }
    return null;
}

// ---------- داده‌های صفحه ----------
$rows  = Db::all("SELECT * FROM `$table` ORDER BY `sort_order`, `name`, `id`");
$usage = lookup_usage($meta);
$activeCount = 0;
$usedCount = 0;
foreach ($rows as $r) {
    if ((int) $r['active'] === 1) {
        $activeCount++;
    }
    if (!empty($usage[(int) $r['id']])) {
        $usedCount++;
    }
}
$totalDocs = array_sum($usage);
$inactiveCount = count($rows) - $activeCount;
$nextOrder = (int) Db::num("SELECT COALESCE(MAX(`sort_order`),0) FROM `$table`") + 10;

// آمار تب‌ها
$tabCounts = [];
foreach ($LOOKUPS as $key => $m) {
    $tabCounts[$key] = (int) Db::num("SELECT COUNT(*) FROM `{$m['table']}`");
}

page_header($meta['title'], ['actions' =>
    '<a class="btn" href="settings.php#lookups">' . icon('back', 15) . ' بازگشت به تنظیمات</a>'
  . '<a class="btn" href="help.php">' . icon('help', 15) . ' راهنما</a>'
]);
?>

<!-- ================= تب‌های فهرست‌ها ================= -->
<nav class="tabs no-print">
  <?php foreach ($LOOKUPS as $key => $m): ?>
    <a href="settings_lookups.php?t=<?= e($key) ?>" class="<?= $key === $t ? 'active' : '' ?>">
      <?= icon($m['icon'], 16) ?> <?= e($m['short']) ?><span class="tab-n"><?= fmt($tabCounts[$key]) ?></span>
    </a>
  <?php endforeach; ?>
</nav>

<!-- ================= سرصفحه بخش ================= -->
<div class="card">
  <div class="lk-head">
    <div class="lk-title">
      <h2><?= icon($meta['icon']) ?> <?= e($meta['title']) ?></h2>
      <span class="badge <?= $inactiveCount ? 'badge-warn' : 'badge-ok' ?>"><?= $inactiveCount ? fmt($inactiveCount) . ' غیرفعال' : 'همه فعال' ?></span>
    </div>
    <form method="post" class="inline-form">
      <?= csrf_field() ?>
      <input type="hidden" name="action" value="lookup_samples">
      <input type="hidden" name="t" value="<?= e($t) ?>">
      <button class="btn btn-sm" type="submit"><?= icon('plus', 14) ?> افزودن اقلام نمونه</button>
    </form>
  </div>
  <p class="lk-sub"><?= e($meta['help']) ?></p>

  <details class="lk-help-wrap">
  <summary><?= icon('help', 15) ?> راهنمای سریع این بخش (ویرایش، حذف و ترتیب)</summary>
  <div class="lk-help">
    <div class="hcard">
      <?= icon('edit', 16) ?>
      <div><b>ویرایش نام و ترتیب</b><p>نام را مستقیم در جدول تغییر دهید و آخر کار «ذخیره تغییرات» را بزنید.
        تا وقتی ذخیره نکرده‌اید، نشانگر نارنجی «تغییرات ذخیره‌نشده» را می‌بینید.</p></div>
    </div>
    <div class="hcard">
      <?= icon('trash', 16) ?>
      <div><b>منطق حذف</b><p>اگر ردیف در هیچ سندی استفاده نشده باشد، <b>کامل حذف</b> می‌شود.
        اگر در اسناد استفاده شده باشد، برای اینکه سابقه اسناد خراب نشود <b>غیرفعال</b> می‌شود و
        در کشوهای شیت‌ها دیده نمی‌شود.</p></div>
    </div>
    <div class="hcard">
      <?= icon('power', 16) ?>
      <div><b>فعال / غیرفعال</b><p>با کلید هر ردیف فوراً فعال یا غیرفعال می‌شود (بدون ذخیره).
        ردیف غیرفعال در شیت‌ها نشان داده نمی‌شود ولی اسناد قبلی محفوظ می‌ماند.</p></div>
    </div>
    <div class="hcard">
      <?= icon('up', 16) ?>
      <div><b>ترتیب کشو</b><p>با دکمه‌های ▲ ▼ جای ردیف را در کشوی شیت‌ها بالا و پایین کنید؛
        ترتیب همان روز در تمام سیستم اثر می‌کند.</p></div>
    </div>
  </div>
  </details>
</div>

<!-- ================= آمار ================= -->
<div class="stats">
  <div class="stat"><div class="stat-label">مجموع ردیف‌ها</div><div class="stat-value"><?= fmt(count($rows)) ?></div></div>
  <div class="stat good"><div class="stat-label">فعال</div><div class="stat-value"><?= fmt($activeCount) ?></div><div class="stat-sub">غیرفعال: <?= fmt($inactiveCount) ?></div></div>
  <div class="stat info"><div class="stat-label">استفاده‌شده در اسناد</div><div class="stat-value"><?= fmt($usedCount) ?></div><div class="stat-sub">مجموع اسناد: <?= fmt($totalDocs) ?></div></div>
</div>

<!-- ================= نوار ابزار: جستجو + صافی ================= -->
<div class="lk-bar no-print">
  <div class="lk-search">
    <?= icon('search', 15) ?>
    <input type="search" id="lookupSearch" placeholder="جستجوی نام ... (میان‌بر: کلید /)" autocomplete="off">
  </div>
  <div class="lk-chips" role="tablist" aria-label="صافی ردیف‌ها">
    <button type="button" class="chip on" data-filter="all"><?= icon('list', 13) ?> همه <span class="chip-n"><?= fmt(count($rows)) ?></span></button>
    <button type="button" class="chip" data-filter="on"><?= icon('check', 13) ?> فعال <span class="chip-n"><?= fmt($activeCount) ?></span></button>
    <button type="button" class="chip" data-filter="off"><?= icon('power', 13) ?> غیرفعال <span class="chip-n"><?= fmt($inactiveCount) ?></span></button>
    <button type="button" class="chip" data-filter="used"><?= icon('sales', 13) ?> استفاده‌شده <span class="chip-n"><?= fmt($usedCount) ?></span></button>
  </div>
  <div class="lk-bulk">
    <form method="post" class="inline-form" data-confirm="همه ردیف‌های «<?= e($meta['short']) ?>» غیرفعال شوند؟ (اسناد قبلی محفوظ می‌ماند)"
          data-confirm-title="غیرفعال کردن همه" data-confirm-ok="غیرفعال کن" data-confirm-type="warn">
      <?= csrf_field() ?>
      <input type="hidden" name="action" value="lookup_all">
      <input type="hidden" name="t" value="<?= e($t) ?>">
      <input type="hidden" name="allactive" value="0">
      <button class="btn btn-sm" type="submit"><?= icon('power', 14) ?> غیرفعال کردن همه</button>
    </form>
    <form method="post" class="inline-form">
      <?= csrf_field() ?>
      <input type="hidden" name="action" value="lookup_all">
      <input type="hidden" name="t" value="<?= e($t) ?>">
      <input type="hidden" name="allactive" value="1">
      <button class="btn btn-sm" type="submit"><?= icon('check', 14) ?> فعال کردن همه</button>
    </form>
  </div>
</div>

<!-- ================= سازنده ردیف جدید ================= -->
<form method="post" class="lk-composer no-print">
  <?= csrf_field() ?>
  <input type="hidden" name="action" value="lookup_save">
  <input type="hidden" name="t" value="<?= e($t) ?>">
  <div class="field grow">
    <label><?= icon('plus', 12) ?> افزودن ردیف جدید</label>
    <input type="text" name="new[name]" placeholder="نام جدید ... مثلاً ماسه سوم" maxlength="120" autocomplete="off">
  </div>
  <?php if ($meta['extra']): ?>
    <div class="field">
      <label><?= e($meta['extra']['label']) ?></label>
      <?php if ($meta['extra']['type'] === 'text'): ?>
        <input type="text" name="new[<?= e($meta['extra']['col']) ?>]" value="<?= e($meta['extra']['default']) ?>" maxlength="40">
      <?php elseif ($meta['extra']['type'] === 'kind'): ?>
        <select name="new[<?= e($meta['extra']['col']) ?>]">
          <?php foreach (['دخل', 'شخصی', 'بانک', 'شرکت'] as $k): ?>
            <option value="<?= e($k) ?>"><?= e($k) ?></option>
          <?php endforeach; ?>
        </select>
      <?php else: ?>
        <label class="switch" style="margin-top:6px">
          <input type="checkbox" name="new[<?= e($meta['extra']['col']) ?>]" value="1" checked>
          <span class="tr"></span><span class="lb">بلی</span>
        </label>
      <?php endif; ?>
    </div>
  <?php endif; ?>
  <div class="field">
    <label>ترتیب</label>
    <input type="text" name="new[sort_order]" value="<?= (int) $nextOrder ?>" class="num-input" inputmode="numeric" style="width:90px">
  </div>
  <div class="field btn-cell">
    <button class="btn btn-primary" type="submit"><?= icon('save', 15) ?> افزودن به فهرست</button>
  </div>
</form>

<!-- ================= فرم اصلی: ویرایش نام‌ها و ترتیب ================= -->
<form method="post" id="lookupForm">
  <?= csrf_field() ?>
  <input type="hidden" name="action" value="lookup_save">
  <input type="hidden" name="t" value="<?= e($t) ?>">

  <div class="card lookup-card">
    <div class="table-wrap">
      <table class="grid lookup-table">
        <thead>
          <tr>
            <th style="width:52px">#</th>
            <th>نام</th>
            <?php if ($meta['extra']): ?><th style="width:<?= e($meta['extra']['width']) ?>"><?= e($meta['extra']['label']) ?></th><?php endif; ?>
            <th style="width:150px">ترتیب</th>
            <th style="width:132px">وضعیت</th>
            <th style="width:132px"><?= e($meta['usage_label']) ?></th>
            <th style="width:64px">حذف</th>
          </tr>
        </thead>
        <tbody>
        <?php foreach ($rows as $i => $r): $id = (int) $r['id']; $n = (int) ($usage[$id] ?? 0); $isOn = (int) $r['active'] === 1; ?>
          <tr class="<?= $isOn ? '' : 'row-off' ?>" data-name="<?= e(mb_strtolower($r['name'])) ?>" data-active="<?= $isOn ? 1 : 0 ?>" data-used="<?= $n ?>">
            <td class="num"><?= fmt($i + 1) ?></td>
            <td class="cell-name">
              <input type="text" form="lookupForm" name="rows[<?= $id ?>][name]" value="<?= e($r['name']) ?>"
                     maxlength="120" class="row-name" autocomplete="off" aria-label="نام ردیف <?= fmt($i + 1) ?>">
            </td>
            <?php if ($meta['extra']): ?>
              <td class="cell-extra">
                <?php if ($meta['extra']['type'] === 'text'): ?>
                  <input type="text" form="lookupForm" name="rows[<?= $id ?>][<?= e($meta['extra']['col']) ?>]"
                         value="<?= e((string) $r[$meta['extra']['col']]) ?>" maxlength="40">
                <?php elseif ($meta['extra']['type'] === 'kind'): ?>
                  <select form="lookupForm" name="rows[<?= $id ?>][<?= e($meta['extra']['col']) ?>]">
                    <?php foreach (['دخل', 'شخصی', 'بانک', 'شرکت'] as $k): ?>
                      <option value="<?= e($k) ?>" <?= $r[$meta['extra']['col']] === $k ? 'selected' : '' ?>><?= e($k) ?></option>
                    <?php endforeach; ?>
                  </select>
                <?php else: ?>
                  <label class="switch">
                    <input type="checkbox" form="lookupForm" name="rows[<?= $id ?>][<?= e($meta['extra']['col']) ?>]" value="1"
                      <?= (int) $r[$meta['extra']['col']] === 1 ? 'checked' : '' ?>>
                    <span class="tr"></span><span class="lb">بلی</span>
                  </label>
                <?php endif; ?>
              </td>
            <?php endif; ?>
            <td class="cell-order">
              <span class="mini-btns">
                <button type="submit" form="mv<?= $id ?>u" class="mini-btn" title="یک پله بالاتر" data-lookup-now="1"
                        <?= $i === 0 ? 'disabled' : '' ?>><?= icon('up', 13) ?></button>
                <button type="submit" form="mv<?= $id ?>d" class="mini-btn" title="یک پله پایین‌تر" data-lookup-now="1"
                        <?= $i === count($rows) - 1 ? 'disabled' : '' ?>><?= icon('down', 13) ?></button>
              </span>
              <input type="text" form="lookupForm" name="rows[<?= $id ?>][sort_order]" value="<?= (int) $r['sort_order'] ?>"
                     class="num-input lk-order-input" inputmode="numeric" aria-label="ترتیب">
            </td>
            <td>
              <button type="submit" form="tg<?= $id ?>" class="switch" data-lookup-now="1" title="فعال / غیرفعال">
                <input type="checkbox" <?= $isOn ? 'checked' : '' ?> tabindex="-1" aria-hidden="true" style="pointer-events:none">
                <span class="tr"></span><span class="lb"><?= $isOn ? 'فعال' : 'غیرفعال' ?></span>
              </button>
            </td>
            <td class="cell-usage">
              <?php if ($n): ?>
                <span class="use-tag" title="<?= e($meta['usage_label']) ?>"><?= icon('sales', 12) ?> <?= fmt($n) ?> سند</span>
              <?php else: ?>
                <span class="use-tag zero">استفاده نشده</span>
              <?php endif; ?>
            </td>
            <td class="cell-act">
              <button type="submit" form="dl<?= $id ?>" class="act-btn" title="حذف ردیف" data-lookup-now="1"
                      aria-label="حذف <?= e($r['name']) ?>"><?= icon('trash', 15) ?></button>
            </td>
          </tr>
        <?php endforeach; ?>

        <?php if (!$rows): ?>
          <tr><td colspan="<?= $meta['extra'] ? 7 : 6 ?>" class="lk-empty">
            هنوز چیزی در این فهرست نیست.<br>
            از کادر «افزودن ردیف جدید» بالا استفاده کنید یا دکمه «افزودن اقلام نمونه» را بزنید.
          </td></tr>
        <?php endif; ?>
        <tr id="lookupEmpty" hidden><td colspan="<?= $meta['extra'] ? 7 : 6 ?>" class="lk-empty">
          ردیفی با این جستجو/صافی پیدا نشد.
        </td></tr>
        </tbody>
      </table>
    </div>

    <div class="lk-note" id="lookupDirtyNote" hidden>
      <?= icon('warn', 15) ?>
      <span>تغییرات ذخیره‌نشده دارید — دکمه «ذخیره تغییرات» را بزنید. (تا آن وقت، دکمه‌های حذف/فعال/ترتیب کار نمی‌کنند تا چیزی از دست نرود)</span>
    </div>

    <div class="lk-foot">
      <button class="btn btn-primary" type="submit"><?= icon('save', 15) ?> ذخیره تغییرات<span class="dirty-dot"></span></button>
      <span class="grow-note"><?= fmt(count($rows)) ?> ردیف — <?= fmt($activeCount) ?> فعال، <?= fmt($inactiveCount) ?> غیرفعال — امروز: <?= fdate(today_ymd()) ?></span>
    </div>
  </div>
</form>

<!-- ================= فرم‌های فوری هر ردیف (حذف / فعال / ترتیب) ================= -->
<?php foreach ($rows as $i => $r): $id = (int) $r['id']; $n = (int) ($usage[$id] ?? 0); $isOn = (int) $r['active'] === 1; ?>
  <form method="post" id="tg<?= $id ?>" class="inline-form">
    <?= csrf_field() ?>
    <input type="hidden" name="action" value="lookup_toggle">
    <input type="hidden" name="t" value="<?= e($t) ?>">
    <input type="hidden" name="id" value="<?= $id ?>">
  </form>
  <form method="post" id="mv<?= $id ?>u" class="inline-form">
    <?= csrf_field() ?>
    <input type="hidden" name="action" value="lookup_move">
    <input type="hidden" name="t" value="<?= e($t) ?>">
    <input type="hidden" name="id" value="<?= $id ?>">
    <input type="hidden" name="dir" value="up">
  </form>
  <form method="post" id="mv<?= $id ?>d" class="inline-form">
    <?= csrf_field() ?>
    <input type="hidden" name="action" value="lookup_move">
    <input type="hidden" name="t" value="<?= e($t) ?>">
    <input type="hidden" name="id" value="<?= $id ?>">
    <input type="hidden" name="dir" value="down">
  </form>
  <form method="post" id="dl<?= $id ?>" class="inline-form"
        data-confirm="<?= e($n
            ? '«' . $r['name'] . '» در ' . fmt($n) . ' سند استفاده شده است. برای اینکه سابقه اسناد خراب نشود، حذف نمی‌شود و غیرفعال می‌گردد. غیرفعال شود؟'
            : '«' . $r['name'] . '» در هیچ سندی استفاده نشده است و کامل حذف می‌شود. حذف شود؟') ?>"
        data-confirm-title="<?= $n ? 'غیرفعال کردن ردیف' : 'حذف ردیف' ?>"
        data-confirm-ok="<?= $n ? 'غیرفعال کن' : 'حذف کن' ?>"
        data-confirm-danger="<?= $n ? '0' : '1' ?>"
        data-confirm-type="<?= $n ? 'warn' : 'err' ?>">
    <?= csrf_field() ?>
    <input type="hidden" name="action" value="lookup_delete">
    <input type="hidden" name="t" value="<?= e($t) ?>">
    <input type="hidden" name="id" value="<?= $id ?>">
    <input type="hidden" name="mode" value="<?= $n ? 'deactivate' : 'auto' ?>">
  </form>
<?php endforeach; ?>

<?php page_footer(); ?>
