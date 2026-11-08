import { Calendar, displayCalendarDate, normalizeDateDigits, parseCalendarDate } from './calendar';
import { Expense, formatScaled, parseScaled } from './domain';

/** Summarize the filtered list only. Cash and credit are deliberately both included. */
export function summarizeExpenses(expenses: Expense[], search: string, from: string, to: string, calendar: Calendar) {
  const start = from.trim() ? parseCalendarDate(from, calendar) : null;
  const end = to.trim() ? parseCalendarDate(to, calendar) : null;
  if ((from.trim() && !start) || (to.trim() && !end)) throw new Error('تاریخ آغاز یا پایان معتبر نیست.');
  if (start && end && start > end) throw new Error('تاریخ آغاز نباید پس از تاریخ پایان باشد.');
  const query = normalizeDateDigits(search.trim()).toLowerCase();
  const rows = expenses.filter(e => {
    const text = normalizeDateDigits(`${e.date} ${displayCalendarDate(e.date, calendar)} ${e.description} ${e.expense_type} ${e.purchase_bill_no} ${e.shop_name} ${e.payer} ${e.notes}`).toLowerCase();
    return (!start || e.date >= start) && (!end || e.date <= end) && text.includes(query);
  });
  const afn = rows.reduce((sum, e) => sum + parseScaled(e.amount_afn, 2), 0n);
  const usd = rows.reduce((sum, e) => sum + parseScaled(e.amount_usd, 2), 0n);
  return { rows, afn: formatScaled(afn), usd: formatScaled(usd) };
}
