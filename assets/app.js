/* ==========================================================================
   اسکریپت‌های سیستم فردای روشن — منو، تاریخ‌پیکر شمسی/میلادی، محاسبات فورم
   ========================================================================== */
(function () {
  'use strict';

  // ---------- منوی موبایل (کشویی با پرده تاریک) ----------
  var toggle = document.getElementById('menuToggle');
  var sidebar = document.getElementById('sidebar');
  var overlay = document.getElementById('navOverlay');
  function closeNav() {
    if (sidebar) { sidebar.classList.remove('open'); }
    document.body.classList.remove('nav-open');
  }
  if (toggle && sidebar) {
    toggle.addEventListener('click', function (e) {
      e.preventDefault();
      var open = sidebar.classList.toggle('open');
      document.body.classList.toggle('nav-open', open);
    });
  }
  if (overlay) { overlay.addEventListener('click', closeNav); }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { closeNav(); closePopSafe(); } });
  document.addEventListener('click', function (e) {
    if (window.innerWidth > 900) { return; }
    var a = e.target.closest ? e.target.closest('.sidebar a') : null;
    if (a) { closeNav(); }
  });
  window.addEventListener('resize', function () { if (window.innerWidth > 900) { closeNav(); } });
  function closePopSafe() { if (typeof closePop === 'function') { closePop(); } }

  // ---------- تغییر سریع حالت روشن/تیره (بدون درخواست به سرور) ----------
  var themeBtn = document.getElementById('themeToggle');
  function currentTheme() {
    var saved = null;
    try { saved = localStorage.getItem('fr_theme'); } catch (e) {}
    return saved || document.documentElement.getAttribute('data-theme') || 'auto';
  }
  function isDarkNow() {
    var t = currentTheme();
    if (t === 'dark') { return true; }
    if (t === 'light') { return false; }
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  function paintThemeBtn() {
    if (!themeBtn) { return; }
    var dark = isDarkNow();
    themeBtn.innerHTML = dark
      ? '<svg class="ico-svg" width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="3.1"/><path d="M8 1.6v1.4M8 13v1.4M1.6 8h1.4M13 8h1.4M3.5 3.5l1 1M11.5 11.5l1 1M12.5 3.5l-1 1M4.5 11.5l-1 1"/></svg>'
      : '<svg class="ico-svg" width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M13.2 10.2A5.6 5.6 0 0 1 5.8 2.8 5.6 5.6 0 1 0 13.2 10.2z"/></svg>';
    themeBtn.title = dark ? 'حالت روشن' : 'حالت تیره';
  }
  function setTheme(mode, save) {
    document.documentElement.setAttribute('data-theme', mode);
    if (save) { try { localStorage.setItem('fr_theme', mode); } catch (e) {} }
    paintThemeBtn();
  }
  if (themeBtn) {
    themeBtn.addEventListener('click', function () { setTheme(isDarkNow() ? 'light' : 'dark', true); });
    paintThemeBtn();
    if (window.matchMedia) {
      var mq = window.matchMedia('(prefers-color-scheme: dark)');
      if (mq.addEventListener) { mq.addEventListener('change', paintThemeBtn); }
    }
  }

  // ---------- تبدیل تقویم (پورت الگوریتم جلالی) ----------
  function div(a, b) { return Math.trunc(a / b); }
  function mod(a, b) { return a - Math.floor(a / b) * b; }

  function jalCal(jy) {
    var breaks = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210,
      1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178];
    var bl = breaks.length, gy = jy + 621, leapJ = -14, jp = breaks[0], jm, jump = 0, n, leap, leapG, march, i;
    for (i = 1; i < bl; i += 1) {
      jm = breaks[i];
      jump = jm - jp;
      if (jy < jm) { break; }
      leapJ = leapJ + div(jump, 33) * 8 + div(mod(jump, 33), 4);
      jp = jm;
    }
    n = jy - jp;
    leapJ = leapJ + div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
    if (mod(jump, 33) === 4 && jump - n === 4) { leapJ += 1; }
    leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
    march = 20 + leapJ - leapG;
    if (jump - n < 6) { n = n - jump + div(jump + 4, 33) * 33; }
    leap = mod(mod(n + 1, 33) - 1, 4);
    if (leap === -1) { leap = 4; }
    return { leap: leap, gy: gy, march: march };
  }
  function g2d(gy, gm, gd) {
    var d = div((gy + div(gm - 8, 6) + 100100) * 1461, 4) + div(153 * mod(gm + 9, 12) + 2, 5) + gd - 34840408;
    d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
    return d;
  }
  function d2g(jdn) {
    var j = 4 * jdn + 139361631, i, gd, gm, gy;
    j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
    i = div(mod(j, 1461), 4) * 5 + 308;
    gd = div(mod(i, 153), 5) + 1;
    gm = mod(div(i, 153), 12) + 1;
    gy = div(j, 1461) - 100100 + div(8 - gm, 6);
    return [gy, gm, gd];
  }
  function j2d(jy, jm, jd) {
    var r = jalCal(jy);
    return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1;
  }
  function d2j(jdn) {
    var gy = d2g(jdn)[0], jy = gy - 621, r = jalCal(jy), jdn1f = g2d(gy, 3, r.march), k, jm, jd;
    k = jdn - jdn1f;
    if (k >= 0) {
      if (k <= 185) { jm = 1 + div(k, 31); jd = mod(k, 31) + 1; return [jy, jm, jd]; }
      k -= 186;
    } else {
      jy -= 1; k += 179;
      if (r.leap === 1) { k += 1; }
    }
    jm = 7 + div(k, 30);
    jd = mod(k, 30) + 1;
    return [jy, jm, jd];
  }
  function toJalaali(gy, gm, gd) { return d2j(g2d(gy, gm, gd)); }
  function toGregorian(jy, jm, jd) { return d2g(j2d(jy, jm, jd)); }
  function monthDays(jy, jm) {
    if (jm <= 6) { return 31; }
    if (jm <= 11) { return 30; }
    return jalCal(jy).leap === 0 ? 30 : 29;
  }
  window.FRCal = { toJalaali: toJalaali, toGregorian: toGregorian };

  var MODE = window.FR_CAL === 'miladi' ? 'miladi' : 'shamsi';
  var MONTHS_F = ['حمل', 'ثور', 'جوزا', 'سرطان', 'اسد', 'سنبله', 'میزان', 'عقرب', 'قوس', 'جدی', 'دلو', 'حوت'];
  var MONTHS_M = ['جنوری', 'فبروری', 'مارچ', 'اپریل', 'می', 'جون', 'جولای', 'اگست', 'سپتمبر', 'اکتوبر', 'نومبر', 'دسمبر'];
  var DOW = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function todayParts() {
    var d = new Date();
    return MODE === 'miladi'
      ? [d.getFullYear(), d.getMonth() + 1, d.getDate()]
      : toJalaali(d.getFullYear(), d.getMonth() + 1, d.getDate());
  }
  function partsToYmd(p) {
    var g = MODE === 'miladi' ? p : toGregorian(p[0], p[1], p[2]);
    return g[0] + '-' + pad(g[1]) + '-' + pad(g[2]);
  }

  // ---------- تاریخ پیکر ----------
  var openPop = null;
  function closePop() { if (openPop) { openPop.remove(); openPop = null; } }

  function buildPicker(input) {
    closePop();
    var pop = document.createElement('div');
    pop.className = 'dp-pop';
    var state = { y: 0, m: 0 };
    var t = todayParts();
    var parsed = parseValue(input.value);
    if (parsed) { state.y = parsed[0]; state.m = parsed[1]; } else { state.y = t[0]; state.m = t[1]; }

    function parseValue(v) {
      v = (v || '').replace(/[\u06F0-\u06F9\u0660-\u0669]/g, function (ch) {
        var fa = '۰۱۲۳۴۵۶۷۸۹', ar = '٠١٢٣٤٥٦٧٨٩', i = fa.indexOf(ch);
        return i >= 0 ? String(i) : String(ar.indexOf(ch));
      }).replace(/[-\\.]/g, '/').trim();
      var p = v.split('/').filter(function (x) { return x !== ''; });
      if (p.length !== 3) { return null; }
      var y = parseInt(p[0], 10), m = parseInt(p[1], 10), d = parseInt(p[2], 10);
      if (y < 100) { y += (y > 50 ? 1300 : 1400); }
      if (!y || !m || !d) { return null; }
      return [y, m, d];
    }

    function render() {
      var isJ = MODE === 'shamsi';
      var names = isJ ? MONTHS_F : MONTHS_M;
      var dim = isJ ? monthDays(state.y, state.m) : new Date(state.y, state.m, 0).getDate();
      var firstDow; // 0=شنبه
      var jdn = isJ ? j2d(state.y, state.m, 1) : g2d(state.y, state.m, 1);
      var g = isJ ? d2g(jdn) : [state.y, state.m, 1];
      var wd = new Date(g[0], g[1] - 1, g[2]).getDay(); // 0=Sunday
      firstDow = (wd + 1) % 7; // شنبه=0
      var html = '';
      html += '<div class="dp-head"><div class="dp-nav"><span data-nav="-1">‹ ماه قبل</span></div>'
        + '<div class="dp-title">' + names[state.m - 1] + ' ' + state.y + '</div>'
        + '<div class="dp-nav"><span data-nav="1">ماه بعد ›</span></div></div>';
      html += '<div class="dp-grid">';
      DOW.forEach(function (d) { html += '<div class="dow">' + d + '</div>'; });
      for (var i = 0; i < firstDow; i++) { html += '<div></div>'; }
      for (var d = 1; d <= dim; d++) {
        var cls = 'd';
        if (t[0] === state.y && t[1] === state.m && t[2] === d) { cls += ' today'; }
        html += '<div class="' + cls + '" data-day="' + d + '">' + d + '</div>';
      }
      html += '</div><div class="dp-foot"><span class="dp-today" style="cursor:pointer">امروز</span>'
        + '<span class="dp-close" style="cursor:pointer">بستن</span></div>';
      pop.innerHTML = html;
    }

    render();
    document.body.appendChild(pop);
    var r = input.getBoundingClientRect();
    var ph = pop.offsetHeight || 300;
    var top = (r.bottom + ph + 8 > window.innerHeight && r.top - ph - 8 > 0)
      ? r.top - ph - 8 : r.bottom + 4;
    var left = r.left;
    if (left + 250 > document.documentElement.clientWidth) { left = Math.max(6, r.right - 250); }
    pop.style.top = (window.scrollY + top) + 'px';
    pop.style.left = (window.scrollX + left) + 'px';
    openPop = pop;

    pop.addEventListener('click', function (e) {
      var nav = e.target.getAttribute && e.target.getAttribute('data-nav');
      if (nav) {
        state.m += parseInt(nav, 10);
        if (state.m < 1) { state.m = 12; state.y -= 1; }
        if (state.m > 12) { state.m = 1; state.y += 1; }
        render();
        return;
      }
      var day = e.target.getAttribute && e.target.getAttribute('data-day');
      if (day) {
        input.value = pad(state.y) + '/' + pad(state.m) + '/' + pad(parseInt(day, 10));
        input.dataset.ymd = partsToYmd([state.y, state.m, parseInt(day, 10)]);
        closePop();
        input.dispatchEvent(new Event('change', { bubbles: true }));
        return;
      }
      if (e.target.classList.contains('dp-today')) {
        input.value = t[0] + '/' + pad(t[1]) + '/' + pad(t[2]);
        input.dataset.ymd = partsToYmd(t);
        closePop();
        return;
      }
      if (e.target.classList.contains('dp-close')) { closePop(); }
    });
  }

  document.addEventListener('click', function (e) {
    if (e.target.classList && e.target.classList.contains('date-input')) {
      buildPicker(e.target);
    } else if (openPop && !openPop.contains(e.target)) {
      closePop();
    }
  });

  // ---------- محاسبات فورم‌ها ----------
  function num(v) {
    v = (v || '').replace(/[,\s،٬]/g, '')
      .replace(/[\u06F0-\u06F9]/g, function (ch) { return String('۰۱۲۳۴۵۶۷۸۹'.indexOf(ch)); })
      .replace(/[\u0660-\u0669]/g, function (ch) { return String('٠١٢٣٤٥٦٧٨٩'.indexOf(ch)); });
    var f = parseFloat(v);
    return isNaN(f) ? 0 : f;
  }
  function fmt(n) {
    var s = (Math.round(n * 100) / 100).toString();
    var p = s.split('.');
    p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return p.join('.');
  }
  window.FRnum = num;

  // فورم فروشات: کرایه «فی متر» است
  //   مجموع کرایه = متراژ × کرایه فی متر
  //   مجموع قیمت و کرایه = (متراژ × قیمت فی متر) + (متراژ × کرایه فی متر)
  function calcSales() {
    var v = document.getElementById('f_volume'), u = document.getElementById('f_unit_price'),
      fr = document.getElementById('f_freight'), tot = document.getElementById('f_total_amount'),
      ft = document.getElementById('f_freight_total');
    if (!v || !u || !fr || !tot) { return; }
    var volume = num(v.value);
    var goods = volume * num(u.value);
    var freight = volume * num(fr.value);
    tot.value = fmt(goods + freight);
    if (ft) { ft.value = fmt(freight); }
  }
  // فورم معاشات: مجموع پرداخت = معاش ثابت + پاداش + اضافه کاری − جریمه
  function calcSalary() {
    var b = document.getElementById('f_base_salary'), bo = document.getElementById('f_bonus'),
      o = document.getElementById('f_overtime_pay'), fi = document.getElementById('f_fine'),
      t = document.getElementById('f_total_pay');
    if (!b || !t) { return; }
    var total = num(b.value) + num(bo ? bo.value : 0) + num(o ? o.value : 0) - num(fi ? fi.value : 0);
    t.value = fmt(total);
  }
  function bindCalc() {
    ['f_volume', 'f_unit_price', 'f_freight'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) { el.addEventListener('input', calcSales); }
    });
    ['f_base_salary', 'f_bonus', 'f_overtime_pay', 'f_fine'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) { el.addEventListener('input', calcSalary); }
    });
    calcSales(); calcSalary();
  }
  bindCalc();

  // ---------- حضور و غیاب: انتخاب همه ----------
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (t && t.dataset && t.dataset.setAll) {
      var val = t.dataset.setAll;
      document.querySelectorAll('select.att-status').forEach(function (s) { s.value = val; });
    }
    if (t && t.dataset && t.dataset.checkAll !== undefined) {
      var on = t.checked;
      document.querySelectorAll('input.att-check').forEach(function (c) { c.checked = on; });
    }
  });

  // ---------- جستجوی زنده در جدول ----------
  var live = document.getElementById('liveSearch');
  if (live) {
    live.addEventListener('input', function () {
      var q = live.value.trim().toLowerCase();
      document.querySelectorAll('table.grid tbody tr').forEach(function (tr) {
        tr.style.display = (!q || tr.innerText.toLowerCase().indexOf(q) >= 0) ? '' : 'none';
      });
    });
  }

  // ---------- لیبل گزینه‌های انتخابی (seg / رنگ) ----------
  // اگر مرورگر :has() را پشتیبانی نکند، کلاس .checked را با خودِ رادیو هم‌خوان می‌کنیم
  function frSyncCheckedLabels() {
    document.querySelectorAll('.seg label, .color-swatch label').forEach(function (lab) {
      var inp = lab.querySelector('input[type=radio], input[type=checkbox]');
      if (!inp) { return; }
      lab.classList.toggle('checked', !!inp.checked);
    });
  }

  // ---------- نشانگر متحرک گروه‌های گزینه (seg) ----------
  // برجستگیِ گزینه انتخاب‌شده به نرمی (transform) از گزینه قبلی به گزینه جدید منتقل می‌شود.
  var frSegList = [];

  function frSegSameRow(labels) {
    var t0 = labels[0].getBoundingClientRect().top;
    for (var i = 1; i < labels.length; i++) {
      if (Math.abs(labels[i].getBoundingClientRect().top - t0) > 2) { return false; }
    }
    return true;
  }

  function frSegPrepare(seg) {
    var labels = Array.prototype.slice.call(seg.querySelectorAll('label'));
    if (labels.length < 2) { return null; }
    var ind = seg.querySelector('.seg-ind');
    if (!ind) {
      ind = document.createElement('span');
      ind.className = 'seg-ind';
      seg.insertBefore(ind, seg.firstChild);
    }
    return { seg: seg, ind: ind, labels: labels };
  }

  function frSegPlace(o) {
    var active = null, i, inp;
    for (i = 0; i < o.labels.length; i++) {
      inp = o.labels[i].querySelector('input');
      if (inp && inp.checked) { active = o.labels[i]; break; }
    }
    var rowOk = frSegSameRow(o.labels);
    if (!active || !rowOk) {
      // گزینه‌ها در چند ردیف افتاده‌اند → حالت ساده (بدون انیمیشن)
      o.seg.classList.remove('seg-anim');
      o.ind.style.width = '0px';
      return;
    }
    o.seg.classList.add('seg-anim');
    var sr = o.seg.getBoundingClientRect();
    var lr = active.getBoundingClientRect();
    o.ind.style.width = lr.width + 'px';
    o.ind.style.height = lr.height + 'px';
    o.ind.style.top = (lr.top - sr.top) + 'px';
    o.ind.style.bottom = 'auto';
    o.ind.style.transform = 'translateX(' + (lr.left - sr.left) + 'px)';
  }

  function frSegCollect() {
    frSegList = [];
    document.querySelectorAll('.seg').forEach(function (seg) {
      var o = frSegPrepare(seg);
      if (o) { frSegList.push(o); }
    });
  }

  function frSegRefresh(instant) {
    frSegList.forEach(function (o) {
      if (instant) {
        o.ind.style.transition = 'none';
        frSegPlace(o);
        // در فریم بعد انیمیشن برگردد
        requestAnimationFrame(function () {
          requestAnimationFrame(function () { o.ind.style.transition = ''; });
        });
      } else {
        frSegPlace(o);
      }
    });
  }

  function frSegInit() {
    frSegCollect();
    frSegRefresh(true);
  }
  frSegInit();
  window.addEventListener('resize', function () { frSegCollect(); frSegRefresh(true); });
  window.addEventListener('pageshow', function () { frSegInit(); });
  window.addEventListener('load', function () { frSegRefresh(true); });
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { frSegRefresh(true); });
  }

  frSyncCheckedLabels();
  document.querySelectorAll('.seg label, .color-swatch label').forEach(function (lab) {
    var inp = lab.querySelector('input[type=radio], input[type=checkbox]');
    if (!inp) { return; }
    var afterPick = function () {
      frSyncCheckedLabels();
      frSegRefresh(false);
    };
    inp.addEventListener('change', afterPick);
    lab.addEventListener('click', function () { setTimeout(afterPick, 0); });
    lab.addEventListener('keyup', function (e) {
      if (e.key === ' ' || e.key === 'Enter' || e.key.indexOf('Arrow') === 0) { setTimeout(afterPick, 0); }
    });
  });

  // ==========================================================================
  //  توست‌های مینیمال و مدرن — جایگزین کامل alert/confirm مرورگر
  //  FRToast.show({...})           پیام کوتاه (خودکار بسته می‌شود)
  //  FRToast.confirm({...})        پرسش (تأیید / انصراف / گزینه سوم) → Promise
  // ==========================================================================
  var FRToast = (function () {
    var ICONS = {
      ok:   '<path d="M3 8.5l3.2 3.2L13 4.8"/>',
      err:  '<path d="M4 4l8 8M12 4l-8 8"/>',
      warn: '<path d="M8 2.5 14 13H2z"/><path d="M8 6.5v3M8 11.3v.2"/>',
      info: '<circle cx="8" cy="8" r="6"/><path d="M8 7.2v4M8 4.9v.2"/>',
      ask:  '<circle cx="8" cy="8" r="6"/><path d="M8.2 11.6v-1.1M6.3 6.2a1.8 1.8 0 1 1 2.6 1.6c-.6.3-.9.6-.9 1.2"/>'
    };
    var TITLES = { ok: 'انجام شد', err: 'توجه', warn: 'هشدار', info: 'اطلاع', ask: 'تأیید' };
    var ICON_LABEL = { ok: 'موفق', err: 'خطا', warn: 'هشدار', info: 'اطلاع', ask: 'پرسش' };
    var box = null, max = 4;

    function svg(type) {
      return '<svg class="ico-svg" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor"'
        + ' stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
        + (ICONS[type] || ICONS.info) + '</svg>';
    }
    function mount() {
      if (box) { return box; }
      box = document.createElement('div');
      box.className = 'fr-toasts no-print';
      box.setAttribute('role', 'region');
      box.setAttribute('aria-label', 'پیام‌های سیستم');
      box.setAttribute('aria-live', 'polite');
      document.body.appendChild(box);
      return box;
    }
    function close(el) {
      if (!el || el.dataset.closing === '1') { return; }
      el.dataset.closing = '1';
      el.classList.remove('fr-in');
      el.classList.add('fr-out');
      setTimeout(function () { if (el.parentNode) { el.parentNode.removeChild(el); } }, 220);
    }
    function trim() {
      if (!box) { return; }
      var all = box.querySelectorAll('.fr-toast');
      for (var i = 0; i < all.length - max; i++) { close(all[i]); }
    }

    /**
     * نمایش پیام
     * opts: {type, title, msg, timeout(ms|0), actions:[{label,value,danger}], onAction}
     * خروجی: {el, close}
     */
    function show(opts) {
      opts = opts || {};
      var type = opts.type || 'info';
      var el = document.createElement('div');
      el.className = 'fr-toast ' + type + (opts.actions && opts.actions.length ? ' ask' : '');
      el.setAttribute('role', type === 'err' ? 'alert' : 'status');

      var icon = ICON_LABEL[type] ? '<span class="fr-toast-ico">' + svg(opts.icon || type) + '</span>' : '';
      var title = opts.title === false ? '' : '<div class="fr-toast-title">' + (opts.title || TITLES[type] || TITLES.info) + '</div>';
      var msg = opts.msg ? '<div class="fr-toast-msg">' + opts.msg + '</div>' : '';
      var acts = '';
      if (opts.actions && opts.actions.length) {
        acts = '<div class="fr-toast-act">' + opts.actions.map(function (a, i) {
          return '<button type="button" class="btn ' + (a.danger ? 'btn-danger' : (i === 0 ? 'btn-primary' : '')) + '" data-act="' + i + '">'
            + a.label + '</button>';
        }).join('') + '</div>';
      }
      el.innerHTML = icon + '<div class="fr-toast-body">' + title + msg + acts + '</div>'
        + '<button type="button" class="fr-toast-x" aria-label="بستن" data-close="1">'
        + '<svg class="ico-svg" width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M4 4l8 8M12 4l-8 8"/></svg>'
        + '</button>'
        + (opts.timeout ? '<span class="fr-toast-bar"></span>' : '');

      mount().appendChild(el);
      requestAnimationFrame(function () { el.classList.add('fr-in'); });
      trim();

      var timer = null;
      function stopTimer() { if (timer) { clearTimeout(timer); timer = null; } }
      function startTimer(ms, bar) {
        stopTimer();
        if (!ms) { return; }
        timer = setTimeout(function () { close(el); }, ms);
        if (bar) {
          bar.style.transition = 'transform ' + ms + 'ms linear';
          requestAnimationFrame(function () { bar.style.transform = 'scaleX(0)'; });
        }
      }
      if (opts.timeout) {
        startTimer(opts.timeout, el.querySelector('.fr-toast-bar'));
        el.addEventListener('mouseenter', stopTimer);
        el.addEventListener('mouseleave', function () { startTimer(opts.timeout, null); });
      }

      el.addEventListener('click', function (e) {
        var t = e.target.closest('[data-act],[data-close]');
        if (!t) { return; }
        if (t.dataset.close) { close(el); if (opts.onClose) { opts.onClose(); } return; }
        var a = opts.actions[parseInt(t.dataset.act, 10)];
        close(el);
        if (opts.onAction) { opts.onAction(a ? a.value : null, a); }
      });

      return { el: el, close: function () { close(el); } };
    }

    /**
     * پرسش با دکمه‌ها → Promise که با مقدار دکمه انتخاب‌شده حل می‌شود
     * opts: {title, msg, ok:'تأیید', okValue, cancel:'انصراف', alt:'گزینه دوم', altValue, danger}
     */
    function confirm(opts) {
      opts = opts || {};
      // مرورگرهای خیلی قدیمی که Promise ندارند: پرسش ساده مرورگر (بدون توست)
      if (typeof Promise !== 'function') {
        var plain = (opts.title ? opts.title + '\n\n' : '') + (opts.msg || '');
        return { then: function (fn) { fn(window.confirm(plain) ? 'ok' : 'cancel'); } };
      }
      return new Promise(function (resolve) {
        var actions = [];
        if (opts.alt) {
          actions.push({ label: opts.alt, value: opts.altValue === undefined ? 'alt' : opts.altValue });
        }
        actions.push({ label: opts.ok || 'تأیید', value: opts.okValue === undefined ? 'ok' : opts.okValue, danger: !!opts.danger });
        actions.push({ label: opts.cancel || 'انصراف', value: 'cancel' });
        var t = show({
          type: opts.type || 'ask',
          icon: opts.icon || 'ask',
          title: opts.title || 'تأیید',
          msg: opts.msg || '',
          actions: actions,
          onAction: function (v) { resolve(v || 'cancel'); },
          onClose: function () { resolve('cancel'); }
        });
        // Escape = انصراف
        var onKey = function (e) {
          if (e.key === 'Escape') { document.removeEventListener('keydown', onKey, true); t.close(); resolve('cancel'); }
        };
        document.addEventListener('keydown', onKey, true);
        var first = t.el.querySelector('.fr-toast-act .btn');
        if (first) { first.focus({ preventScroll: true }); }
      });
    }

    return {
      show: show,
      confirm: confirm,
      ok: function (msg, title) { return show({ type: 'ok', msg: msg, title: title, timeout: 5000 }); },
      err: function (msg, title) { return show({ type: 'err', msg: msg, title: title, timeout: 9000 }); },
      warn: function (msg, title) { return show({ type: 'warn', msg: msg, title: title, timeout: 8000 }); },
      info: function (msg, title) { return show({ type: 'info', msg: msg, title: title, timeout: 5500 }); },
      closeAll: function () { if (box) { Array.prototype.slice.call(box.children).forEach(close); } }
    };
  })();
  window.FRToast = FRToast;

  // کمک‌کارهای قدیمی‌پسند (برای مرورگرهای قدیمی موبایل/تبلت)
  if (!Element.prototype.closest) {
    Element.prototype.closest = function (sel) {
      var el = this;
      while (el && el.nodeType === 1) {
        if (el.matches ? el.matches(sel) : false) { return el; }
        el = el.parentElement;
      }
      return null;
    };
  }
  if (!NodeList.prototype.forEach) {
    NodeList.prototype.forEach = Array.prototype.forEach;
  }
  if (!Array.prototype.find) {
    Array.prototype.find = function (fn) {
      for (var i = 0; i < this.length; i++) { if (fn(this[i], i, this)) { return this[i]; } }
      return undefined;
    };
  }
  if (!document.querySelectorAll || !window.Promise) { /* صفحه بدون توست هم درست کار می‌کند */ }

  // ---------- پیام‌های سرور (flash) به شکل توست ----------
  (function () {
    var TYPE = { success: 'ok', error: 'err', warn: 'warn', warning: 'warn', info: 'info' };
    var nodes = Array.prototype.slice.call(document.querySelectorAll('.alert[data-toast]'));
    nodes.forEach(function (el, i) {
      var type = TYPE[el.getAttribute('data-toast')] || 'info';
      var html = (el.getAttribute('data-toast-msg') !== null && el.getAttribute('data-toast-msg') !== '')
        ? el.getAttribute('data-toast-msg')
        : el.innerHTML;
      el.parentNode && el.parentNode.removeChild(el);
      setTimeout(function () {
        FRToast.show({
          type: type,
          msg: html,
          timeout: type === 'err' ? 9000 : (type === 'warn' ? 8000 : 5500)
        });
      }, 90 + i * 120);
    });
    // پیام‌های داخل صفحه (مثلاً نتیجه ذخیره در فرم) هم به توست تبدیل می‌شوند
    document.querySelectorAll('[data-toast-inline]').forEach(function (el) {
      el.remove();
    });
  })();

  // ---------- پرسش‌های حذف/ویرایش با توست (بدون alert مرورگر) ----------
  (function () {
    // متن‌ها را از data-* می‌خوانیم:
    //   data-confirm="متن پرسش"  data-confirm-title="عنوان"  data-confirm-ok="تأیید"
    //   data-confirm-alt="گزینه دوم"  data-confirm-alt-value="مقدار"  data-confirm-type="warn|err|ask"
    //   data-confirm-danger  → دکمه تأیید سرخ
    function ask(el) {
      return {
        title: el.getAttribute('data-confirm-title') || 'تأیید',
        msg: el.getAttribute('data-confirm') || '',
        ok: el.getAttribute('data-confirm-ok') || 'تأیید',
        alt: el.getAttribute('data-confirm-alt') || '',
        altValue: el.getAttribute('data-confirm-alt-value') || 'alt',
        danger: (function () {
          var dv = el.getAttribute('data-confirm-danger');
          return dv !== null && dv !== '' && dv !== '0' && dv !== 'false';
        })(),
        type: el.getAttribute('data-confirm-type') || 'ask'
      };
    }
    function rawSubmit(form) {
      form.dataset.frConfirmed = '1';
      if (typeof form.requestSubmit === 'function') {
        HTMLFormElement.prototype.submit.call(form); // بدون دوباره پرسیدن
      } else {
        HTMLFormElement.prototype.submit.call(form);
      }
    }

    // فرم‌ها (capture = قبل از هر هندلر دیگر)
    document.addEventListener('submit', function (e) {
      var form = e.target;
      if (!form || form.nodeName !== 'FORM') { return; }
      if (form.dataset.frConfirmed === '1') { return; }   // قبلاً تأیید شده
      if (window.FR_DIRTY_FORM && window.FR_DIRTY_FORM(form)) { return; }  // فرم فهرست‌ها خودش پرسش دارد
      var conf = form.getAttribute('data-confirm');
      if (!conf) { return; }
      e.preventDefault();
      e.stopPropagation();
      FRToast.confirm(ask(form)).then(function (res) {
        if (res === 'cancel') { return; }
        if (res !== 'ok') {
          var h = form.querySelector('input[name="confirm_mode"], input[name="mode"]');
          if (h) { h.value = res; }
        }
        rawSubmit(form);
      });
    }, true);

    // لینک‌ها و دکمه‌های مستقل
    document.addEventListener('click', function (e) {
      var el = e.target.closest ? e.target.closest('a[data-confirm],button[data-confirm]') : null;
      if (!el) { return; }
      var form = el.closest('form');
      if (el.nodeName === 'BUTTON' && form) { return; }   // دکمه داخل فرم → با رویداد submit پرسیده می‌شود
      e.preventDefault();
      FRToast.confirm(ask(el)).then(function (res) {
        if (res === 'cancel') { return; }
        if (el.nodeName === 'A') {
          if (res !== 'ok') {
            var u = el.getAttribute('data-confirm-alt-href');
            if (u) { window.location.href = u; return; }
          }
          window.location.href = el.getAttribute('href');
        } else if (form) {
          rawSubmit(form);
        }
      });
    });
  })();

  // ---------- فرم‌های فهرست تنظیمات: حالت «ذخیره‌نشده» + جلوگیری از از دست رفتن تغییرات ----------
  (function () {
    var form = document.getElementById('lookupForm');
    if (!form) { return; }
    var note = document.getElementById('lookupDirtyNote');
    var state = { dirty: false };
    function setDirty(v) {
      state.dirty = v;
      form.classList.toggle('fr-dirty', v);
      if (note) { note.hidden = !v; }
    }
    form.addEventListener('input', function () { setDirty(true); });
    form.addEventListener('change', function () { setDirty(true); });
    form.addEventListener('submit', function () { setDirty(false); });
    window.addEventListener('beforeunload', function (e) {
      if (state.dirty) { e.preventDefault(); e.returnValue = ''; }
    });
    // اگر تغییر ذخیره‌نشده هست، کارهای فوری (حذف/فعال/ترتیب) صفحه را نو نمی‌کنند
    window.FR_DIRTY_FORM = function (f) { return f === form && state.dirty; };
    document.querySelectorAll('#lookupForm [data-lookup-now]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        if (!state.dirty) { return; }
        e.preventDefault();
        e.stopImmediatePropagation();
        FRToast.warn('تغییرات ذخیره‌نشده دارید — اول دکمه «ذخیره تغییرات» را بزنید، بعد این کار را انجام دهید.');
      }, true);
    });
    var saveBtn = form.querySelector('button[type=submit]');
    if (saveBtn) {
      saveBtn.addEventListener('click', function () {
        if (state.dirty) { FRToast.info('در حال ذخیره تغییرات ...', 'ذخیره'); }
      });
    }
  })();

  // ---------- دسته‌بندی و جستجوی فهرست تنظیمات ----------
  (function () {
    var box = document.getElementById('lookupSearch');
    var table = document.querySelector('#lookupForm table.lookup-table');
    if (!box || !table) { return; }
    var rows = Array.prototype.slice.call(table.querySelectorAll('tbody tr[data-name]'));
    var chips = Array.prototype.slice.call(document.querySelectorAll('.lk-chips .chip'));
    var empty = document.getElementById('lookupEmpty');
    var filter = 'all';
    function apply() {
      var q = box.value.trim().toLowerCase();
      var shown = 0;
      rows.forEach(function (tr) {
        var hitQ = !q || (tr.getAttribute('data-name') || '').indexOf(q) !== -1;
        var on = tr.getAttribute('data-active') === '1';
        var used = parseInt(tr.getAttribute('data-used') || '0', 10) > 0;
        var hitF = filter === 'all' || (filter === 'on' && on) || (filter === 'off' && !on) || (filter === 'used' && used);
        var show = hitQ && hitF;
        tr.classList.toggle('row-hide', !show);
        if (show) { shown++; }
      });
      if (empty) { empty.hidden = shown > 0; }
    }
    box.addEventListener('input', apply);
    chips.forEach(function (c) {
      c.addEventListener('click', function () {
        chips.forEach(function (x) { x.classList.remove('on'); });
        c.classList.add('on');
        filter = c.getAttribute('data-filter') || 'all';
        apply();
      });
    });
    apply();
    // کلید / فوکوس روی جستجو
    document.addEventListener('keydown', function (e) {
      if (e.key === '/' && document.activeElement !== box && !/^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement.nodeName)) {
        e.preventDefault(); box.focus();
      }
    });
  })();


  // ---------- پیش‌نمایش فوری ظاهر (صفحه تنظیمات) ----------
  if (window.FR_THEME_FORMS && window.FR_PALETTES) {
    var root = document.documentElement;
    var hexRgb = function (hex) {
      hex = hex.replace('#', '');
      return [parseInt(hex.substr(0, 2), 16), parseInt(hex.substr(2, 2), 16), parseInt(hex.substr(4, 2), 16)];
    };
    var applyAccent = function (key) {
      var p = window.FR_PALETTES[key];
      if (!p) { return; }
      root.style.setProperty('--accent', p[0]);
      var rgb = hexRgb(p[0]);
      root.style.setProperty('--accent-l', 'rgba(' + rgb + ',.09)');
      root.style.setProperty('--accent-l2', 'rgba(' + rgb + ',.22)');
    };
    document.querySelectorAll('.color-swatch label').forEach(function (lab) {
      lab.addEventListener('click', function () {
        document.querySelectorAll('.color-swatch label').forEach(function (l) { l.classList.remove('checked'); });
        lab.classList.add('checked');
      });
    });
    document.querySelectorAll('#appearanceForm input[type=radio]').forEach(function (inp) {
      inp.addEventListener('change', function () {
        var name = inp.name, val = inp.value;
        if (name === 'accent') { applyAccent(val); }
        if (name === 'theme_mode') { document.documentElement.setAttribute('data-theme', val); }
        if (name === 'density') { root.setAttribute('data-density', val); }
        if (name === 'font_size') { root.setAttribute('data-fs', val); }
        if (name === 'corner_style') { root.setAttribute('data-corners', val); }
        if (name === 'font_family') { root.setAttribute('data-font', val); }
      });
    });
    var stripes = document.querySelector('#appearanceForm input[name=table_stripes]');
    if (stripes) {
      stripes.addEventListener('change', function () {
        root.setAttribute('data-stripes', stripes.checked ? '1' : '0');
        frSyncCheckedLabels();
      });
    }
  }


  // ---------- جدول‌های پهن در موبایل: شروع از ستون‌های اول (سمت راست) ----------
  function resetTableScroll() {
    document.querySelectorAll('.table-wrap').forEach(function (w) {
      if (w.scrollWidth > w.clientWidth) {
        // چون جهت جدول راست‌چین است، «شروع» جدول در سمت راست قرار دارد
        w.scrollLeft = w.scrollWidth;
      }
    });
  }
  resetTableScroll();
  window.addEventListener('pageshow', resetTableScroll);

  // ---------- زیرمنوی سایدبار (مثل «تنظیمات») ----------
  (function () {
    var groups = document.querySelectorAll('.nav-group');
    if (!groups.length) { return; }
    var KEY = 'fr_nav_open';
    var saved = {};
    try { saved = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { saved = {}; }
    function save() {
      try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch (e) {}
    }
    groups.forEach(function (g) {
      var key = g.getAttribute('data-group') || '';
      var caret = g.querySelector('.nav-caret');
      var hasActive = !!g.querySelector('.nav-sub a.active');
      // اگر صفحه جاری داخل همین زیرمنو است، همیشه باز بماند
      if (hasActive) { g.classList.add('open'); }
      else if (key && saved[key] === false) { g.classList.remove('open'); }
      else if (key && saved[key] === true) { g.classList.add('open'); }
      if (caret) {
        caret.setAttribute('aria-expanded', g.classList.contains('open') ? 'true' : 'false');
        caret.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          var open = g.classList.toggle('open');
          caret.setAttribute('aria-expanded', open ? 'true' : 'false');
          if (key && !hasActive) { saved[key] = open; save(); }
        });
      }
    });
  })();

  // ---------- هشدار خروج بدون ذخیره ----------
  var form = document.getElementById('crudForm');
  if (form) {
    var dirty = false;
    form.addEventListener('input', function () { dirty = true; });
    form.addEventListener('submit', function () { dirty = false; });
    window.addEventListener('beforeunload', function (e) {
      if (dirty) { e.preventDefault(); e.returnValue = ''; }
    });
  }
})();
