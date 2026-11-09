import { test, expect } from '@playwright/test';

test('credit sale and deposit are reflected correctly in the customer ledger', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByText('داده‌ها نمونه و موقتی‌اند')).toBeVisible();
  await page.getByRole('button', { name: 'مشتری جدید' }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByLabel('کد مشتری').fill('TEST-01');
  await dialog.getByLabel('نام مشتری / شرکت').fill('مشتری آزمایشی');
  await dialog.getByLabel('بدهی اولیه (افغانی)').fill('100');
  await dialog.getByRole('button', { name: 'ذخیره معلومات' }).click();
  await page.getByRole('button', { name: 'فروش جدید', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('مشتری').selectOption({ label: 'مشتری آزمایشی (TEST-01)' });
  await dialog.getByLabel('نوع پرداخت').selectOption('credit');
  await dialog.getByLabel('متراژ (متر مکعب)').fill('10');
  await dialog.getByLabel('قیمت فی متر (افغانی)').fill('500');
  await dialog.getByLabel('کرایه فی متر (افغانی)').fill('300');
  await dialog.getByRole('button', { name: 'ذخیره معلومات' }).click();
  await page.getByRole('button', { name: 'ثبت رسید', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('مشتری').selectOption({ label: 'مشتری آزمایشی (TEST-01)' });
  await dialog.getByLabel('مبلغ رسید (افغانی)').fill('500');
  await dialog.getByLabel('منبع رسید').selectOption('deposit');
  await dialog.getByRole('button', { name: 'ذخیره معلومات' }).click();
  await page.getByRole('button', { name: 'مشتریان', exact: true }).click();
  const row = page.getByRole('row').filter({ hasText: 'مشتری آزمایشی' });
  await expect(row).toContainText('8,100');
  await row.getByRole('button', { name: 'کارت حساب' }).click();
  dialog = page.getByRole('dialog');
  await expect(dialog.getByText('بدون تأثیر بر مانده')).toBeVisible();
  await expect(dialog).toContainText('8,100'); await expect(dialog).toContainText('S-000003'); await expect(dialog).toContainText('R-000002');
  await page.reload();
  await page.getByRole('button', { name: 'مشتریان', exact: true }).click();
  await expect(page.getByText('مشتری آزمایشی')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('mobile navigation opens and changes page', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'باز کردن منو' }).click();
  await page.getByRole('button', { name: 'مشتریان', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'فهرست مشتریان' })).toBeVisible();
});

test('browser preview does not pretend to create a real backup', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'پشتیبان‌گیری', exact: true }).click();
  await expect(page.getByText('در پیش‌نمایش مرورگر هیچ دیتابیس دائمی وجود ندارد')).toBeVisible();
  await expect(page.getByRole('button', { name: 'انتخاب محل و ساخت پشتیبان' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'انتخاب فایل برای بازگردانی' })).toBeDisabled();
});

test('Shamsi entry validates leap dates and displays the same stored date in both calendars', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'فروشات', exact: true }).click();
  await expect(page.getByRole('row').filter({ hasText: 'شرکت ساختمانی امید' }).first()).toContainText('1405/08/17');
  await page.getByRole('button', { name: 'فروش جدید', exact: true }).click();
  const dialog = page.getByRole('dialog');
  const date = dialog.getByLabel('تاریخ شمسی');
  await date.fill('۱۴۰۴/۱۲/۳۰');
  await expect(date).toHaveAttribute('aria-invalid', 'true');
  await dialog.getByLabel('متراژ (متر مکعب)').fill('1');
  await dialog.getByLabel('قیمت فی متر (افغانی)').fill('100');
  await dialog.getByRole('button', { name: 'ذخیره معلومات' }).click();
  await expect(dialog).toBeVisible();
  await date.fill('۱۴۰۳/۱۲/۳۰');
  await expect(date).toHaveAttribute('aria-invalid', 'false');
  await dialog.getByRole('button', { name: 'ذخیره معلومات' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('row').filter({ hasText: '1403/12/30' })).toHaveCount(1);
  await page.getByLabel('تقویم نمایش').selectOption('miladi');
  await expect(page.getByRole('row').filter({ hasText: '2025/03/20' })).toHaveCount(1);
  await page.getByLabel('جستجو').fill('۲۰۲۵/۰۳/۲۰');
  await expect(page.getByRole('row').filter({ hasText: '2025/03/20' })).toHaveCount(1);
});

test('create and edit an employee with a Shamsi hire date', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'کارمندان', exact: true }).click();
  await page.getByRole('button', { name: 'کارمند جدید' }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByLabel('کد کارمند').fill('EMP-123');
  await dialog.getByLabel('نام و تخلص').fill('کارمند نمونه');
  await dialog.getByLabel('وظیفه', { exact: true }).fill('حسابدار');
  await dialog.getByLabel('تاریخ استخدام (شمسی)').fill('۱۴۰۴/۰۱/۰۱');
  await dialog.getByLabel('معاش پایه (افغانی)').fill('12500.50');
  await dialog.getByRole('button', { name: 'ذخیره معلومات' }).click();
  let row = page.getByRole('row').filter({ hasText: 'کارمند نمونه' });
  await expect(row).toContainText('1404/01/01');
  await expect(row).toContainText('12,500.50');
  await row.getByRole('button', { name: 'ویرایش' }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('وضعیت').selectOption('inactive');
  await dialog.getByRole('button', { name: 'ذخیره معلومات' }).click();
  row = page.getByRole('row').filter({ hasText: 'کارمند نمونه' });
  await expect(row).toContainText('غیرفعال');
  await page.getByLabel('تقویم نمایش').selectOption('miladi');
  await expect(row).toContainText('2025/03/21');
});


test('editing customer preserves transactions and updates the balance', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'مشتریان', exact: true }).click();
  const row = page.getByRole('row').filter({ hasText: 'شرکت ساختمانی امید' });
  await row.getByRole('button', { name: 'ویرایش' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('تغییر بدهی اولیه');
  await dialog.getByLabel('نام مشتری / شرکت').fill('شرکت ویرایش شده');
  await dialog.getByLabel('بدهی اولیه (افغانی)').fill('100');
  await dialog.getByRole('button', { name: 'ذخیره معلومات' }).click();
  const edited = page.getByRole('row').filter({ hasText: 'شرکت ویرایش شده' });
  await expect(edited).toContainText('42,100');
  await edited.getByRole('button', { name: 'کارت حساب' }).click();
  await expect(page.getByRole('dialog')).toContainText('42,100');
  await expect(page.getByRole('dialog')).toContainText('شرکت ویرایش شده');
});


test('records and edits an expense with separate currencies and calendar conversion', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name:'مصارف', exact:true }).click();
  await page.getByRole('button', { name:'مصرف جدید' }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByLabel('تاریخ شمسی').fill('۱۴۰۴/۰۱/۰۱');
  await dialog.getByLabel('شرح مصرف').fill('تیل آزمایشی');
  await dialog.getByLabel('نوع مصرف').fill('سوخت');
  await dialog.getByRole('button', { name:'ذخیره معلومات' }).click();
  await expect(dialog.getByRole('alert')).toContainText('بیشتر از صفر');
  await dialog.getByLabel('مبلغ افغانی').fill('۱۲۳.۵۰');
  await dialog.getByLabel('مبلغ دالری').fill('5.25');
  await dialog.getByRole('button', { name:'ذخیره معلومات' }).click();
  let row = page.getByRole('row').filter({ hasText:'تیل آزمایشی' });
  await expect(row).toContainText('1404/01/01'); await expect(row).toContainText('123.50'); await expect(row).toContainText('5.25');
  await row.getByRole('button', { name:'ویرایش' }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('روش پرداخت').selectOption('credit');
  await dialog.getByLabel('مبلغ افغانی').fill('0');
  await dialog.getByRole('button', { name:'ذخیره معلومات' }).click();
  row = page.getByRole('row').filter({ hasText:'تیل آزمایشی' });
  await expect(row).toContainText('باقی'); await expect(row).toContainText('5.25');
  await page.getByLabel('تقویم نمایش').selectOption('miladi');
  await expect(row).toContainText('2025/03/21');
});


test('expense date filters and independent totals never include out-of-range rows', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name:'مصارف', exact:true }).click();
  for (const [date, description, afn, usd] of [['۱۴۰۴/۰۱/۰۱','اول','100.50','5.25'],['۱۴۰۴/۰۱/۰۲','دوم','200.25','0']]) {
    await page.getByRole('button', { name:'مصرف جدید' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('تاریخ شمسی').fill(date); await dialog.getByLabel('شرح مصرف').fill(description);
    await dialog.getByLabel('مبلغ افغانی').fill(afn); await dialog.getByLabel('مبلغ دالری').fill(usd);
    await dialog.getByRole('button', { name:'ذخیره معلومات' }).click();
  }
  await expect(page.locator('.expense-summary')).toContainText('300.75');
  await expect(page.locator('.expense-summary')).toContainText('5.25');
  await page.getByLabel('از تاریخ (شمسی)').fill('۱۴۰۴/۰۱/۰۲');
  await expect(page.locator('.expense-summary')).toContainText('200.25');
  await expect(page.getByRole('row').filter({ hasText:'اول' })).toHaveCount(0);
  await page.getByLabel('تا تاریخ (شمسی)').fill('۱۴۰۴/۰۱/۰۱');
  await expect(page.getByRole('alert')).toContainText('تاریخ آغاز');
  await expect(page.locator('.expense-summary')).toHaveCount(0);
  await page.getByLabel('تقویم نمایش').selectOption('miladi');
  await expect(page.getByLabel('از تاریخ (میلادی)')).toHaveValue('');
});


test('changing calendar while a form is open keeps the date consistent', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name:'مصارف', exact:true }).click();
  await page.getByRole('button', { name:'مصرف جدید' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('تاریخ شمسی').fill('۱۴۰۴/۰۱/۰۱');
  // Change the external control directly to exercise state updates while the modal is mounted.
  await page.getByLabel('تقویم نمایش').evaluate((el: HTMLSelectElement) => { el.value='miladi'; el.dispatchEvent(new Event('change', { bubbles:true })); });
  await expect(dialog.getByLabel('تاریخ میلادی')).toHaveValue('2025/03/21');
  await dialog.getByLabel('شرح مصرف').fill('تغییر تقویم');
  await dialog.getByLabel('مبلغ افغانی').fill('1');
  await dialog.getByRole('button', { name:'ذخیره معلومات' }).click();
  await expect(page.getByRole('row').filter({ hasText:'تغییر تقویم' })).toContainText('2025/03/21');
});


test('salary snapshots base and keeps period calendar explicit', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name:'معاشات', exact:true }).click();
  await page.getByRole('button', { name:'پرداخت معاش جدید' }).click();
  let dialog=page.getByRole('dialog');
  await expect(dialog.getByLabel('معاش ثابت')).toHaveValue('15000.00');
  await dialog.getByLabel('سال دوره').fill('۱۴۰۴'); await dialog.getByLabel('ماه دوره').selectOption('1');
  await dialog.getByLabel('تاریخ پرداخت (شمسی)').fill('۱۴۰۴/۰۱/۰۱');
  await dialog.getByLabel('پاداش').fill('100.50'); await dialog.getByLabel('جریمه').fill('50'); await dialog.getByLabel('اضافه‌کاری').fill('25');
  await expect(dialog.locator('.total-box')).toContainText('15,075.50');
  await dialog.getByRole('button', { name:'ذخیره معلومات' }).click();
  let row=page.getByRole('row').filter({hasText:'احمد احمدی'}); await expect(row).toContainText('1404/01'); await expect(row).toContainText('شمسی'); await expect(row).toContainText('15,075.50');
  await page.getByLabel('تقویم نمایش').selectOption('miladi'); await expect(row).toContainText('2025/03/21'); await expect(row).toContainText('شمسی');
  await row.getByRole('button', { name:'ویرایش' }).click(); dialog=page.getByRole('dialog');
  await dialog.getByLabel('جریمه').fill('20000'); await expect(dialog).toContainText('مجموع منفی است');
  await dialog.getByLabel('نوع پرداخت').selectOption('transfer'); await dialog.getByRole('button', { name:'ذخیره معلومات' }).click();
  row=page.getByRole('row').filter({hasText:'احمد احمدی'}); await expect(row).toContainText('حواله'); await expect(row).toContainText('-4,874.50');
});


test('warns about another salary in the same employee period without blocking installments', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name:'معاشات', exact:true }).click();
  await page.getByRole('button', { name:'پرداخت معاش جدید' }).click();
  let dialog=page.getByRole('dialog');
  await dialog.getByLabel('سال دوره').fill('۱۴۰۴'); await dialog.getByLabel('ماه دوره').selectOption('1');
  await dialog.getByRole('button', { name:'ذخیره معلومات' }).click();
  const row=page.getByRole('row').filter({hasText:'احمد احمدی'});
  await row.getByRole('button', { name:'ویرایش' }).click(); dialog=page.getByRole('dialog');
  await expect(dialog.locator('.salary-warning')).toHaveCount(0);
  await dialog.getByRole('button', { name:'انصراف' }).click();
  await page.getByRole('button', { name:'پرداخت معاش جدید' }).click(); dialog=page.getByRole('dialog');
  await dialog.getByLabel('سال دوره').fill('۱۴۰۴'); await dialog.getByLabel('ماه دوره').selectOption('1');
  await expect(dialog.getByRole('status')).toContainText('پرداخت دیگر');
  await dialog.getByLabel('تقویم دوره').selectOption('miladi'); await expect(dialog.locator('.salary-warning')).toHaveCount(0);
  await dialog.getByLabel('تقویم دوره').selectOption('shamsi');
  await dialog.getByRole('button', { name:'ذخیره معلومات' }).click();
  await expect(page.getByRole('row').filter({hasText:'احمد احمدی'})).toHaveCount(2);
});

test('salary filters report only matching payment dates and types', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button',{name:'معاشات',exact:true}).click();
  for (const [date,type,base] of [['۱۴۰۴/۰۱/۰۱','cash','100'],['۱۴۰۴/۰۱/۰۲','transfer','200']]) {
    await page.getByRole('button',{name:'پرداخت معاش جدید'}).click(); const dialog=page.getByRole('dialog');
    await dialog.getByLabel('تاریخ پرداخت (شمسی)').fill(date); await dialog.getByLabel('نوع پرداخت').selectOption(type);
    await dialog.getByLabel('معاش ثابت').fill(base); await dialog.getByRole('button',{name:'ذخیره معلومات'}).click();
  }
  await expect(page.locator('.expense-summary')).toContainText('300');
  await page.getByLabel('فیلتر نوع پرداخت').selectOption('transfer');
  await expect(page.locator('.expense-summary')).toContainText('200');
  await page.getByLabel('تا تاریخ پرداخت (شمسی)').fill('۱۴۰۴/۰۱/۰۱');
  await expect(page.getByRole('row').filter({hasText:'احمد احمدی'})).toHaveCount(0);
  await page.getByLabel('از تاریخ پرداخت (شمسی)').fill('۱۴۰۴/۰۱/۰۲');
  await expect(page.getByRole('alert')).toContainText('تاریخ آغاز');
  await expect(page.locator('.expense-summary')).toHaveCount(0);
});


test('attendance registers one employee per date and supports editing', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button',{name:'حضور و غیاب',exact:true}).click();
  await page.getByRole('button',{name:'ثبت حضور جدید'}).click(); let dialog=page.getByRole('dialog');
  await dialog.getByLabel('تاریخ کار (شمسی)').fill('۱۴۰۴/۰۱/۰۱'); await dialog.getByLabel('ساعت ورود').fill('۰۸:۳۰');
  await dialog.getByLabel('ساعت خروج').fill('16:30'); await dialog.getByLabel('اضافه‌کاری (ساعت)').fill('1.25');
  await dialog.getByRole('button',{name:'ذخیره معلومات'}).click();
  let row=page.getByRole('row').filter({hasText:'احمد احمدی'}); await expect(row).toContainText('1404/01/01'); await expect(row).toContainText('08:30'); await expect(row).toContainText('1.25');
  await page.getByRole('button',{name:'ثبت حضور جدید'}).click(); dialog=page.getByRole('dialog');
  await dialog.getByLabel('تاریخ کار (شمسی)').fill('۱۴۰۴/۰۱/۰۱'); await dialog.getByRole('button',{name:'ذخیره معلومات'}).click();
  await expect(dialog.getByRole('alert')).toContainText('قبلاً حضور ثبت'); await dialog.getByRole('button',{name:'انصراف'}).click();
  await row.getByRole('button',{name:'ویرایش'}).click(); dialog=page.getByRole('dialog');
  await dialog.getByLabel('وضعیت حضور').selectOption('leave'); await dialog.getByLabel('ساعت ورود').fill('');
  await dialog.getByRole('button',{name:'ذخیره معلومات'}).click(); await expect(row).toContainText('رخصت');
  await page.getByLabel('تقویم نمایش').selectOption('miladi'); row=page.getByRole('row').filter({hasText:'احمد احمدی'}); await expect(row).toContainText('2025/03/21');
});

test('attendance summary counts only matching recorded days and exact overtime', async ({page})=>{
  await page.goto('/'); await page.getByRole('button',{name:'حضور و غیاب',exact:true}).click();
  for (const [date,status,overtime] of [['۱۴۰۴/۰۱/۰۱','present','1.25'],['۱۴۰۴/۰۱/۰۲','absent','0.50']]) {
    await page.getByRole('button',{name:'ثبت حضور جدید'}).click(); const dialog=page.getByRole('dialog');
    await dialog.getByLabel('تاریخ کار (شمسی)').fill(date); await dialog.getByLabel('وضعیت حضور').selectOption(status);
    await dialog.getByLabel('اضافه‌کاری (ساعت)').fill(overtime); await dialog.getByRole('button',{name:'ذخیره معلومات'}).click();
  }
  await expect(page.locator('.expense-summary')).toContainText('1.75');
  await page.getByLabel('فیلتر وضعیت حضور').selectOption('absent');
  await expect(page.locator('.expense-summary')).toContainText('0.50');
  await expect(page.getByRole('row').filter({hasText:'احمد احمدی'})).toHaveCount(1);
  await page.getByLabel('از تاریخ کار (شمسی)').fill('۱۴۰۴/۰۱/۰۳');
  await page.getByLabel('تا تاریخ کار (شمسی)').fill('۱۴۰۴/۰۱/۰۱');
  await expect(page.getByRole('alert')).toContainText('تاریخ آغاز'); await expect(page.locator('.expense-summary')).toHaveCount(0);
});


test('daily sheet creates selected employees without overwriting existing records', async ({page})=>{
  await page.goto('/'); await page.getByRole('button',{name:'کارمندان',exact:true}).click();
  await page.getByRole('button',{name:'کارمند جدید'}).click(); let dialog=page.getByRole('dialog');
  await dialog.getByLabel('کد کارمند').fill('E2'); await dialog.getByLabel('نام و تخلص').fill('کارمند دوم');
  await dialog.getByRole('button',{name:'ذخیره معلومات'}).click();
  await page.getByRole('button',{name:'حضور و غیاب',exact:true}).click();
  await page.getByRole('button',{name:'ورق روزانه'}).click(); dialog=page.getByRole('dialog');
  await dialog.getByLabel('تاریخ ورق (شمسی)').fill('۱۴۰۴/۰۱/۰۱');
  await dialog.getByLabel('وضعیت احمد احمدی (EMP-001)').selectOption('present');
  await dialog.getByLabel('وضعیت کارمند دوم (E2)').selectOption('leave');
  await dialog.getByRole('button',{name:'ذخیره ورق'}).click();
  await expect(page.getByRole('row').filter({hasText:'احمد احمدی'})).toContainText('حاضر');
  await expect(page.getByRole('row').filter({hasText:'کارمند دوم'})).toContainText('رخصت');
  await page.getByRole('button',{name:'ورق روزانه'}).click(); dialog=page.getByRole('dialog');
  await dialog.getByLabel('تاریخ ورق (شمسی)').fill('۱۴۰۴/۰۱/۰۱');
  await expect(dialog.getByText('کارمند فعال بدون رکورد برای این تاریخ وجود ندارد.')).toBeVisible();
  await expect(dialog.getByRole('button',{name:'ذخیره ورق'})).toBeDisabled();
  await dialog.getByLabel('تاریخ ورق (شمسی)').fill('۱۴۰۴/۰۱/۰۲');
  await dialog.getByRole('button',{name:'همهٔ قابل ثبت حاضر'}).click();
  await expect(dialog.getByLabel('وضعیت کارمند دوم (E2)')).toHaveValue('present');
  await dialog.getByLabel('تاریخ ورق (شمسی)').fill('۱۴۰۴/۰۱/۰۳');
  await expect(dialog.getByLabel('وضعیت کارمند دوم (E2)')).toHaveValue('');
});

test('sales list pages through its own full history and filters dates', async ({page})=>{
  await page.goto('/'); await page.getByRole('button',{name:'فروشات',exact:true}).click();
  for (let i=0;i<26;i++) {
    await page.getByRole('button',{name:'فروش جدید',exact:true}).click(); const dialog=page.getByRole('dialog');
    await dialog.getByLabel('تاریخ شمسی').fill('۱۴۰۴/۰۱/۰۱'); await dialog.getByLabel('متراژ (متر مکعب)').fill('1'); await dialog.getByLabel('قیمت فی متر (افغانی)').fill('10');
    await dialog.getByRole('button',{name:'ذخیره معلومات'}).click();
  }
  await expect(page.getByText('28 رکورد مطابق فیلترها')).toBeVisible();
  await page.getByRole('button',{name:'صفحهٔ بعدی'}).click(); await expect(page.getByText('صفحهٔ 2',{exact:true})).toBeVisible();
  await expect(page.getByRole('row').filter({hasText:'1404/01/01'})).toHaveCount(3);
  await page.getByLabel('از تاریخ (شمسی)').fill('۱۴۰۴/۰۱/۰۲');
  await expect(page.getByText('صفحهٔ 1',{exact:true})).toBeVisible();
  await expect(page.getByText('2 رکورد مطابق فیلترها')).toBeVisible();
  await page.getByLabel('تا تاریخ (شمسی)').fill('۱۴۰۴/۰۱/۰۱');
  await expect(page.getByRole('alert')).toContainText('تاریخ آغاز');
  await expect(page.getByRole('button',{name:'صفحهٔ بعدی'})).toBeDisabled();
});

test('transaction filters apply to customers and sale type or receipt source', async ({page})=>{
  await page.goto('/'); await page.getByRole('button',{name:'فروشات',exact:true}).click();
  await page.getByLabel('فیلتر مشتری').selectOption({label:'شرکت ساختمانی امید (CUS-001)'});
  await expect(page.getByText('1 رکورد مطابق فیلترها')).toBeVisible();
  await page.getByLabel('فیلتر نوع پرداخت').selectOption('cash');
  await expect(page.getByText('0 رکورد مطابق فیلترها')).toBeVisible();
  await page.getByRole('button',{name:'رسیدات',exact:true}).click();
  await page.getByRole('button',{name:'رسید جدید'}).click(); const dialog=page.getByRole('dialog');
  await dialog.getByLabel('مشتری').selectOption({label:'شرکت ساختمانی امید (CUS-001)'});
  await dialog.getByLabel('مبلغ رسید (افغانی)').fill('5'); await dialog.getByLabel('منبع رسید').selectOption('deposit');
  await dialog.getByRole('button',{name:'ذخیره معلومات'}).click();
  await page.getByLabel('فیلتر منبع رسید').selectOption('deposit');
  await expect(page.getByText('1 رکورد مطابق فیلترها')).toBeVisible();
  await expect(page.getByRole('row').filter({hasText:'امانت'})).toHaveCount(1);
});

test('read-only sale and receipt details show the recorded components',async({page})=>{
  await page.goto('/'); await page.getByRole('button',{name:'فروشات',exact:true}).click();
  await page.getByRole('button',{name:'فروش جدید',exact:true}).click(); let dialog=page.getByRole('dialog');
  await dialog.getByLabel('متراژ (متر مکعب)').fill('1.250'); await dialog.getByLabel('قیمت فی متر (افغانی)').fill('200'); await dialog.getByLabel('کرایه فی متر (افغانی)').fill('30');
  await dialog.getByRole('button',{name:'ذخیره معلومات'}).click();
  let row=page.getByRole('row').filter({hasText:'287.50'}); await row.getByRole('button',{name:'جزئیات'}).click(); dialog=page.getByRole('dialog');
  await expect(dialog).toContainText('1.250'); await expect(dialog).toContainText('200'); await expect(dialog).toContainText('30'); await expect(dialog).toContainText('287.50');
  await dialog.getByText('بستن',{exact:true}).click();
  await page.getByRole('button',{name:'رسیدات',exact:true}).click(); await page.getByRole('button',{name:'رسید جدید'}).click(); dialog=page.getByRole('dialog');
  await dialog.getByLabel('مبلغ رسید (افغانی)').fill('1.25'); await dialog.getByLabel('منبع رسید').selectOption('deposit'); await dialog.getByRole('button',{name:'ذخیره معلومات'}).click();
  row=page.getByRole('row').filter({hasText:'1.25'}); await row.getByRole('button',{name:'جزئیات'}).click(); dialog=page.getByRole('dialog');
  await expect(dialog).toContainText('امانت'); await expect(dialog).toContainText('تأثیر ندارد'); await expect(dialog).toContainText('1.25');
});

test('editing sale and receipt updates customer ledgers', async ({page})=>{
  await page.goto('/'); await page.getByRole('button',{name:'مشتریان',exact:true}).click();
  for (const [code,name,opening] of [['EDIT-A','اول ویرایش','100'],['EDIT-B','دوم ویرایش','0']]) {
    await page.getByRole('button',{name:'مشتری جدید'}).click(); const dialog=page.getByRole('dialog');
    await dialog.getByLabel('کد مشتری').fill(code); await dialog.getByLabel('نام مشتری / شرکت').fill(name); await dialog.getByLabel('بدهی اولیه (افغانی)').fill(opening); await dialog.getByRole('button',{name:'ذخیره معلومات'}).click();
  }
  await page.getByRole('button',{name:'فروشات',exact:true}).click(); await page.getByRole('button',{name:'فروش جدید',exact:true}).click(); let dialog=page.getByRole('dialog');
  await dialog.getByLabel('مشتری').selectOption({label:'اول ویرایش (EDIT-A)'}); await dialog.getByLabel('نوع پرداخت').selectOption('credit');
  await dialog.getByLabel('متراژ (متر مکعب)').fill('1'); await dialog.getByLabel('قیمت فی متر (افغانی)').fill('200'); await dialog.getByRole('button',{name:'ذخیره معلومات'}).click();
  let row=page.getByRole('row').filter({hasText:'اول ویرایش'}); await row.getByRole('button',{name:'جزئیات'}).click(); dialog=page.getByRole('dialog'); await dialog.getByRole('button',{name:'ویرایش'}).click(); dialog=page.getByRole('dialog');
  await expect(dialog).toContainText('سابقهٔ تغییرات'); await dialog.getByLabel('مشتری').selectOption({label:'دوم ویرایش (EDIT-B)'}); await dialog.getByLabel('قیمت فی متر (افغانی)').fill('300'); await dialog.getByRole('button',{name:'ذخیره معلومات'}).click();
  await page.getByRole('button',{name:'مشتریان',exact:true}).click();
  await expect(page.getByRole('row').filter({hasText:'اول ویرایش'})).toContainText('100'); await expect(page.getByRole('row').filter({hasText:'دوم ویرایش'})).toContainText('300');
  await page.getByRole('button',{name:'رسیدات',exact:true}).click(); await page.getByRole('button',{name:'رسید جدید'}).click(); dialog=page.getByRole('dialog');
  await dialog.getByLabel('مشتری').selectOption({label:'دوم ویرایش (EDIT-B)'}); await dialog.getByLabel('مبلغ رسید (افغانی)').fill('50'); await dialog.getByLabel('منبع رسید').selectOption('deposit'); await dialog.getByRole('button',{name:'ذخیره معلومات'}).click();
  row=page.getByRole('row').filter({hasText:'دوم ویرایش'}); await row.getByRole('button',{name:'جزئیات'}).click(); dialog=page.getByRole('dialog'); await dialog.getByRole('button',{name:'ویرایش'}).click(); dialog=page.getByRole('dialog');
  await dialog.getByLabel('منبع رسید').selectOption('debt'); await dialog.getByRole('button',{name:'ذخیره معلومات'}).click();
  await page.getByRole('button',{name:'مشتریان',exact:true}).click(); row=page.getByRole('row').filter({hasText:'دوم ویرایش'}); await expect(row).toContainText('250');
  await row.getByRole('button',{name:'کارت حساب'}).click(); await expect(page.getByRole('dialog')).toContainText('250');
});

test('monthly attendance report counts only recorded dates and respects calendar months',async({page})=>{
  await page.goto('/'); await page.getByRole('button',{name:'حضور و غیاب',exact:true}).click();
  for (const [date,status,overtime] of [['1404/01/01','present','1.25'],['1404/01/02','absent','0.50'],['1404/02/01','leave','2']]) {
    await page.getByRole('button',{name:'ثبت حضور جدید'}).click(); const dialog=page.getByRole('dialog');
    await dialog.getByLabel('تاریخ کار (شمسی)').fill(date); await dialog.getByLabel('وضعیت حضور').selectOption(status); await dialog.getByLabel('اضافه‌کاری (ساعت)').fill(overtime); await dialog.getByRole('button',{name:'ذخیره معلومات'}).click();
  }
  await page.getByRole('button',{name:'راپور حضور ماهانه',exact:true}).click(); await page.getByLabel('ماه (شمسی)').fill('۱۴۰۴/۰۱');
  const row=page.getByRole('row').filter({hasText:'احمد احمدی'}); const cells=row.getByRole('cell');
  await expect(cells.nth(2)).toHaveText('2'); await expect(cells.nth(3)).toHaveText('1'); await expect(cells.nth(4)).toHaveText('1'); await expect(cells.nth(5)).toHaveText('0'); await expect(cells.nth(9)).toHaveText('1.75');
  await expect(page.getByText('روزهای ثبت‌نشده نه غایب', {exact:false})).toBeVisible();
  await page.getByLabel('ماه (شمسی)').fill('1404/13'); await expect(page.getByRole('alert')).toContainText('معتبر نیست');
  await page.getByLabel('تقویم نمایش').selectOption('miladi'); await page.getByLabel('ماه (میلادی)').fill('2025/03'); await expect(cells.nth(2)).toHaveText('2');
});

test('financial report uses the requested inclusive dates and keeps currencies and deposits separate',async({page})=>{
  await page.goto('/');
  await page.getByRole('button',{name:'فروشات',exact:true}).click(); await page.getByRole('button',{name:'فروش جدید',exact:true}).click(); let dialog=page.getByRole('dialog');
  await dialog.getByLabel('تاریخ شمسی').fill('1404/01/01'); await dialog.getByLabel('نوع پرداخت').selectOption('credit'); await dialog.getByLabel('متراژ (متر مکعب)').fill('1.25'); await dialog.getByLabel('قیمت فی متر (افغانی)').fill('100'); await dialog.getByRole('button',{name:'ذخیره معلومات'}).click();
  await page.getByRole('button',{name:'رسیدات',exact:true}).click(); await page.getByRole('button',{name:'رسید جدید'}).click(); dialog=page.getByRole('dialog');
  await dialog.getByLabel('تاریخ شمسی').fill('1404/01/02'); await dialog.getByLabel('مبلغ رسید (افغانی)').fill('30'); await dialog.getByLabel('منبع رسید').selectOption('deposit'); await dialog.getByRole('button',{name:'ذخیره معلومات'}).click();
  await page.getByRole('button',{name:'مصارف',exact:true}).click(); await page.getByRole('button',{name:'مصرف جدید'}).click(); dialog=page.getByRole('dialog');
  await dialog.getByLabel('تاریخ شمسی').fill('1404/01/01'); await dialog.getByLabel('شرح مصرف').fill('گزارش'); await dialog.getByLabel('مبلغ افغانی').fill('12.50'); await dialog.getByLabel('مبلغ دالری').fill('5.25'); await dialog.getByLabel('روش پرداخت').selectOption('credit'); await dialog.getByRole('button',{name:'ذخیره معلومات'}).click();
  await page.getByRole('button',{name:'راپور مالی بازه‌ای',exact:true}).click();
  await page.getByLabel('از تاریخ (شمسی)').fill('۱۴۰۴/۰۱/۰۱'); await page.getByLabel('تا تاریخ (شمسی)').fill('۱۴۰۴/۰۱/۰۲'); await page.getByRole('button',{name:'محاسبهٔ راپور'}).click();
  for(const [label,value] of [['فروش باقی','125'],['متراژ فروش','1.250'],['رسید امانت','30'],['رسیدهای مؤثر بر بدهی','0'],['مصارف افغانی','12.50'],['مصارف دالری','5.25']]) await expect(page.getByRole('row').filter({hasText:label})).toContainText(value);
  await expect(page.getByText('این ارقام موجودی دخل', {exact:false})).toBeVisible(); await expect(page.getByRole('button',{name:'خروجی CSV'})).toBeDisabled(); await expect(page.getByText('خروجی فایل در پیش‌نمایش مرورگر فعال نیست.')).toBeVisible();
  await page.getByLabel('تا تاریخ (شمسی)').fill('1403/12/29'); await expect(page.getByRole('row').filter({hasText:'فروش باقی'})).toHaveCount(0); await page.getByRole('button',{name:'محاسبهٔ راپور'}).click(); await expect(page.getByRole('alert')).toContainText('تاریخ آغاز');
  await page.getByLabel('تقویم نمایش').selectOption('miladi'); await page.getByLabel('از تاریخ (میلادی)').fill('2025/03/21'); await page.getByLabel('تا تاریخ (میلادی)').fill('2025/03/21'); await page.getByRole('button',{name:'محاسبهٔ راپور'}).click(); await expect(page.getByRole('row').filter({hasText:'رسید امانت'})).toContainText('0');
});

test('sale and receipt supplemental fields can be saved edited and searched',async({page})=>{
  await page.goto('/'); await page.getByRole('button',{name:'فروشات',exact:true}).click(); await page.getByRole('button',{name:'فروش جدید',exact:true}).click(); let dialog=page.getByRole('dialog');
  await dialog.getByLabel('متراژ (متر مکعب)').fill('1'); await dialog.getByLabel('قیمت فی متر (افغانی)').fill('100');
  await dialog.getByLabel('بلنمبر فروش').fill('BL-TEST-11'); await dialog.getByLabel('نام دریور').fill('راننده آزمایشی'); await dialog.getByLabel('پلیت موتر').fill('AB-123'); await dialog.getByLabel('مقصد').fill('کابل'); await dialog.getByLabel('توضیحات فروش').fill('خط اول\nخط دوم'); await dialog.getByRole('button',{name:'ذخیره معلومات'}).click();
  await page.getByLabel('جستجو',{exact:true}).fill('BL-TEST-11'); let row=page.getByRole('row').filter({hasText:'ماسه اول'}); await row.getByRole('button',{name:'جزئیات'}).click(); dialog=page.getByRole('dialog'); await expect(dialog).toContainText('راننده آزمایشی'); await expect(dialog).toContainText('AB-123'); await expect(dialog).toContainText('خط دوم');
  await dialog.getByRole('button',{name:'ویرایش'}).click(); dialog=page.getByRole('dialog'); await expect(dialog.getByLabel('مقصد')).toHaveValue('کابل'); await dialog.getByLabel('نام دریور').fill('راننده دوم'); await dialog.getByRole('button',{name:'ذخیره معلومات'}).click(); await row.getByRole('button',{name:'جزئیات'}).click(); dialog=page.getByRole('dialog'); await expect(dialog).toContainText('راننده دوم'); await expect(dialog).toContainText('BL-TEST-11'); await dialog.getByRole('button',{name:'بستن',exact:true}).last().click();
  await page.getByRole('button',{name:'رسیدات',exact:true}).click(); await page.getByRole('button',{name:'رسید جدید'}).click(); dialog=page.getByRole('dialog');
  await dialog.getByLabel('مبلغ رسید (افغانی)').fill('25'); await dialog.getByLabel('شماره بل مربوط').fill('BL-TEST-11'); await dialog.getByLabel('دریافت‌کننده').fill('دریافت آزمایشی'); await dialog.getByLabel('توضیحات رسید').fill('شرح رسید'); await dialog.getByRole('button',{name:'ذخیره معلومات'}).click();
  await page.getByLabel('جستجو',{exact:true}).fill('دریافت آزمایشی'); row=page.getByRole('row').filter({hasText:'باقی داری'}); await row.getByRole('button',{name:'جزئیات'}).click(); dialog=page.getByRole('dialog'); await expect(dialog).toContainText('BL-TEST-11'); await expect(dialog).toContainText('شرح رسید'); await dialog.getByRole('button',{name:'ویرایش'}).click(); dialog=page.getByRole('dialog'); await dialog.getByLabel('دریافت‌کننده').fill('دریافت جدید'); await dialog.getByRole('button',{name:'ذخیره معلومات'}).click();
  await expect(page.getByRole('row').filter({hasText:'باقی داری'})).toHaveCount(0); await page.getByLabel('جستجو',{exact:true}).fill('دریافت جدید'); await expect(page.getByRole('row').filter({hasText:'باقی داری'})).toHaveCount(1);
});

test('navigation remains scrollable on short screens',async({page})=>{
  await page.setViewportSize({width:390,height:480}); await page.goto('/'); await page.getByRole('button',{name:'باز کردن منو'}).click();
  const side=page.locator('.sidebar'); expect(await side.evaluate(el=>el.scrollHeight>el.clientHeight)).toBe(true);
  await side.getByRole('button',{name:'پشتیبان‌گیری',exact:true}).scrollIntoViewIfNeeded();
  expect(await side.evaluate(el=>el.scrollTop)).toBeGreaterThan(0); await side.getByRole('button',{name:'پشتیبان‌گیری',exact:true}).click();
  await expect(page.getByRole('heading',{name:'پشتیبان‌گیری و بازگردانی'})).toBeVisible();
});

test('local transaction numbers are searchable and remain fixed on edits',async({page})=>{
  await page.goto('/'); await page.getByRole('button',{name:'فروشات',exact:true}).click(); await page.getByRole('button',{name:'فروش جدید',exact:true}).click(); let dialog=page.getByRole('dialog');
  await dialog.getByLabel('متراژ (متر مکعب)').fill('1'); await dialog.getByLabel('قیمت فی متر (افغانی)').fill('100'); await dialog.getByRole('button',{name:'ذخیره معلومات'}).click();
  await page.getByLabel('جستجو',{exact:true}).fill('S-000003'); let row=page.getByRole('row').filter({hasText:'S-000003'}); await row.getByRole('button',{name:'جزئیات'}).click(); dialog=page.getByRole('dialog'); await expect(dialog).toContainText('S-000003'); await expect(dialog).toContainText('رسمی');
  await dialog.getByRole('button',{name:'ویرایش'}).click(); dialog=page.getByRole('dialog'); await dialog.getByLabel('قیمت فی متر (افغانی)').fill('120'); await dialog.getByRole('button',{name:'ذخیره معلومات'}).click(); await expect(row).toContainText('120');
  await page.getByRole('button',{name:'رسیدات',exact:true}).click(); await page.getByRole('button',{name:'رسید جدید'}).click(); dialog=page.getByRole('dialog'); await dialog.getByLabel('مبلغ رسید (افغانی)').fill('5'); await dialog.getByRole('button',{name:'ذخیره معلومات'}).click();
  await page.getByLabel('جستجو',{exact:true}).fill('R-000002'); row=page.getByRole('row').filter({hasText:'R-000002'}); await expect(row).toHaveCount(1); await row.getByRole('button',{name:'جزئیات'}).click(); await expect(page.getByRole('dialog')).toContainText('R-000002');
});

test('print preview isolates transaction details and keeps the experimental warning',async({page})=>{
  await page.goto('/'); await page.getByRole('button',{name:'فروشات',exact:true}).click(); await page.getByRole('row').filter({hasText:'S-000001'}).getByRole('button',{name:'جزئیات'}).click();
  const dialog=page.getByRole('dialog'); await expect(dialog).toContainText('شمارهٔ محلی آزمایشی');
  await page.evaluate(()=>{ (window as Window & {printCalled?:boolean}).print=()=>{(window as Window & {printCalled?:boolean}).printCalled=true;}; });
  await dialog.getByRole('button',{name:'چاپ آزمایشی'}).click(); expect(await page.evaluate(()=>(window as Window & {printCalled?:boolean}).printCalled)).toBe(true);
  await page.emulateMedia({media:'print'});
  await expect(dialog.getByText('شمارهٔ محلی آزمایشی',{exact:true})).toBeVisible(); await expect(dialog.getByText('S-000001')).toBeVisible();
  await expect(dialog.getByRole('button',{name:'ویرایش'})).toBeHidden();
  expect(await page.locator('.sidebar').evaluate(el=>getComputedStyle(el).visibility)).toBe('hidden');
  expect(await dialog.evaluate(el=>getComputedStyle(el).maxHeight)).toBe('none');
  expect(await dialog.locator('.details-text').first().evaluate(el=>getComputedStyle(el).whiteSpace)).toBe('pre-wrap');
  await page.emulateMedia({media:'screen'}); await expect(dialog.getByRole('button',{name:'ویرایش'})).toBeVisible();
});


test('long receipt details print across pages without clipping the notes',async({page})=>{
  await page.goto('/'); await page.getByRole('button',{name:'رسیدات',exact:true}).click(); await page.getByRole('button',{name:'رسید جدید'}).click(); let dialog=page.getByRole('dialog');
  await dialog.getByLabel('مبلغ رسید (افغانی)').fill('50'); await dialog.getByLabel('منبع رسید').selectOption('deposit');
  await dialog.getByLabel('توضیحات رسید').fill(Array.from({length:110},(_,i)=>`Row ${i+1} abc`).join('\n')); await dialog.getByRole('button',{name:'ذخیره معلومات'}).click();
  await page.getByLabel('جستجو',{exact:true}).fill('R-000002'); await page.getByRole('row').filter({hasText:'R-000002'}).getByRole('button',{name:'جزئیات'}).click(); dialog=page.getByRole('dialog');
  await page.emulateMedia({media:'print'}); await expect(dialog.getByText('رسید امانت در بدهی مشتری تأثیر ندارد.')).toBeVisible();
  const notes=dialog.locator('.details-text').filter({hasText:'Row 110 abc'}); expect(await notes.evaluate(el=>getComputedStyle(el).whiteSpace)).toBe('pre-wrap');
  const pdf=await page.pdf({format:'A4'}); const pageCount=(pdf.toString('latin1').match(/\/Type\s*\/Page\b/g) ?? []).length; expect(pageCount).toBeGreaterThan(1);
});

test('manual cashbook records independent movements and warns of negative balances', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('تقویم نمایش').selectOption('miladi');
  await page.getByRole('button', {name:'دفتر دستی دخل',exact:true}).click();
  await expect(page.getByText('هیچ فروش، رسید، مصرف یا معاش')).toBeVisible();
  await page.getByLabel('تاریخ حرکت (میلادی)').fill('2025/01/01');
  await page.getByLabel('شرح حرکت').fill('مانده آغازین');
  await page.getByLabel('مبلغ افغانی').fill('100');
  await page.getByLabel('مبلغ دالر').fill('5');
  await page.getByRole('button',{name:'ثبت حرکت دستی'}).click();
  await expect(page.getByRole('status')).toContainText('حرکت دستی ثبت شد');
  await page.getByLabel('تاریخ حرکت (میلادی)').fill('2025/01/02');
  await page.getByLabel('نوع حرکت').selectOption('out');
  await page.getByLabel('شرح حرکت').fill('خروجی آزمایشی');
  await page.getByLabel('مبلغ افغانی').fill('20');
  await page.getByLabel('مبلغ دالر').fill('8');
  await page.getByRole('button',{name:'ثبت حرکت دستی'}).click();
  await page.getByLabel('از تاریخ (میلادی)').fill('2025/01/02');
  await page.getByLabel('تا تاریخ (میلادی)').fill('2025/01/02');
  await expect(page.getByRole('row',{name:/ماندهٔ آغاز/})).toContainText('100');
  await expect(page.getByRole('row',{name:/ماندهٔ پایان/})).toContainText('80');
  await expect(page.getByRole('row',{name:/ماندهٔ پایان/})).toContainText('-3');
  await expect(page.getByRole('alert')).toContainText('منفی است');
  await expect(page.getByRole('row',{name:/خروجی آزمایشی/})).toBeVisible();
  await page.getByLabel('تقویم نمایش').selectOption('shamsi');
  await expect(page.getByLabel('تاریخ حرکت (شمسی)')).toBeVisible();
});

test('customer ledger range includes edges and prints an isolated experimental statement',async({page})=>{
  await page.goto('/'); await page.getByLabel('تقویم نمایش').selectOption('miladi');
  await page.getByRole('button',{name:'مشتریان',exact:true}).click();
  await page.evaluate(async()=>{
    const modulePath=performance.getEntriesByType('resource').map(x=>x.name).find(x=>new URL(x).pathname==='/src/store.ts')!; const {store}=await import(/* @vite-ignore */ modulePath);
    await store.addCustomer({code:'LEDGER',name:'مشتری بازه',phone:'',opening:'100'});
    const customer=(await store.snapshot()).customers.find((c:{code:string})=>c.code==='LEDGER');
    await store.addSale({customer_id:customer.id,date:'2025-01-01',material:'ریگ',volume:'1',unit_price:'50',freight:'0',payment_type:'credit'});
    await store.addReceipt({customer_id:customer.id,date:'2025-01-02',amount:'20',source:'deposit'});
    await store.addReceipt({customer_id:customer.id,date:'2025-01-02',amount:'30',source:'debt'});
    await store.addReceipt({customer_id:customer.id,date:'2025-01-03',amount:'10',source:'debt'});
  });
  // Refresh application state after test data was inserted into the preview adapter.
  await page.getByRole('button',{name:'مشتری جدید'}).click(); const form=page.getByRole('dialog');
  await form.getByLabel('کد مشتری').fill('refresh'); await form.getByLabel('نام مشتری / شرکت').fill('کمکی'); await form.getByRole('button',{name:'ذخیره معلومات'}).click();
  await page.getByRole('row').filter({hasText:'مشتری بازه'}).getByRole('button',{name:'کارت حساب'}).click(); const dialog=page.getByRole('dialog');
  await dialog.getByLabel('از تاریخ (میلادی)').fill('2025/01/02'); await dialog.getByLabel('تا تاریخ (میلادی)').fill('2025/01/02');
  await expect(dialog.locator('.ledger-summary')).toContainText('150'); await expect(dialog.locator('.ledger-summary')).toContainText('120');
  await expect(dialog.getByText('بدون تأثیر بر مانده')).toBeVisible(); await expect(dialog.locator('tbody tr')).toHaveCount(2);
  await dialog.getByLabel('تا تاریخ (میلادی)').fill('2025/02/29'); await expect(dialog.getByRole('alert')).toContainText('تاریخ معتبر');
  await expect(dialog.getByRole('button',{name:'چاپ آزمایشی کارت حساب'})).toBeDisabled();
  await dialog.getByLabel('تا تاریخ (میلادی)').fill('2025/01/02');
  await page.evaluate(()=>{(window as Window & {printCalled?:boolean}).print=()=>{(window as Window & {printCalled?:boolean}).printCalled=true;};});
  await dialog.getByRole('button',{name:'چاپ آزمایشی کارت حساب'}).click(); expect(await page.evaluate(()=>(window as Window & {printCalled?:boolean}).printCalled)).toBe(true);
  await page.emulateMedia({media:'print'}); await expect(dialog.getByText('بازهٔ شامل:',{exact:false})).toBeVisible();
  await expect(dialog.getByText('این کارت و چاپ آن آزمایشی است',{exact:false})).toBeVisible();
  await expect(dialog.getByLabel('از تاریخ (میلادی)')).toBeHidden(); await expect(dialog.getByRole('button',{name:'بارگذاری دوباره'})).toBeHidden();
  expect(await page.locator('.sidebar').evaluate(el=>getComputedStyle(el).visibility)).toBe('hidden');
  await page.emulateMedia({media:'screen'}); await dialog.getByRole('button',{name:'بارگذاری دوباره'}).click(); await expect(dialog.locator('tbody tr')).toHaveCount(2);
  await dialog.getByLabel('از تاریخ (میلادی)').fill('2025/01/04'); await dialog.getByLabel('تا تاریخ (میلادی)').fill('');
  await expect(dialog.locator('.ledger-summary')).toContainText('110'); await expect(dialog.getByText('گردشی در این بازه ثبت نشده است.')).toBeVisible();
  await dialog.getByRole('button',{name:'بستن',exact:true}).last().click(); await page.getByLabel('تقویم نمایش').selectOption('shamsi');
  await page.getByRole('row').filter({hasText:'مشتری بازه'}).getByRole('button',{name:'کارت حساب'}).click();
  await dialog.getByLabel('از تاریخ (شمسی)').fill('۱۴۰۳/۱۰/۱۳'); await dialog.getByLabel('تا تاریخ (شمسی)').fill('۱۴۰۳/۱۰/۱۳');
  await expect(dialog.locator('tbody tr')).toHaveCount(2); await expect(dialog.locator('.ledger-summary')).toContainText('120');
});

test('ledger print spans pages without limiting the number of rows',async({page})=>{
  await page.goto('/'); await page.getByRole('button',{name:'مشتریان',exact:true}).click();
  await page.evaluate(async()=>{
    const modulePath=performance.getEntriesByType('resource').map(x=>x.name).find(x=>new URL(x).pathname==='/src/store.ts')!; const {store}=await import(/* @vite-ignore */ modulePath);
    for(let i=0;i<80;i++) await store.addReceipt({customer_id:'demo-1',date:'2025-01-01',amount:'1',source:'debt'});
  });
  await page.getByRole('row').filter({hasText:'شرکت ساختمانی امید'}).getByRole('button',{name:'کارت حساب'}).click();
  const dialog=page.getByRole('dialog'); await expect(dialog.locator('tbody tr')).toHaveCount(82);
  await page.emulateMedia({media:'print'});
  const pdf=await page.pdf({format:'A4'}); expect((pdf.toString('latin1').match(/\/Type\s*\/Page\b/g)??[]).length).toBeGreaterThan(2);
  expect(await dialog.evaluate(el=>getComputedStyle(el).maxHeight)).toBe('none');
});

test('grouped report uses both dates, exact labels, and separate currencies',async({page})=>{
  await page.goto('/'); await page.getByLabel('تقویم نمایش').selectOption('miladi');
  await page.getByRole('button',{name:'راپور تفکیکی',exact:true}).click();
  await page.evaluate(async()=>{
    const modulePath=performance.getEntriesByType('resource').map(x=>x.name).find(x=>new URL(x).pathname==='/src/store.ts')!; const {store}=await import(/* @vite-ignore */ modulePath);
    const sale={customer_id:'demo-1',date:'2025-03-21',material:'ریگ',volume:'1',unit_price:'10',freight:'0',payment_type:'cash'};
    await store.addSale(sale); await store.addSale({...sale,date:'2025-03-22',payment_type:'credit',unit_price:'20'}); await store.addSale({...sale,date:'2025-03-23',material:'خاک'});
    const expense={date:'2025-03-21',description:'x',expense_type:'تیل',purchase_bill_no:'',shop_name:'',amount_afn:'1.20',amount_usd:'3.40',payer:'علی',payment_method:'credit',notes:''};
    await store.saveExpense(null,expense); await store.saveExpense(null,{...expense,date:'2025-03-22',payer:'',amount_afn:'0.80',amount_usd:'0.25',payment_method:'cash'});
  });
  await page.getByLabel('از تاریخ (میلادی)').fill('2025/03/21'); await page.getByLabel('تا تاریخ (میلادی)').fill('2025/03/22');
  await page.getByRole('button',{name:'محاسبهٔ راپور تفکیکی'}).click();
  const materials=page.getByRole('region',{name:'فروش بر اساس مواد'}); const materialRow=materials.getByRole('row').filter({hasText:'ریگ'});
  await expect(materialRow).toContainText('2'); await expect(materialRow).toContainText('2.000'); await expect(materialRow).toContainText('30'); await expect(materials).not.toContainText('خاک');
  const types=page.getByRole('region',{name:'مصارف بر اساس نوع'}); await expect(types.getByRole('row').filter({hasText:'تیل'})).toContainText('3.65'); await expect(types.getByRole('row').filter({hasText:'تیل'}).getByRole('cell').nth(2)).toHaveText('2');
  await expect(page.getByRole('button',{name:'خروجی CSV تفکیکی'})).toBeDisabled(); await expect(page.getByText('خروجی فایل در پیش‌نمایش مرورگر فعال نیست.')).toBeVisible();
  const payers=page.getByRole('region',{name:'مصارف بر اساس پرداخت‌کننده'}); await expect(payers).toContainText('ثبت نشده (خالی)'); await expect(payers).toContainText('0.25');
  await page.getByLabel('از تاریخ (میلادی)').fill('2025/03/23'); await expect(materials).toHaveCount(0);
  await page.getByRole('button',{name:'محاسبهٔ راپور تفکیکی'}).click(); await expect(page.getByRole('alert')).toContainText('تاریخ آغاز');
  await page.getByLabel('تقویم نمایش').selectOption('shamsi');
  await page.getByLabel('از تاریخ (شمسی)').fill('۱۴۰۴/۰۱/۰۱'); await page.getByLabel('تا تاریخ (شمسی)').fill('۱۴۰۴/۰۱/۰۲');
  await page.getByRole('button',{name:'محاسبهٔ راپور تفکیکی'}).click();
  await expect(page.getByRole('region',{name:'فروش بر اساس مواد'}).getByRole('row').filter({hasText:'ریگ'})).toContainText('30');
});

test('calendar save failure retains the old selection, and preview preference is temporary',async({page})=>{
  await page.goto('/'); const select=page.getByLabel('تقویم نمایش'); await expect(select).toHaveValue('shamsi');
  await page.evaluate(async()=>{
    const modulePath=performance.getEntriesByType('resource').map(x=>x.name).find(x=>new URL(x).pathname==='/src/store.ts')!;
    const {store}=await import(/* @vite-ignore */ modulePath); const original=store.setCalendarPreference;
    (window as Window & {restoreCalendar?:()=>void}).restoreCalendar=()=>{store.setCalendarPreference=original;};
    store.setCalendarPreference=async()=>{throw new Error('خطای آزمایشی ذخیره');};
  });
  await select.selectOption('miladi'); await expect(page.getByRole('alert')).toContainText('تنظیم تقویم ذخیره نشد'); await expect(select).toHaveValue('shamsi');
  await page.evaluate(()=>(window as Window & {restoreCalendar?:()=>void}).restoreCalendar!());
  await select.selectOption('miladi'); await expect(select).toHaveValue('miladi'); await expect(page.getByRole('alert')).toHaveCount(0);
  await page.reload(); await expect(page.getByLabel('تقویم نمایش')).toHaveValue('shamsi');
});

test('expense editing rejects stale data and refreshes the list for reopening',async({page})=>{
  await page.goto('/'); await page.getByRole('button',{name:'مصارف',exact:true}).click(); await page.getByRole('button',{name:'مصرف جدید'}).click();
  let dialog=page.getByRole('dialog'); await dialog.getByLabel('شرح مصرف').fill('مصرف همزمان'); await dialog.getByLabel('مبلغ افغانی').fill('10'); await dialog.getByRole('button',{name:'ذخیره معلومات'}).click();
  await page.getByRole('row').filter({hasText:'مصرف همزمان'}).getByRole('button',{name:'ویرایش'}).click(); dialog=page.getByRole('dialog');
  await dialog.getByLabel('مبلغ دالری').fill('5');
  await page.evaluate(async()=>{
    const modulePath=performance.getEntriesByType('resource').map(x=>x.name).find(x=>new URL(x).pathname==='/src/store.ts')!; const {store}=await import(/* @vite-ignore */ modulePath);
    const old=(await store.expenses()).find((e:{description:string})=>e.description==='مصرف همزمان'); await store.saveExpense(old.id,{...old,notes:'تغییر دیگر'},old);
  });
  await dialog.getByRole('button',{name:'ذخیره معلومات'}).click(); await expect(dialog.getByRole('alert')).toContainText('مصرف تغییر کرده');
  await expect(dialog.getByLabel('مبلغ دالری')).toHaveValue('5');
  await dialog.getByRole('button',{name:'انصراف'}).click();
  await page.getByRole('row').filter({hasText:'مصرف همزمان'}).getByRole('button',{name:'ویرایش'}).click(); dialog=page.getByRole('dialog');
  await expect(dialog.getByLabel('توضیحات')).toHaveValue('تغییر دیگر'); await dialog.getByLabel('مبلغ دالری').fill('5'); await dialog.getByRole('button',{name:'ذخیره معلومات'}).click();
  await expect(page.getByRole('row').filter({hasText:'مصرف همزمان'})).toContainText('5');
});

test('stale salary edits are rejected and the current payment can be reopened',async({page})=>{
  await page.goto('/'); await page.getByRole('button',{name:'معاشات',exact:true}).click();
  await page.getByRole('button',{name:'پرداخت معاش جدید'}).click(); let dialog=page.getByRole('dialog');
  await dialog.getByRole('button',{name:'ذخیره معلومات'}).click();
  const row=page.getByRole('row').filter({hasText:'احمد احمدی'}); await row.getByRole('button',{name:'ویرایش'}).click(); dialog=page.getByRole('dialog');
  await dialog.getByLabel('جریمه').fill('100');
  await page.evaluate(async()=>{
    const modulePath=performance.getEntriesByType('resource').map(x=>x.name).find(x=>new URL(x).pathname==='/src/store.ts')!; const {store}=await import(/* @vite-ignore */ modulePath);
    const old=(await store.salaries())[0]; await store.saveSalary(old.id,{...old,notes:'تغییر دیگر'},old);
  });
  await dialog.getByRole('button',{name:'ذخیره معلومات'}).click(); await expect(dialog.getByRole('alert')).toContainText('معاش تغییر کرده');
  await expect(dialog.getByLabel('جریمه')).toHaveValue('100'); await dialog.getByRole('button',{name:'انصراف'}).click();
  await row.getByRole('button',{name:'ویرایش'}).click(); dialog=page.getByRole('dialog'); await expect(dialog.getByLabel('توضیحات')).toHaveValue('تغییر دیگر');
  await dialog.getByLabel('جریمه').fill('100'); await dialog.getByRole('button',{name:'ذخیره معلومات'}).click();
  await expect(row).toContainText('14,900');
});

test('stale customer edits do not overwrite a newer opening balance',async({page})=>{
  await page.goto('/'); await page.getByRole('button',{name:'مشتریان',exact:true}).click();
  const row=page.getByRole('row').filter({hasText:'شرکت ساختمانی امید'}); await row.getByRole('button',{name:'ویرایش'}).click();
  let dialog=page.getByRole('dialog'); await dialog.getByLabel('شماره تماس').fill('0700');
  await page.evaluate(async()=>{
    const modulePath=performance.getEntriesByType('resource').map(x=>x.name).find(x=>new URL(x).pathname==='/src/store.ts')!;const {store}=await import(/* @vite-ignore */ modulePath);
    const old=(await store.snapshot()).customers.find((c:{id:string})=>c.id==='demo-1'); await store.updateCustomer(old.id,{...old,opening:'500'},old);
  });
  await dialog.getByRole('button',{name:'ذخیره معلومات'}).click(); await expect(dialog.getByRole('alert')).toContainText('مشتری تغییر کرده');
  await expect(dialog.getByLabel('شماره تماس')).toHaveValue('0700'); await dialog.getByRole('button',{name:'انصراف'}).click();
  await row.getByRole('button',{name:'ویرایش'}).click(); dialog=page.getByRole('dialog'); await expect(dialog.getByLabel('بدهی اولیه (افغانی)')).toHaveValue('500.00');
  await dialog.getByLabel('شماره تماس').fill('0700'); await dialog.getByRole('button',{name:'ذخیره معلومات'}).click();
  await expect(row).toContainText('42,500');
});

test('stale employee edits preserve form input and reload the current employee',async({page})=>{
  await page.goto('/'); await page.getByRole('button',{name:'کارمندان',exact:true}).click();
  const row=page.getByRole('row').filter({hasText:'احمد احمدی'}); await row.getByRole('button',{name:'ویرایش'}).click();
  let dialog=page.getByRole('dialog'); await dialog.getByLabel('شماره تماس').fill('0700');
  await page.evaluate(async()=>{
    const modulePath=performance.getEntriesByType('resource').map(x=>x.name).find(x=>new URL(x).pathname==='/src/store.ts')!; const {store}=await import(/* @vite-ignore */ modulePath);
    const old=(await store.employees()).find((e:{name:string})=>e.name==='احمد احمدی'); await store.saveEmployee(old.id,{...old,base_salary:'16000'},old);
  });
  await dialog.getByRole('button',{name:'ذخیره معلومات'}).click(); await expect(dialog.getByRole('alert')).toContainText('کارمند تغییر کرده');
  await expect(dialog.getByLabel('شماره تماس')).toHaveValue('0700'); await dialog.getByRole('button',{name:'انصراف'}).click();
  await row.getByRole('button',{name:'ویرایش'}).click(); dialog=page.getByRole('dialog');
  await expect(dialog.getByLabel('معاش پایه (افغانی)')).toHaveValue('16000.00');
  await dialog.getByLabel('شماره تماس').fill('0700'); await dialog.getByRole('button',{name:'ذخیره معلومات'}).click();
  await expect(row).toContainText('16,000');
});

test('stale attendance edits refresh the list without losing typed input',async({page})=>{
  await page.goto('/'); await page.getByRole('button',{name:'حضور و غیاب',exact:true}).click();
  await page.getByRole('button',{name:'ثبت حضور جدید'}).click(); let dialog=page.getByRole('dialog');
  await dialog.getByLabel('تاریخ کار (شمسی)').fill('۱۴۰۴/۰۱/۰۱'); await dialog.getByRole('button',{name:'ذخیره معلومات'}).click();
  const row=page.getByRole('row').filter({hasText:'احمد احمدی'}); await row.getByRole('button',{name:'ویرایش'}).click(); dialog=page.getByRole('dialog');
  await dialog.getByLabel('ملاحظات').fill('تایپ‌شده');
  await page.evaluate(async()=>{
    const modulePath=performance.getEntriesByType('resource').map(x=>x.name).find(x=>new URL(x).pathname==='/src/store.ts')!; const {store}=await import(/* @vite-ignore */ modulePath);
    const old=(await store.attendance())[0]; await store.saveAttendance(old.id,{...old,status:'leave'},old);
  });
  await dialog.getByRole('button',{name:'ذخیره معلومات'}).click(); await expect(dialog.getByRole('alert')).toContainText('رکورد حضور تغییر کرده');
  await expect(dialog.getByLabel('ملاحظات')).toHaveValue('تایپ‌شده'); await dialog.getByRole('button',{name:'انصراف'}).click();
  await expect(row).toContainText('رخصت'); await row.getByRole('button',{name:'ویرایش'}).click(); dialog=page.getByRole('dialog');
  await expect(dialog.getByLabel('وضعیت حضور')).toHaveValue('leave'); await dialog.getByLabel('ملاحظات').fill('تایپ‌شده');
  await dialog.getByRole('button',{name:'ذخیره معلومات'}).click(); await expect(row).toContainText('رخصت');
});
