import { Calendar, displayCalendarDate, normalizeDateDigits, parseCalendarDate } from './calendar';
import { Attendance, AttendanceStatus, formatScaled, parseScaled } from './domain';

export const attendanceLabels: Record<AttendanceStatus,string> = { present:'حاضر', absent:'غایب', leave:'رخصت', sick:'مریض', holiday:'رخصتی رسمی', friday:'جمعه' };

/** Counts only recorded rows; missing days are never assumed absent or present. */
export function summarizeAttendance(records: Attendance[], search: string, from: string, to: string, calendar: Calendar, employeeId: string, status: string) {
  const start=from.trim() ? parseCalendarDate(from,calendar) : null;
  const end=to.trim() ? parseCalendarDate(to,calendar) : null;
  if ((from.trim() && !start) || (to.trim() && !end)) throw new Error('تاریخ آغاز یا پایان معتبر نیست.');
  if (start && end && start>end) throw new Error('تاریخ آغاز نباید پس از تاریخ پایان باشد.');
  const query=normalizeDateDigits(search.trim()).toLowerCase();
  const rows=records.filter(a=>{
    const text=normalizeDateDigits(`${a.employee_name} ${a.employee_code} ${a.work_date} ${displayCalendarDate(a.work_date,calendar)} ${attendanceLabels[a.status]} ${a.notes}`).toLowerCase();
    return (!start || a.work_date>=start) && (!end || a.work_date<=end) && (!employeeId || a.employee_id===employeeId) && (!status || a.status===status) && text.includes(query);
  });
  const counts:Record<AttendanceStatus,number>={present:0,absent:0,leave:0,sick:0,holiday:0,friday:0};
  for (const row of rows) counts[row.status]++;
  return {rows,counts,overtime:formatScaled(rows.reduce((sum,a)=>sum+parseScaled(a.overtime,2),0n))};
}

/** Month boundaries are inclusive and use the selected calendar; missing records stay missing. */
export function monthlyAttendance(records: Attendance[], staff: import('./domain').Employee[], rawMonth: string, calendar: Calendar) {
  const month=normalizeDateDigits(rawMonth.trim());
  if (!/^\d{4}\/\d{2}$/.test(month)) throw new Error('ماه را به شکل سال/ماه وارد کنید.');
  const from=parseCalendarDate(`${month}/01`,calendar);
  let to: string | null=null;
  for (let day=31;day>=28;day--) { to=parseCalendarDate(`${month}/${day}`,calendar); if (to) break; }
  if (!from || !to) throw new Error('ماه انتخاب‌شده معتبر نیست.');
  const grouped=new Map<string,Attendance[]>();
  for (const row of records) if (row.work_date>=from && row.work_date<=to) { const list=grouped.get(row.employee_id) ?? []; list.push(row); grouped.set(row.employee_id,list); }
  const rows=staff.map(employee=>{
    const data=grouped.get(employee.id) ?? [];
    const counts:Record<AttendanceStatus,number>={present:0,absent:0,leave:0,sick:0,holiday:0,friday:0};
    for (const item of data) counts[item.status]++;
    return {employee,counts,recorded:data.length,overtime:formatScaled(data.reduce((sum,item)=>sum+parseScaled(item.overtime,2),0n))};
  });
  return {from,to,rows};
}
