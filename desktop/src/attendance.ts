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
