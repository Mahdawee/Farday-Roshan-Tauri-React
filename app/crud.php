<?php
/**
 * موتور عمومی جدول‌ها (فهرست، فورم، ثبت، ویرایش، حذف، فیلتر، چاپ، CSV)
 * هر شیت با یک «مشخصات» (spec) تعریف می‌شود.
 */

/** اجرای درخواست‌های ذخیره/حذف — باید در آغاز هر صفحه صدا زده شود */
function crud_handle(array $spec): void
{
    $self = basename($_SERVER['SCRIPT_NAME'] ?? '');

    // -------- خروجی اکسل (CSV) — قبل از هر خروجی HTML --------
    if (get('action') === 'export') {
        require_login();
        [$where, $params] = crud_where($spec);
        $order = $spec['order'] ?? '`id` DESC';
        $all = Db::all($spec['list_sql'] . " WHERE $where ORDER BY $order", $params);
        $out = [];
        $head = [];
        foreach ($spec['cols'] as $c) {
            if (is_array($c)) {
                $head[] = $c['label'] ?? '';
            }
        }
        $out[] = $head;
        foreach ($all as $r) {
            $line = [];
            foreach ($spec['cols'] as $c) {
                if (is_array($c)) {
                    $line[] = crud_cell_text($c, $r);
                }
            }
            $out[] = $line;
        }
        log_activity('export', $spec['entity'] ?? $spec['table'], null, 'خروجی CSV: ' . ($spec['title'] ?? ''));
        csv_output(safe_filename($spec['title'] ?? 'export') . '.csv', $out);
    }

    // -------- حذف --------
    if (get('action') === 'delete') {
        require_login();
        if (!is_admin()) {
            flash('حذف معلومات تنها توسط مدیر سیستم انجام می‌شود.', 'error');
            redirect($self);
        }
        csrf_check();
        $id = (int) get('id');
        if ($id > 0) {
            try {
                if (!empty($spec['beforeDelete'])) {
                    call_user_func($spec['beforeDelete'], $id);
                }
                Db::delete($spec['table'], '`id`=?', [$id]);
                log_activity('delete', $spec['entity'] ?? $spec['table'], $id, 'حذف ردیف');
                flash('ردیف مورد نظر حذف شد.', 'success');
            } catch (Throwable $e) {
                flash('حذف انجام نشد: ' . Db::userError($e), 'error');
            }
        }
        redirect(crud_back_url($spec));
    }

    // -------- ذخیره --------
    if ($_SERVER['REQUEST_METHOD'] === 'POST' && post('action') === 'save') {
        require_login();
        csrf_check();
        $id   = (int) post('id');
        $data = [];
        $errors = [];

        foreach ($spec['fields'] as $f) {
            $name = $f['name'];
            if (!empty($f['auto'])) {
                continue; // شماره سند همیشه از طرف سرور ساخته می‌شود
            }
            if (!empty($f['no_save'])) {
                continue; // فیلد نمایشی/محاسباتی — در دیتابیس ذخیره نمی‌شود
            }
            $raw = $_POST[$name] ?? null;
            switch ($f['type']) {
                case 'date':
                    $v = parse_date_input($raw);
                    if ($v === null && !empty($f['required'])) {
                        $errors[] = 'تاریخ «' . $f['label'] . '» درست وارد نشده است.';
                    }
                    break;
                case 'time':
                    $v = $raw ? normalize_digits($raw) : null;
                    break;
                case 'int':
                    $v = (int) parse_number($raw);
                    break;
                case 'number':
                case 'money':
                    $v = parse_number($raw);
                    break;
                case 'check':
                    $v = !empty($raw) ? 1 : 0;
                    break;
                default:
                    $v = is_string($raw) ? trim($raw) : $raw;
            }
            $isEmpty = ($v === null || $v === '' || ($f['type'] === 'select' && !$v));
            if (!empty($f['required']) && $isEmpty) {
                $errors[] = 'مقدار «' . $f['label'] . '» حتمی است.';
            }
            if (isset($f['min']) && !$isEmpty && (float) $v < (float) $f['min']) {
                $errors[] = '«' . $f['label'] . '» نباید کمتر از ' . fmt($f['min']) . ' باشد.';
            }
            if (!empty($f['unique']) && $v) {
                if (Db::exists($spec['table'], $name, $v, $id ?: null)) {
                    $errors[] = '«' . $f['label'] . '» تکراری است: ' . $v;
                }
            }
            if (!empty($f['options_key']) && $v && !array_key_exists((string) $v, crud_options($f))) {
                $errors[] = 'مقدار «' . $f['label'] . '» معتبر نیست.';
            }
            $data[$name] = $v;
        }

        // فیلدهای محاسباتی
        if (!empty($spec['compute'])) {
            try {
                $data = call_user_func($spec['compute'], $data, $id);
            } catch (Throwable $ex) {
                $_SESSION['form_old'] = $_POST;
                $_SESSION['form_errors'] = [Db::userError($ex)];
                $q = $id ? ['action' => 'edit', 'id' => $id] : ['action' => 'new'];
                redirect($self . '?' . http_build_query(array_merge($_GET, $q, ['_t' => time()])));
            }
        }

        if ($errors) {
            $_SESSION['form_errors'] = $errors;
            $_SESSION['form_old'] = $_POST;
            $q = $id ? ['action' => 'edit', 'id' => $id] : ['action' => 'new'];
            redirect($self . '?' . http_build_query(array_merge($_GET, $q, ['_t' => time()])));
        }

        try {
            Db::begin();
            // شماره خودکار سند (بر اساس تقویم فعال سیستم)
            foreach ($spec['fields'] as $f) {
                if (!empty($f['auto'])) {
                    $yearFrom = $f['auto']['year_from'] ?? null;
                    $y = ($yearFrom && !empty($data[$yearFrom])) ? cal_year($data[$yearFrom]) : cal_year();
                    $data[$f['name']] = Db::nextNumber($f['auto']['series'], $y, $f['auto']['pad'] ?? 4);
                }
            }
            if ($id) {
                if (!empty($spec['beforeSave'])) {
                    $data = call_user_func($spec['beforeSave'], $data, $id);
                }
                Db::update($spec['table'], $data, '`id`=?', [$id]);
                log_activity('update', $spec['entity'] ?? $spec['table'], $id, 'ویرایش ردیف');
                $msg = 'تغییرات ذخیره شد.';
            } else {
                if (!empty($spec['beforeSave'])) {
                    $data = call_user_func($spec['beforeSave'], $data, null);
                }
                $id = Db::insert($spec['table'], $data);
                log_activity('create', $spec['entity'] ?? $spec['table'], $id, 'ثبت ردیف جدید');
                $msg = 'معلومات جدید ثبت شد.';
            }
            if (!empty($spec['afterSave'])) {
                call_user_func($spec['afterSave'], $data, $id, (bool) post('id'));
            }
            Db::commit();
            flash($msg, 'success');
            unset($_SESSION['form_old'], $_SESSION['form_errors']);
            $back = post('_back');
            redirect($back ?: $self);
        } catch (Throwable $ex) {
            Db::rollback();
            flash('ذخیره نشد: ' . Db::userError($ex), 'error');
            $q = $id ? ['action' => 'edit', 'id' => $id] : ['action' => 'new'];
            redirect($self . '?' . http_build_query(array_merge($_GET, $q)));
        }
    }
}

function crud_back_url(array $spec): string
{
    $self = basename($_SERVER['SCRIPT_NAME'] ?? '');
    $q = $_GET;
    unset($q['action'], $q['id']);
    return $self . ($q ? '?' . http_build_query($q) : '');
}

/** گزینه‌های یک فیلد کشویی */
function crud_options(array $f): array
{
    if (isset($f['options']) && is_callable($f['options'])) {
        return call_user_func($f['options']);
    }
    if (isset($f['options']) && is_array($f['options'])) {
        return $f['options'];
    }
    if (!empty($f['lookup'])) {
        return lookup_options($f['lookup'], $f['lookup_active'] ?? false);
    }
    return [];
}

/** ساخت شرط‌های WHERE از فیلترهای صفحه */
function crud_where(array $spec): array
{
    $conds = [];
    $params = [];

    if (!empty($spec['filters'])) {
        foreach ($spec['filters'] as $flt) {
            $v = get($flt['name']);
            if ($v === null || $v === '') {
                continue;
            }
            $col = $flt['col'] ?? '';
            switch ($flt['type']) {
                case 'date':
                    $ymd = parse_date_input($v);
                    if ($ymd) {
                        $op = $flt['op'] ?? '=';
                        $conds[] = $col . ' ' . $op . ' ?';
                        $params[] = $ymd;
                    }
                    break;
                case 'select':
                    $conds[] = "$col = ?";
                    $params[] = $v;
                    break;
                case 'raw':
                    if (isset($flt['values'][(string) $v])) {
                        $conds[] = '(' . $flt['values'][(string) $v] . ')';
                    }
                    break;
                case 'like':
                    $conds[] = "$col LIKE ?";
                    $params[] = '%' . $v . '%';
                    break;
                default:
                    $conds[] = "$col = ?";
                    $params[] = $v;
            }
        }
    }

    $q = get('q');
    if ($q !== null && $q !== '' && !empty($spec['search'])) {
        $ors = [];
        foreach ($spec['search'] as $c) {
            $ors[] = "$c LIKE ?";
            $params[] = '%' . $q . '%';
        }
        $conds[] = '(' . implode(' OR ', $ors) . ')';
    }

    return [$conds ? implode(' AND ', $conds) : '1=1', $params];
}

/** نمایش فهرست ردیف‌ها + فیلترها */
function crud_render(array $spec): void
{
    $self = basename($_SERVER['SCRIPT_NAME'] ?? '');
    $action = get('action');

    if ($action === 'new' || $action === 'edit') {
        crud_form($spec);
        return;
    }

    [$where, $params] = crud_where($spec);
    $order = $spec['order'] ?? '`id` DESC';

    // مرتب‌سازی با کلیک روی سرستون
    $sort = get('sort');
    if ($sort && !empty($spec['sortable'][$sort])) {
        $dir = strtolower((string) get('dir', 'asc')) === 'desc' ? 'DESC' : 'ASC';
        $order = $spec['sortable'][$sort] . ' ' . $dir;
    }

    $page  = max(1, (int) get('page', 1));
    $per   = (int) ($spec['page_size'] ?? 25);
    $total = (int) Db::val("SELECT COUNT(*) FROM ({$spec['list_sql']} WHERE $where) t", $params, 0);

    $sql = $spec['list_sql'] . " WHERE $where ORDER BY $order LIMIT " . (($page - 1) * $per) . ", $per";
    $rows = Db::all($sql, $params);

    // -------- فیلترها --------
    ?>
    <form class="filters no-print" method="get">
      <input type="hidden" name="action" value="">
      <?php foreach (($spec['filters'] ?? []) as $flt): ?>
        <div class="filter-item">
          <label><?= e($flt['label']) ?></label>
          <?php if ($flt['type'] === 'date'): ?>
            <input type="text" name="<?= e($flt['name']) ?>" class="date-input" placeholder="<?= e(cal_mode() === 'miladi' ? '2026-09-24' : '1405/07/02') ?>"
                   value="<?= e((string) get($flt['name'], '')) ?>">
          <?php elseif ($flt['type'] === 'select' || $flt['type'] === 'raw'): ?>
            <select name="<?= e($flt['name']) ?>">
              <option value=""><?= e($flt['all_label'] ?? 'همه') ?></option>
              <?php foreach (($flt['type'] === 'raw' ? ($flt['labels'] ?? []) : crud_options($flt)) as $k => $v): ?>
                <option value="<?= e($k) ?>" <?= (string) get($flt['name']) === (string) $k ? 'selected' : '' ?>><?= e($v) ?></option>
              <?php endforeach; ?>
            </select>
          <?php else: ?>
            <input type="text" name="<?= e($flt['name']) ?>" value="<?= e((string) get($flt['name'], '')) ?>" placeholder="<?= e($flt['placeholder'] ?? '') ?>">
          <?php endif; ?>
        </div>
      <?php endforeach; ?>
      <?php if (!empty($spec['search'])): ?>
        <div class="filter-item grow">
          <label>جستجو</label>
          <input type="text" name="q" value="<?= e((string) get('q', '')) ?>" placeholder="متن، نام، شماره ...">
        </div>
      <?php endif; ?>
      <div class="filter-item btn-cell">
        <button class="btn" type="submit"><?= icon('search') ?> تطبیق</button>
        <a class="btn btn-outline" href="<?= e($self) ?>">پاک کردن</a>
      </div>
    </form>
    <?php

    $totals = $spec['totals'] ?? [];
    $sums = [];
    foreach ($totals as $t) {
        $sums[$t['key']] = 0.0;
    }
    foreach ($rows as $r) {
        foreach ($totals as $t) {
            $sums[$t['key']] += (float) ($r[$t['key']] ?? 0);
        }
    }

    table_start($spec['cols']);
    $i = ($page - 1) * $per;
    foreach ($rows as $r) {
        $i++;
        echo '<tr>';
        foreach ($spec['cols'] as $c) {
            if (!is_array($c)) {
                echo '<td></td>';
                continue;
            }
            $cls = [];
            if (!empty($c['num'])) {
                $cls[] = 'num';
            }
            if (!empty($c['class'])) {
                $cls[] = $c['class'];
            }
            echo '<td' . ($cls ? ' class="' . implode(' ', $cls) . '"' : '') . '>' . crud_cell($c, $r, $i) . '</td>';
        }
        echo '</tr>';
    }
    if (!$rows) {
        echo '<tr><td colspan="' . count($spec['cols']) . '" class="empty">معلوماتی برای نمایش وجود ندارد.</td></tr>';
    }
    echo '</tbody>';
    if ($totals) {
        echo '<tfoot><tr>';
        echo '<td class="total-label">مجموع این صفحه</td>';
        foreach ($spec['cols'] as $idx => $c) {
            if ($idx === 0) {
                continue;
            }
            $key = is_array($c) ? ($c['key'] ?? '') : '';
            $found = false;
            foreach ($totals as $t) {
                if ($t['key'] === $key) {
                    $found = true;
                }
            }
            if ($found) {
                echo '<td class="num total">' . fmt($sums[$key], ($c['fmt'] ?? '') === 'money_usd' ? 2 : -1) . '</td>';
            } else {
                echo '<td></td>';
            }
        }
        echo '</tr></tfoot>';
    }
    echo '</table></div>';

    // اصلاح خروجی ستون‌های مجموع (نمایش تمیز)
    // pagination
    $pages = max(1, (int) ceil($total / $per));
    ?>
    <div class="list-foot no-print">
      <div class="muted">مجموع ردیف‌ها: <b><?= fmt($total) ?></b></div>
      <?php if ($pages > 1): ?>
        <div class="pager">
          <?php if ($page > 1): ?><a class="btn btn-sm" href="<?= e(url_with(['page' => $page - 1])) ?>">قبلی</a><?php endif; ?>
          <span>صفحه <?= fmt($page) ?> از <?= fmt($pages) ?></span>
          <?php if ($page < $pages): ?><a class="btn btn-sm" href="<?= e(url_with(['page' => $page + 1])) ?>">بعدی</a><?php endif; ?>
        </div>
      <?php endif; ?>
      <div class="actions">
        <a class="btn btn-outline btn-sm" href="<?= e(url_with(['action' => 'export'])) ?>"><?= icon('download') ?> خروجی اکسل (CSV)</a>
        <?= print_button() ?>
      </div>
    </div>
    <?php
}

/** متن ساده یک خانه (برای CSV) */
function crud_cell_text(array $c, array $r): string
{
    $key = $c['key'] ?? $c['name'] ?? '';
    $v = $r[$key] ?? '';
    switch ($c['fmt'] ?? 'text') {
        case 'money':  return (string) round((float) $v, 2);
        case 'volume': return (string) round((float) $v, 3);
        case 'date':   return $v ? fdate($v) : '';
        case 'bool':   return $v ? 'بلی' : 'نخیر';
        default:       return (string) $v;
    }
}

/** رندر یک خانه از جدول */
function crud_cell(array $c, array $r, int $index = 0)
{
    if (!empty($c['render']) && is_callable($c['render'])) {
        return call_user_func($c['render'], $r, $index);
    }
    $key = $c['key'] ?? $c['name'] ?? '';
    $v = $r[$key] ?? null;
    switch ($c['fmt'] ?? 'text') {
        case 'money':
            return fmt($v);
        case 'money_usd':
            return $v > 0 ? fmt($v, 2) : '<span class="muted">—</span>';
        case 'volume':
            return fmt($v, 2);
        case 'date':
            return e($v ? fdate($v) : '');
        case 'month':
            return e(fmonth((int) ($r[$c['year'] ?? 'pay_year'] ?? 0), (int) ($r[$c['month'] ?? 'pay_month'] ?? 0)));
        case 'bool':
            return $v ? '<span class="badge badge-ok">بلی</span>' : '<span class="badge">نخیر</span>';
        case 'badge':
            $map = $c['map'] ?? [];
            $cls = $map[$v] ?? 'info';
            return '<span class="badge badge-' . e($cls) . '">' . e((string) $v) . '</span>';
        case 'html':
            return (string) $v;
        case 'num':
            return fmt($v);
        default:
            return e((string) $v);
    }
}

/** فورم ثبت / ویرایش */
function crud_form(array $spec): void
{
    $self = basename($_SERVER['SCRIPT_NAME'] ?? '');
    $id   = (int) get('id');
    $row  = [];
    if ($id) {
        $row = Db::one('SELECT * FROM `' . $spec['table'] . '` WHERE `id`=?', [$id]) ?: [];
        if (!$row) {
            flash('ردیف مورد نظر یافت نشد.', 'error');
            redirect($self);
        }
    }
    // مقادیر پیش‌فرض
    foreach ($spec['fields'] as $f) {
        if (!isset($row[$f['name']])) {
            $row[$f['name']] = $f['default'] ?? null;
        }
    }
    if (!empty($spec['defaults']) && is_callable($spec['defaults'])) {
        $row = array_merge($row, call_user_func($spec['defaults'], $row));
    }
    // مقادیر وارد شده قبلی (در صورت خطا)
    $old = $_SESSION['form_old'] ?? null;
    if ($old) {
        foreach ($old as $k => $v) {
            if (array_key_exists($k, $row) || in_array($k, array_column($spec['fields'], 'name'), true)) {
                $row[$k] = $v;
            }
        }
        unset($_SESSION['form_old']);
    }
    $errors = $_SESSION['form_errors'] ?? [];
    unset($_SESSION['form_errors']);

    $title = ($id ? 'ویرایش ' : 'ثبت ') . ($spec['singular'] ?? $spec['title']);
    ?>
    <div class="card">
      <div class="card-head">
        <h2><?= e($title) ?></h2>
        <a class="btn btn-outline btn-sm" href="<?= e($self) ?>"><?= icon('close') ?> بستن</a>
      </div>
      <?php if ($errors): ?>
        <div class="alert alert-error"><ul><?php foreach ($errors as $er): ?><li><?= $er ?></li><?php endforeach; ?></ul></div>
      <?php endif; ?>
      <form method="post" class="form-grid" id="crudForm" autocomplete="off">
        <?= csrf_field() ?>
        <input type="hidden" name="action" value="save">
        <input type="hidden" name="id" value="<?= $id ?: '' ?>">
        <input type="hidden" name="_back" value="<?= e(get('back', '')) ?>">
        <?php foreach ($spec['fields'] as $f):
            $name = $f['name'];
            $val  = $row[$name] ?? '';
            if ($f['type'] === 'date') {
                $val = $val ? fdate((string) $val) : '';
            } elseif (in_array($f['type'], ['money', 'number'], true)) {
                $val = ($val === null || $val === '') ? '' : fmt($val, 2);
            }
            $width = $f['col'] ?? 'half';
            ?>
          <div class="field col-<?= e($width) ?><?= !empty($f['required']) ? ' required' : '' ?>">
            <label for="f_<?= e($name) ?>"><?= e($f['label']) ?><?php if (!empty($f['required'])): ?> <span class="req">*</span><?php endif; ?></label>
            <?php if ($f['type'] === 'textarea'): ?>
              <textarea id="f_<?= e($name) ?>" name="<?= e($name) ?>" rows="<?= (int) ($f['rows'] ?? 2) ?>"><?= e((string) $val) ?></textarea>
            <?php elseif ($f['type'] === 'select'): ?>
              <select id="f_<?= e($name) ?>" name="<?= e($name) ?>" <?= !empty($f['required']) ? 'required' : '' ?>>
                <?php if (empty($f['no_empty'])): ?><option value="">— انتخاب کنید —</option><?php endif; ?>
                <?php foreach (crud_options($f) as $k => $v): ?>
                  <option value="<?= e($k) ?>" <?= (string) $val === (string) $k ? 'selected' : '' ?>><?= e($v) ?></option>
                <?php endforeach; ?>
              </select>
            <?php elseif ($f['type'] === 'check'): ?>
              <label class="checkbox"><input type="checkbox" id="f_<?= e($name) ?>" name="<?= e($name) ?>" value="1" <?= $val ? 'checked' : '' ?>> <?= e($f['check_label'] ?? 'بلی') ?></label>
            <?php elseif ($f['type'] === 'readonly'): ?>
              <input type="text" id="f_<?= e($name) ?>" value="<?= e((string) $val) ?>" readonly class="readonly">
            <?php else:
                $cls = $f['type'] === 'date' ? 'date-input' : ($f['type'] === 'money' || $f['type'] === 'number' ? 'num-input' : '');
                ?>
              <input type="text" class="<?= e($cls) ?>"
                     id="f_<?= e($name) ?>" name="<?= e($name) ?>"
                     value="<?= e((string) $val) ?>"
                     <?= isset($f['placeholder']) ? 'placeholder="' . e($f['placeholder']) . '"' : '' ?>
                     <?= isset($f['maxlength']) ? 'maxlength="' . (int) $f['maxlength'] . '"' : '' ?>
                     <?= !empty($f['required']) ? 'required' : '' ?>
                     <?= !empty($f['datalist']) ? 'list="dl_' . e($name) . '"' : '' ?>
                     <?= !empty($f['readonly']) ? 'readonly' : '' ?>>
              <?php if (!empty($f['datalist'])): ?>
                <datalist id="dl_<?= e($name) ?>">
                  <?php foreach ((is_callable($f['datalist']) ? call_user_func($f['datalist']) : (array) $f['datalist']) as $opt): ?>
                    <option value="<?= e($opt) ?>"></option>
                  <?php endforeach; ?>
                </datalist>
              <?php endif; ?>
            <?php endif; ?>
            <?php if (!empty($f['help'])): ?><small class="help"><?= e($f['help']) ?></small><?php endif; ?>
          </div>
        <?php endforeach; ?>
        <div class="form-actions col-full">
          <button class="btn btn-primary" type="submit"><?= icon('save') ?> ذخیره</button>
          <a class="btn btn-outline" href="<?= e($self) ?>">لغو</a>
          <?php if ($id && is_admin()): ?>
            <a class="btn btn-danger" href="<?= e($self) ?>?action=delete&id=<?= $id ?>&_csrf=<?= e(csrf_token()) ?>"
               data-confirm="این ردیف برای همیشه حذف می‌شود و قابل برگشت نیست. حذف شود؟"
               data-confirm-title="حذف ردیف" data-confirm-ok="حذف کن" data-confirm-type="err" data-confirm-danger
            ><?= icon('trash') ?> حذف</a>
          <?php endif; ?>
        </div>
        <?php if (!empty($spec['form_extra'])): ?>
          <div class="col-full"><?= $spec['form_extra'] ?></div>
        <?php endif; ?>
      </form>
    </div>
    <?php if (!empty($spec['form_footer'])): ?>
      <div class="card"><?= $spec['form_footer'] ?></div>
    <?php endif; ?>
    <?php
}

/** دکمه‌های عملیات ردیف (ویرایش/حذف/نمایش) */
function row_actions(array $spec, array $r, array $extra = []): string
{
    $self = basename($_SERVER['SCRIPT_NAME'] ?? '');
    $html = '<div class="row-actions no-print">';
    foreach ($extra as $label => $url) {
        $html .= '<a class="mini" href="' . e($url) . '">' . $label . '</a>';
    }
    $html .= '<a class="mini" title="ویرایش" href="' . e($self) . '?action=edit&id=' . (int) $r['id'] . '">' . icon('pencil', 13) . '</a>';
    if (is_admin()) {
        $html .= '<a class="mini danger" title="حذف" href="' . e($self) . '?action=delete&id=' . (int) $r['id'] . '&_csrf=' . e(csrf_token())
               . '" data-confirm="این ردیف برای همیشه حذف می‌شود و قابل برگشت نیست. حذف شود؟"'
               . ' data-confirm-title="حذف ردیف" data-confirm-ok="حذف کن" data-confirm-type="err" data-confirm-danger>'
               . icon('trash', 13) . '</a>';
    }
    $html .= '</div>';
    return $html;
}
