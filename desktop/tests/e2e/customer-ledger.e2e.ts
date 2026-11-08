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
