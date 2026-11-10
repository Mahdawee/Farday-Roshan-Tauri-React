import {validDate} from './employees';
export const statusLabels={present:'حاضر',absent:'غایب',leave:'رخصت',sick:'مریض',holiday:'رخصتی رسمی',friday:'جمعه'} as const;
export type AttendanceStatus=keyof typeof statusLabels;
export interface AttendanceEntry {status:AttendanceStatus;check_in:string;check_out:string;overtime_hundredths:number;notes:string}
export interface DayRow {employee_id:string;emp_code:string;full_name:string;father_name:string;job_title:string;employee_status:'active'|'inactive';record_id:string|null;revision:number|null;entry:AttendanceEntry|null}
export interface AttendanceChange {employee_id:string;record_id:string|null;revision:number|null;entry:AttendanceEntry|null}
export interface AttendanceStore {day(date:string):Promise<DayRow[]>;save(date:string,changes:AttendanceChange[]):Promise<void>}
export function validateDate(date:string){if(!date||!validDate(date))throw new Error('تاریخ ورق میلادی معتبر نیست.');}
export function validateEntry(e:AttendanceEntry){
  const time=(s:string)=>s===''||/^([01]\d|2[0-3]):[0-5]\d$/.test(s);
  if(!Object.hasOwn(statusLabels,e.status)||!time(e.check_in)||!time(e.check_out)||!Number.isInteger(e.overtime_hundredths)||e.overtime_hundredths<0||e.overtime_hundredths>99999||Array.from(e.notes).length>255)throw new Error('وضعیت، ساعت، اضافه‌کاری یا ملاحظات معتبر نیست.');
}
