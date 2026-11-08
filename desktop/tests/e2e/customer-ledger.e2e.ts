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
  await expect(dialog).toContainText('8,100');
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
