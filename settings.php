<?php
/**
 * تنظیمات سیستم: ظاهر، تقویم، سال مالی، روش حساب دخل، جداول کشویی، منطقه خطر
 */
require_once __DIR__ . '/app/bootstrap.php';
require_once __DIR__ . '/app/reset.php';
app_boot();
require_admin();

$lookupTables = lookup_tables();   // هر کدام صفحه مستقل خودش را دارد: settings_lookups.php

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $action = post('action');

    // ---------------- تنظیمات عمومی ----------------
    if ($action === 'save_settings') {
        $cal = post('calendar') === 'miladi' ? 'miladi' : 'shamsi';
        $mode = post('cashbox_mode') === 'cash_only' ? 'cash_only' : 'all';
        settings_save([
            'calendar'           => $cal,
            'fiscal_start_month' => max(1, min(12, (int) parse_number(post('fiscal_start_month'), 1))),
            'fiscal_start_day'   => max(1, min(31, (int) parse_number(post('fiscal_start_day'), 1))),
            'cashbox_mode'       => $mode,
            'opening_cash'       => parse_number(post('opening_cash')),
            'opening_cash_date'  => parse_date_input(post('opening_cash_date')),
            'afn_label'          => (string) post('afn_label', 'افغانی'),
            'usd_label'          => (string) post('usd_label', 'دالر'),
            'display_digits'     => post('display_digits') === 'fa' ? 'fa' : 'en',
            'print_header'       => (string) post('print_header', ''),
        ]);
        log_activity('update', 'settings', 1, 'تغییر تنظیمات عمومی');
        flash('تنظیمات ذخیره شد.', 'success');
        redirect('settings.php');
    }

    // ---------------- ظاهر سیستم ----------------
    if ($action === 'save_appearance') {
        $all = accent_palettes();
        $accent = (string) post('accent', 'teal');
        settings_save([
            'theme_mode'    => in_array(post('theme_mode'), ['light', 'dark', 'auto'], true) ? post('theme_mode') : 'auto',
            'accent'        => array_key_exists($accent, $all) ? $accent : 'teal',
            'density'       => post('density') === 'compact' ? 'compact' : 'comfortable',
            'font_size'     => in_array(post('font_size'), ['small', 'normal', 'large'], true) ? post('font_size') : 'normal',
            'corner_style'  => in_array(post('corner_style'), ['soft', 'medium', 'sharp'], true) ? post('corner_style') : 'soft',
            'table_stripes' => post('table_stripes') ? 1 : 0,
            'font_family'   => array_key_exists((string) post('font_family'), font_options()) ? post('font_family') : 'poppins',
        ]);
        log_activity('update', 'settings', 1, 'تغییر ظاهر سیستم');
        flash('ظاهر سیستم ذخیره شد.', 'success');
        redirect('settings.php');
    }

    // ---------------- گزینه‌های ویژه (با رمز مخصوص) ----------------
    if ($action === 'special_unlock') {
        if (special_password_ok((string) $_POST['special_pass'])) {
            $_SESSION['fr_special_until'] = time() + 900;   // ۱۵ دقیقه باز می‌ماند
            log_activity('login', 'special', 1, 'باز شدن گزینه‌های ویژه تنظیمات');
            flash('گزینه‌های ویژه باز شد (۱۵ دقیقه).', 'success');
        } else {
            usleep(400000);   // کمی تأخیر برای جلوگیری از حدس زدن رمز
            flash('رمز مخصوص درست نیست.', 'error');
        }
        redirect('settings.php#danger');
    }
    if ($action === 'special_lock') {
        unset($_SESSION['fr_special_until']);
        flash('گزینه‌های ویژه بسته شد.', 'success');
        redirect('settings.php#danger');
    }
    if ($action === 'factory_reset') {
        if (!special_unlocked()) {
            flash('برای این کار باید رمز مخصوص را وارد کنید.', 'error');
            redirect('settings.php#danger');
        }
        if (strtoupper(trim((string) post('confirm_word'))) !== 'RESET') {
            flash('برای تأیید، کلمه RESET را در کادر بنویسید.', 'error');
            redirect('settings.php#danger');
        }
        try {
            $res = factory_reset();
            log_activity('delete', 'database', null, 'بازگشت به حالت کارخانه — ' . $res['total'] . ' ردیف');
            flash('بازگشت به حالت کارخانه انجام شد — مجموع ردیف‌های پاک‌شده: ' . fmt($res['total'])
                . ' (معلومات اولیه اقلام و فهرست‌ها دوباره ساخته شد)', 'success');
        } catch (Throwable $e) {
            flash('بازگشت به حالت کارخانه ناکام شد: ' . Db::userError($e), 'error');
        }
        redirect('settings.php#danger');
    }

    // ---------------- ترمیم/بروزرسانی ساختار دیتابیس ----------------
    if ($action === 'repair_schema') {
        try {
            $res = fr_ensure_schema();
            $_SESSION['fr_schema_v'] = fr_schema_version();
            $ok = fr_schema_ok();
            flash($ok
                ? '✔ ساختار دیتابیس بررسی و بروزرسانی شد' . ($res['applied'] ? ' (' . fmt($res['applied']) . ' تغییر)' : ' — همه چیز از قبل درست بود') . '.'
                : 'ساختار بروزرسانی شد ولی هنوز ناقص است — صفحه «بررسی سلامت» را ببینید.',
                $ok ? 'success' : 'error');
        } catch (Throwable $e) {
            flash('بروزرسانی ساختار ناکام شد: ' . Db::userError($e), 'error');
        }
        redirect('settings.php#database');
    }

    // ---------------- صفر کردن سیستم / معلومات نمونه ----------------
    if ($action === 'reset_data') {
        if (strtoupper(trim((string) post('confirm_word'))) !== 'RESET') {
            flash('برای تأیید پاک کردن، کلمه RESET را در کادر بنویسید.', 'error');
            redirect('settings.php#danger');
        }
        try {
            $res = reset_business_data(false, false, false);
            log_activity('delete', 'database', null, 'صفر کردن سیستم — حذف ' . $res['total'] . ' ردیف');
            flash('سیستم صفر شد. مجموع ردیف‌های پاک‌شده: ' . fmt($res['total']) . ' — حالا می‌توانید از نو معلومات ثبت کنید.', 'success');
        } catch (Throwable $e) {
            flash('صفر کردن انجام نشد: ' . Db::userError($e), 'error');
        }
        redirect('settings.php');
    }

    if ($action === 'load_demo') {
        try {
            flash(load_demo_data(), 'success');
        } catch (Throwable $e) {
            flash('بارگذاری معلومات نمونه ناکام شد: ' . Db::userError($e), 'error');
        }
        redirect('settings.php');
    }

}

$s = settings_row(true);
$palettes = accent_palettes();
$counts = data_counts();
$isEmpty = array_sum([$counts['فروشات'], $counts['مصارف'], $counts['رسیدات'], $counts['معاشات'], $counts['کارمندان'], $counts['مشتریان']]) === 0;

page_header('تنظیمات سیستم', ['actions' =>
    '<a class="btn" href="company.php">' . icon('factory') . ' مشخصات شرکت</a>'
  . '<a class="btn" href="users.php">' . icon('lock') . ' کاربران سیستم</a>'
  . '<a class="btn" href="backup.php">' . icon('save') . ' پشتیبان‌گیری</a>'
]);
?>

<!-- ======================= ظاهر سیستم ======================= -->
<div class="card" id="appearance">
  <div class="card-head">
    <h2><?= icon('gear') ?> ظاهر سیستم</h2>
    <span class="muted">در همه دستگاه‌ها (کمپیوتر و موبایل) اعمال می‌شود</span>
  </div>
  <form method="post" class="form-grid" id="appearanceForm">
    <?= csrf_field() ?>
    <input type="hidden" name="action" value="save_appearance">

    <div class="field col-half">
      <label>حالت نمایش</label>
      <div class="seg">
        <?php foreach (['light' => 'روشن', 'dark' => 'تیره', 'auto' => 'خودکار (مطابق موبایل)'] as $k => $lbl): ?>
          <label class="<?= appearance('theme_mode') === $k ? 'checked' : '' ?>">
            <input type="radio" name="theme_mode" value="<?= $k ?>" <?= appearance('theme_mode') === $k ? 'checked' : '' ?>><?= e($lbl) ?>
          </label>
        <?php endforeach; ?>
      </div>
      <small class="help">در حالت «خودکار»، اگر موبایل یا کمپیوتر شما در حالت شب باشد، سیستم هم تیره می‌شود.
        با دکمه ☾ در نوار بالا هم می‌توانید سریع حالت را عوض کنید.</small>
    </div>

    <div class="field col-half">
      <label>رنگ اصلی سیستم</label>
      <div class="color-swatch" id="accentSwatch">
        <?php foreach ($palettes as $key => $p): ?>
          <label class="<?= appearance('accent') === $key ? 'checked' : '' ?>" title="<?= e($p[0]) ?>">
            <input type="radio" name="accent" value="<?= e($key) ?>" data-light="<?= e($p[1]) ?>" data-dark="<?= e($p[2]) ?>"
                   <?= appearance('accent') === $key ? 'checked' : '' ?>>
            <span style="background:<?= e($p[1]) ?>"></span>
          </label>
        <?php endforeach; ?>
      </div>
      <small class="help">با کلیک روی هر رنگ، همین صفحه فوراً پیش‌نمایش می‌شود (تا ذخیره نکنید تغییری در سیستم نمی‌ماند).</small>
    </div>

    <div class="field col-full">
      <label>فونت سیستم</label>
      <div class="seg">
        <?php foreach (font_options() as $key => $info): ?>
          <label class="<?= appearance('font_family') === $key ? 'checked' : '' ?>" title="<?= e($info[1]) ?>">
            <input type="radio" name="font_family" value="<?= e($key) ?>" <?= appearance('font_family') === $key ? 'checked' : '' ?>><?= e($info[0]) ?>
          </label>
        <?php endforeach; ?>
      </div>
      <small class="help">فونت‌های Poppins و Vazirmatn <b>داخل خود سیستم</b> ذخیره شده‌اند؛ یعنی بدون انترنت هم درست نمایش داده می‌شوند
        (هیچ درخواستی به Google Fonts یا سرور بیرونی فرستاده نمی‌شود). اگر سرعت بارگذاری برایتان مهم‌تر است،
        گزینه «فونت سیستم» را انتخاب کنید تا هیچ فایل فونتی دانلود نشود.</small>
    </div>

    <div class="field col-third">
      <label>فشردگی چیدمان</label>
      <div class="seg">
        <?php foreach (['comfortable' => 'راحت', 'compact' => 'فشرده (ردیف‌های بیشتر)'] as $k => $lbl): ?>
          <label class="<?= appearance('density') === $k ? 'checked' : '' ?>">
            <input type="radio" name="density" value="<?= $k ?>" <?= appearance('density') === $k ? 'checked' : '' ?>><?= e($lbl) ?>
          </label>
        <?php endforeach; ?>
      </div>
    </div>

    <div class="field col-third">
      <label>اندازه خط</label>
      <div class="seg">
        <?php foreach (['small' => 'کوچک', 'normal' => 'معمولی', 'large' => 'بزرگ'] as $k => $lbl): ?>
          <label class="<?= appearance('font_size') === $k ? 'checked' : '' ?>">
            <input type="radio" name="font_size" value="<?= $k ?>" <?= appearance('font_size') === $k ? 'checked' : '' ?>><?= e($lbl) ?>
          </label>
        <?php endforeach; ?>
      </div>
    </div>

    <div class="field col-third">
      <label>شکل گوشه‌ها</label>
      <div class="seg">
        <?php foreach (['soft' => 'نرم', 'medium' => 'معمولی', 'sharp' => 'تیز'] as $k => $lbl): ?>
          <label class="<?= appearance('corner_style') === $k ? 'checked' : '' ?>">
            <input type="radio" name="corner_style" value="<?= $k ?>" <?= appearance('corner_style') === $k ? 'checked' : '' ?>><?= e($lbl) ?>
          </label>
        <?php endforeach; ?>
      </div>
    </div>

    <div class="field col-full">
      <label class="checkbox">
        <input type="checkbox" name="table_stripes" value="1" <?= appearance('table_stripes') === '1' ? 'checked' : '' ?>>
        ردیف‌های یک‌درمیان رنگی در جدول‌ها (خواندن لیست‌های طولانی را آسان‌تر می‌کند)
      </label>
    </div>

    <div class="form-actions col-full">
      <button class="btn btn-primary" type="submit"><?= icon('save') ?> ذخیره ظاهر</button>
      <a class="btn" href="settings.php"><?= icon('refresh') ?> بازگرداندن پیش‌فرض (بدون ذخیره)</a>
    </div>
  </form>
</div>

<script>
  // پیش‌نمایش فوری ظاهر — بدون درخواست شبکه (سبک و سریع)
  window.FR_THEME_FORMS = true;
  window.FR_PALETTES = <?= json_encode(array_map(fn($p) => [$p[1], $p[2]], $palettes), JSON_UNESCAPED_UNICODE) ?>;
  window.FR_FONTS = true;
</script>

<!-- ======================= تنظیمات عمومی ======================= -->
<div class="card">
  <div class="card-head"><h2><?= icon('gear') ?> تنظیمات عمومی</h2></div>
  <form method="post" class="form-grid">
    <?= csrf_field() ?>
    <input type="hidden" name="action" value="save_settings">
    <div class="field col-half">
      <label>تقویم سیستم</label>
      <select name="calendar">
        <option value="shamsi" <?= $s['calendar'] === 'shamsi' ? 'selected' : '' ?>>هجری شمسی (حمل، ثور، جوزا ...)</option>
        <option value="miladi" <?= $s['calendar'] === 'miladi' ? 'selected' : '' ?>>میلادی (جنوری، فبروری ...)</option>
      </select>
      <small class="help">با تغییر این گزینه، تمام تاریخ‌های سیستم (فورم‌ها، راپورها و چاپ) مطابق تقویم انتخابی نمایش داده می‌شوند. معلومات ذخیره‌شده تغییری نمی‌کند.</small>
    </div>
    <div class="field col-third">
      <label>ماه آغاز سال مالی</label>
      <select name="fiscal_start_month">
        <?php foreach (month_list() as $m => $label): ?>
          <option value="<?= $m ?>" <?= (int) $s['fiscal_start_month'] === $m ? 'selected' : '' ?>><?= e($label) ?></option>
        <?php endforeach; ?>
      </select>
    </div>
    <div class="field col-third">
      <label>روز آغاز سال مالی</label>
      <input type="text" name="fiscal_start_day" value="<?= e((string) $s['fiscal_start_day']) ?>">
    </div>
    <div class="field col-half">
      <label>روش محاسبه موجودی دخل</label>
      <select name="cashbox_mode">
        <option value="all" <?= $s['cashbox_mode'] === 'all' ? 'selected' : '' ?>>ساده: فروشات نقده + رسیدات − همه مصارف − همه معاشات</option>
        <option value="cash_only" <?= $s['cashbox_mode'] === 'cash_only' ? 'selected' : '' ?>>دقیق: فقط پولی که واقعاً از دخل آمده و رفته</option>
      </select>
      <small class="help">در حالت دوم، فقط مصارف «نقده» که پرداخت‌کننده‌اش «دخل» باشد از موجودی دخل کم می‌شود.</small>
    </div>
    <div class="field col-third">
      <label>موجودی اول دخل</label>
      <input type="text" name="opening_cash" class="num-input" value="<?= e(fmt($s['opening_cash'], 2)) ?>">
      <small class="help">پولی که در آغاز استفاده از سیستم در دخل موجود بود</small>
    </div>
    <div class="field col-third">
      <label>تاریخ موجودی اول</label>
      <input type="text" name="opening_cash_date" class="date-input" value="<?= e($s['opening_cash_date'] ? fdate($s['opening_cash_date']) : '') ?>">
    </div>
    <div class="field col-third">
      <label>واحد پول افغانی</label>
      <input type="text" name="afn_label" value="<?= e($s['afn_label']) ?>">
    </div>
    <div class="field col-third">
      <label>واحد پول دالری</label>
      <input type="text" name="usd_label" value="<?= e($s['usd_label']) ?>">
    </div>
    <div class="field col-third">
      <label>شکل ارقام</label>
      <select name="display_digits">
        <option value="en" <?= ($s['display_digits'] ?? 'en') === 'en' ? 'selected' : '' ?>>۱۲۳ (لاتین)</option>
        <option value="fa" <?= ($s['display_digits'] ?? 'en') === 'fa' ? 'selected' : '' ?>>۱۲۳ (دری)</option>
      </select>
    </div>
    <div class="field col-half">
      <label>سرصفحه چاپ</label>
      <input type="text" name="print_header" value="<?= e((string) $s['print_header']) ?>">
      <small class="help">متنی که در بالای ورق‌های چاپی نوشته می‌شود</small>
    </div>
    <div class="form-actions col-full"><button class="btn btn-primary" type="submit"><?= icon('save') ?> ذخیره تنظیمات</button></div>
  </form>
</div>

<!-- ======================= وضعیت و ترمیم دیتابیس ======================= -->
<?php
$schemaOk = false;
try {
    $schemaOk = fr_schema_ok();
} catch (Throwable $e) {
}
?>
<div class="card" id="database">
  <div class="card-head">
    <h2><?= icon('save') ?> دیتابیس و ساختار آن</h2>
    <span class="badge <?= $schemaOk ? 'badge-ok' : 'badge-bad' ?>"><?= $schemaOk ? 'درست' : 'نیاز به بروزرسانی' ?></span>
  </div>
  <p class="muted">
    نسخه ساختار: <b><?= fmt(fr_schema_version()) ?></b> — سیستم هنگام باز شدن هر صفحه، ساختار دیتابیس را خودکار بررسی می‌کند؛
    اگر ستون یا جدول تازه‌ای کم باشد، خودش اضافه می‌شود (معلومات شما پاک نمی‌شود).
  </p>
  <?php if (!$schemaOk): ?>
    <div class="alert alert-error">ساختار دیتابیس ناقص است — روی دکمه زیر بزنید تا بروزرسانی شود.</div>
  <?php endif; ?>
  <form method="post" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
    <?= csrf_field() ?>
    <input type="hidden" name="action" value="repair_schema">
    <button class="btn" type="submit"><?= icon('refresh', 15) ?> بروزرسانی و ترمیم ساختار دیتابیس</button>
    <a class="btn" href="doctor.php"><?= icon('check', 15) ?> بررسی سلامت سیستم</a>
  </form>
</div>

<!-- ======================= منطقه خطر ======================= -->
<div class="card" id="danger">
  <div class="card-head">
    <h2><?= icon('warn') ?> صفر کردن سیستم (منطقه خطر)</h2>
    <span class="badge badge-warn">فقط مدیر</span>
  </div>

  <p class="muted">
    وضعیت فعلی: <?php $parts = []; foreach ($counts as $lbl => $n) { $parts[] = $lbl . ': ' . fmt($n); } echo e(implode(' | ', $parts)); ?>
  </p>
  <?php if ($isEmpty): ?>
    <div class="alert alert-info">سیستم الآن خالی است — هیچ معلومات کاری (فروش، مصرف، رسید، معاش، کارمند یا مشتری) موجود نیست.</div>
  <?php endif; ?>

  <p>
    با «صفر کردن سیستم» تمام فروشات، مصارف، رسیدات، معاشات، حضور و غیاب، مشتریان، کارمندان و
    سابقه فعالیت‌ها پاک می‌شود و شماره اسناد از نو (۰۰۱) شروع می‌شود.
    <b>تنظیمات، مشخصات شرکت، کاربران سیستم و جدول‌های کشویی پاک نمی‌شوند.</b>
  </p>
  <div class="alert alert-error">این کار قابل برگشت نیست. پیش از صفر کردن، از صفحه
    <a href="backup.php">پشتیبان‌گیری</a> یک فایل پشتیبان بگیرید.</div>

  <form method="post" class="form-grid"
        data-confirm="تمام فروشات، مصارف، رسیدات، معاشات، حضور و غیاب، مشتریان و کارمندان پاک می‌شود و شماره اسناد از نو شروع می‌گردد. این کار قابل برگشت نیست — مطمئن هستید؟"
        data-confirm-title="صفر کردن سیستم" data-confirm-ok="صفر کن" data-confirm-type="err" data-confirm-danger>
    <?= csrf_field() ?>
    <input type="hidden" name="action" value="reset_data">
    <div class="field col-third">
      <label>برای تأیید، کلمه <b>RESET</b> را بنویسید <span class="req">*</span></label>
      <input type="text" name="confirm_word" placeholder="RESET" autocomplete="off" required>
    </div>
    <div class="field col-third">
      <label>&nbsp;</label>
      <button class="btn btn-danger" type="submit"><?= icon('trash') ?> صفر کردن سیستم</button>
    </div>
  </form>

  <hr style="border:0;border-top:1px solid var(--line);margin:14px 0">

  <!-- ---------- گزینه‌های ویژه (پنهان — با رمز مخصوص) ---------- -->
  <div class="special-box">
    <?php if (!special_unlocked()): ?>
      <form method="post" class="row-tight">
        <?= csrf_field() ?>
        <input type="hidden" name="action" value="special_unlock">
        <div class="field" style="min-width:220px">
          <label><?= icon('lock', 14) ?> رمز مخصوص (برای نمایش گزینه‌های ویژه)</label>
          <input type="password" name="special_pass" placeholder="••••••••" autocomplete="off" required>
        </div>
        <button class="btn btn-sm" type="submit"><?= icon('check', 14) ?> نمایش گزینه‌های ویژه</button>
      </form>
      <small class="help">این بخش برای کارهای پیشرفته است و به صورت پیش‌فرض پنهان می‌ماند.</small>
    <?php else: ?>
      <div class="card-head" style="margin-bottom:8px">
        <h3 style="margin:0"><?= icon('warn', 15) ?> گزینه‌های ویژه</h3>
        <form method="post" style="margin:0">
          <?= csrf_field() ?>
          <input type="hidden" name="action" value="special_lock">
          <button class="btn btn-sm" type="submit"><?= icon('lock', 13) ?> قفل کردن (<?= fmt(special_minutes_left()) ?> دقیقه)</button>
        </form>
      </div>

      <div class="option-row">
        <span class="option-dash">—</span>
        <div class="option-body">
          <b>بازگشت به حالت کارخانه</b>
          <div class="option-note">
            علاوه بر معلومات کاری، <b>جدول‌های کشویی</b> (اقلام و مواد، انواع مصرف - مربوط، پرداخت‌کنندگان، منابع رسیدات) و
            <b>ماشینری</b> هم پاک می‌شوند و <b>تنظیمات + مشخصات شرکت</b> به حالت پیش‌فرض کارخانه برمی‌گردد؛
            سپس فهرست‌های اولیه دوباره ساخته می‌شود. کاربران سیستم باقی می‌مانند.
          </div>
          <form method="post" class="row-tight"
                data-confirm="همه معلومات کاری، جدول‌های کشویی و تنظیمات به حالت اولیه کارخانه برمی‌گردد (کاربران سیستم باقی می‌مانند). مطمئن هستید؟"
                data-confirm-title="بازگشت به حالت کارخانه" data-confirm-ok="اجرا کن" data-confirm-type="err" data-confirm-danger>
            <?= csrf_field() ?>
            <input type="hidden" name="action" value="factory_reset">
            <input type="text" name="confirm_word" placeholder="RESET" autocomplete="off" required style="max-width:150px">
            <button class="btn btn-danger btn-sm" type="submit"><?= icon('refresh', 14) ?> اجرای بازگشت به کارخانه</button>
          </form>
        </div>
      </div>
    <?php endif; ?>
  </div>

  <hr style="border:0;border-top:1px solid var(--line);margin:14px 0">
  <form method="post" data-confirm="معلومات نمونه (کارمندان، مشتریان و اسناد آزمایشی) بارگذاری شود؟ این معلومات حقیقی نیستند — بعداً با «صفر کردن سیستم» پاک کنید."
        data-confirm-title="بارگذاری معلومات نمونه" data-confirm-ok="بارگذاری کن" data-confirm-type="warn">
    <?= csrf_field() ?>
    <input type="hidden" name="action" value="load_demo">
    <button class="btn" type="submit"><?= icon('upload') ?> بارگذاری معلومات نمونه (فقط برای آزمایش)</button>
    <small class="help">۲۰ کارمند، چند مشتری و اسناد نمونه اضافه می‌شود تا راپورها را امتحان کنید — بعداً با «صفر کردن سیستم» پاک کنید.</small>
  </form>
</div>

<!-- ============ تنظیمات جداول کشویی (هر کدام در صفحه خودش) ============ -->
<div class="card" id="lookups">
  <div class="card-head">
    <h2><?= icon('list') ?> تنظیمات اقلام و فهرست‌ها</h2>
    <span class="muted">۴ بخش</span>
  </div>
  <p class="muted">این بخش‌ها در سایدبار، داخل زیرمنوی «تنظیمات» هم موجود است. هر بخش یک صفحه منظم و جداگانه دارد:
    ویرایش نام‌ها، واحد، ترتیب کشوها، فعال/غیرفعال کردن و حذف — همراه با نمایش اینکه هر قلم در چند سند استفاده شده است.</p>
  <div class="link-grid">
    <?php foreach ($lookupTables as $key => $meta): ?>
      <a class="link-card" href="settings_lookups.php?t=<?= e($key) ?>">
        <span class="link-ico"><?= icon($meta['icon'], 20) ?></span>
        <span class="link-body">
          <b><?= e($meta['short']) ?></b>
          <small><?= e(mb_substr($meta['help'], 0, 92)) ?>…</small>
        </span>
        <span class="link-go"><?= icon('back', 16) ?></span>
      </a>
    <?php endforeach; ?>
  </div>
</div>

<?php page_footer(); ?>
