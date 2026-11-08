import { isValidJalaaliDate, toGregorian, toJalaali } from 'jalaali-js';

export type Calendar = 'shamsi' | 'miladi';
const digits = '۰۱۲۳۴۵۶۷۸۹';
const arabicDigits = '٠١٢٣٤٥٦٧٨٩';
export function normalizeDateDigits(value: string): string {
  return value.replace(/[۰-۹٠-٩]/g, c => String(digits.includes(c) ? digits.indexOf(c) : arabicDigits.indexOf(c)));
}
const pad = (n: number, len = 2) => String(n).padStart(len, '0');
const iso = (y: number, m: number, d: number) => `${pad(y, 4)}-${pad(m)}-${pad(d)}`;
function validGregorian(y: number, m: number, d: number): boolean {
  if (!Number.isInteger(y) || y < 1 || y > 9999 || m < 1 || m > 12 || d < 1) return false;
  const leap = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return d <= days[m - 1];
}

/** Input is in the selected calendar. Output is the canonical Gregorian date. */
export function parseCalendarDate(raw: string, calendar: Calendar): string | null {
  const match = /^(\d{4})([/.\-])(\d{1,2})\2(\d{1,2})$/.exec(normalizeDateDigits(raw.trim()));
  if (!match) return null;
  const year = Number(match[1]), month = Number(match[3]), day = Number(match[4]);
  if (calendar === 'miladi') return validGregorian(year, month, day) ? iso(year, month, day) : null;
  // jalaali-js supports Jalali years -61 through 3177; this application accepts positive years only.
  if (year < 1 || year > 3177 || !isValidJalaaliDate(year, month, day)) return null;
  const { gy, gm, gd } = toGregorian(year, month, day);
  return validGregorian(gy, gm, gd) ? iso(gy, gm, gd) : null;
}

/** Always label fallback values: a date outside the library range is not Shamsi. */
export function displayCalendarDate(value: string, calendar: Calendar): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  const y = Number(match[1]), m = Number(match[2]), d = Number(match[3]);
  if (!validGregorian(y, m, d)) return value;
  if (calendar === 'miladi') return `${pad(y, 4)}/${pad(m)}/${pad(d)}`;
  try {
    const j = toJalaali(y, m, d);
    if (j.jy < 1 || j.jy > 3177) return `${value} (میلادی)`;
    return `${pad(j.jy, 4)}/${pad(j.jm)}/${pad(j.jd)}`;
  } catch { return `${value} (میلادی)`; }
}

/** The existing application uses Asia/Kabul, regardless of the OS time zone. */
export function todayKabul(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kabul', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(p => p.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}
