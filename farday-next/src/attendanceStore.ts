import {invoke} from '@tauri-apps/api/core';
import {inDesktop} from './store';
import {employeeStore} from './employeeStore';
import type {EmployeeStore} from './employees';
import {daysInMonth,validateDate,validateEntry,validateRange} from './attendance';
import type {AttendanceStore,DayRow,MonthReport,SummaryRow} from './attendance';
import {previewRecords} from './previewAttendance';
import type {PreviewRecords} from './previewAttendance';
const stale='ورق تغییر کرده یا کارمند دیگر وجود ندارد؛ ورق را دوباره بخوانید.';
const native:AttendanceStore={day:(workDate)=>invoke('attendance_day',{workDate}),save:(workDate,changes)=>invoke('save_attendance',{workDate,changes}),month:(year,month)=>invoke('attendance_month',{year,month}),summary:(from,to)=>invoke('attendance_summary',{from,to})};
export function createAttendancePreviewStore(employees:EmployeeStore,records:PreviewRecords=new Map()):AttendanceStore {
  return {
    async day(date){validateDate(date);const list=await employees.list();const saved=records.get(date);return list.filter(e=>e.status==='active'||saved?.has(e.id)).map(e=>{const row=saved?.get(e.id);return {employee_id:e.id,emp_code:e.emp_code,full_name:e.full_name,father_name:e.father_name,job_title:e.job_title,employee_status:e.status,record_id:row?.record_id??null,revision:row?.revision??null,entry:row?structuredClone(row.entry):null} satisfies DayRow;});},
    async month(year,month){const days=daysInMonth(year,month);const list=await employees.list();const prefix=`${String(year).padStart(4,'0')}-${String(month).padStart(2,'0')}-`;
      const rows=list.slice().sort((a,b)=>a.emp_code.toLowerCase().localeCompare(b.emp_code.toLowerCase())||a.id.localeCompare(b.id)).map(e=>({employee_id:e.id,emp_code:e.emp_code,full_name:e.full_name,job_title:e.job_title,employee_status:e.status,cells:Array.from({length:days},(_,i)=>{const d=records.get(`${prefix}${String(i+1).padStart(2,'0')}`)?.get(e.id);return d?{status:d.entry.status,overtime_hundredths:d.entry.overtime_hundredths}:null;})}));return {year,month,days,rows} satisfies MonthReport;},
    async summary(from,to){validateRange(from,to);const list=await employees.list();const rows:SummaryRow[]=[];
      for(const e of list){const row:SummaryRow={employee_id:e.id,emp_code:e.emp_code,full_name:e.full_name,job_title:e.job_title,present:0,absent:0,leave_count:0,sick:0,holiday:0,friday:0,overtime_hundredths:'0'};let n=0,overtime=0n;
        for(const [day,values] of records){if(day<from||day>to)continue;const a=values.get(e.id);if(!a)continue;n++;const key=a.entry.status==='leave'?'leave_count':a.entry.status;row[key]++;overtime+=BigInt(a.entry.overtime_hundredths);}
        if(n){row.overtime_hundredths=overtime.toString();rows.push(row);}}
      return rows.sort((a,b)=>a.full_name.localeCompare(b.full_name)||a.employee_id.localeCompare(b.employee_id));},
    async save(date,changes){validateDate(date);if(changes.length===0||changes.length>10000)throw new Error('تغییری برای ذخیره وجود ندارد یا تعداد ردیف‌ها بیش از حد است.');const seen=new Set<string>();
      for(const c of changes){if(!c.employee_id||c.employee_id.length>64||seen.has(c.employee_id)||(c.revision!==null&&(!Number.isInteger(c.revision)||c.revision<1))||(c.record_id!==null&&(!c.record_id||c.record_id.length>64))||((c.record_id===null)!==(c.revision===null))||(c.revision===null&&c.entry===null))throw new Error('ردیف حضور نامعتبر یا تکراری است.');seen.add(c.employee_id);if(c.entry)validateEntry(c.entry);}
      const list=await employees.list();const day=structuredClone(records.get(date)??new Map());
      for(const c of changes){const prior=day.get(c.employee_id);if(c.revision===null){if(prior||!list.some(e=>e.id===c.employee_id&&e.status==='active'))throw new Error(stale);day.set(c.employee_id,{record_id:crypto.randomUUID(),revision:1,entry:{...c.entry!,notes:c.entry!.notes.trim()}});}else {if(!prior||prior.record_id!==c.record_id||prior.revision!==c.revision)throw new Error(stale);if(c.entry)day.set(c.employee_id,{record_id:prior.record_id,revision:prior.revision+1,entry:{...c.entry,notes:c.entry.notes.trim()}});else day.delete(c.employee_id);}}
      records.set(date,day);
    },
  };
}
export const attendanceStore:AttendanceStore=inDesktop?native:createAttendancePreviewStore(employeeStore,previewRecords);
