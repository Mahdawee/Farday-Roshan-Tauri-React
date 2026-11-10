import {test,expect} from '@playwright/test';
test('company and machinery preview workflow and temporary storage',async({page})=>{
  await page.goto('/');await expect(page.getByText('پیش‌نمایش مرورگر موقت است', {exact:false})).toBeVisible();
  await page.getByLabel('نام شرکت').fill('شرکت آزمایشی');await page.getByLabel('تعداد کارمندان').fill('۱۲');await page.getByRole('button',{name:'ذخیره مشخصات شرکت'}).click();await expect(page.getByRole('status')).toContainText('ذخیره شد');
  await page.getByLabel('نام شرکت').fill('ویرایش ذخیره نشده');await page.getByLabel('نوع ماشین').fill('لودر');await page.getByLabel('تعداد ماشین',{exact:true}).fill('۲');await page.getByLabel('ترتیب ماشین').fill('-۱');await page.getByRole('button',{name:'ثبت ماشین',exact:true}).click();await expect(page.locator('tbody:visible')).toContainText('لودر');await expect(page.getByLabel('نام شرکت')).toHaveValue('ویرایش ذخیره نشده');await expect(page.getByText('مجموع ماشین‌ها: 2 عدد')).toBeVisible();
  await page.getByRole('button',{name:'ویرایش'}).click();await page.getByLabel('وضعیت ماشین').selectOption('repair');await page.getByRole('button',{name:'ذخیره تغییرات ماشین'}).click();await expect(page.locator('tbody:visible')).toContainText('تحت ترمیم');
  page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'حذف'}).click();await expect(page.getByText('هنوز ماشینری ثبت نشده است.')).toBeVisible();
  await page.reload();await expect(page.getByLabel('نام شرکت')).toHaveValue('شرکت فردای روشن');
});
test('invalid machinery data does not save',async({page})=>{await page.goto('/');await page.getByLabel('نوع ماشین').fill('جرثقیل');await page.getByLabel('تعداد ماشین',{exact:true}).fill('۰');await page.getByRole('button',{name:'ثبت ماشین',exact:true}).click();await expect(page.getByRole('alert')).toContainText('معلومات ماشینری معتبر نیست');await expect(page.getByText('هنوز ماشینری ثبت نشده است.')).toBeVisible();});
