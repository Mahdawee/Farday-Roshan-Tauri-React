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
