import { Calendar, displayCalendarDate, normalizeDateDigits, parseCalendarDate } from './calendar';
import { Salary, formatScaled, salaryTotal } from './domain';

/** The total is for the displayed rows and includes negative values, not cashflow. */
export function summarizeSalaries(salaries: Salary[], search: string, from: string, to: string, calendar: Calendar, employeeId: string, paymentType: string) {
  const start=from.trim() ? parseCalendarDate(from,calendar) : null;
  const end=to.trim() ? parseCalendarDate(to,calendar) : null;
  if ((from.trim() && !start) || (to.trim() && !end)) throw new Error('تاریخ آغاز یا پایان معتبر نیست.');
  if (start && end && start > end) throw new Error('تاریخ آغاز نباید پس از تاریخ پایان باشد.');
  const query=normalizeDateDigits(search.trim()).toLowerCase();
  const rows=salaries.filter(s => {
    const text=normalizeDateDigits(`${s.employee_name} ${s.employee_code} ${s.payer} ${s.notes} ${s.pay_date} ${displayCalendarDate(s.pay_date,calendar)} ${s.period_year}/${s.period_month}`).toLowerCase();
    return (!start || s.pay_date>=start) && (!end || s.pay_date<=end) && (!employeeId || s.employee_id===employeeId) && (!paymentType || s.payment_type===paymentType) && text.includes(query);
  });
  return { rows, total:formatScaled(rows.reduce((sum,s)=>sum+salaryTotal(s.base,s.bonus,s.fine,s.overtime),0n)) };
}
