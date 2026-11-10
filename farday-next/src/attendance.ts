import {validDate} from './employees';
export const statusLabels={present:'حاضر',absent:'غایب',leave:'رخصت',sick:'مریض',holiday:'رخصتی رسمی',friday:'جمعه'} as const;
export type AttendanceStatus=keyof typeof statusLabels;
export interface AttendanceEntry {status:AttendanceStatus;check_in:string;check_out:string;overtime_hundredths:number;notes:string}
export interface DayRow {employee_id:string;emp_code:string;full_name:string;father_name:string;job_title:string;employee_status:'active'|'inactive';record_id:string|null;revision:number|null;entry:AttendanceEntry|null}
export interface AttendanceChange {employee_id:string;record_id:string|null;revision:number|null;entry:AttendanceEntry|null}
export interface AttendanceStore {day(date:string):Promise<DayRow[]>;save(date:string,changes:AttendanceChange[]):Promise<void>;month(year:number,month:number):Promise<MonthReport>;summary(from:string,to:string):Promise<SummaryRow[]>}
export function validateDate(date:string){if(!date||!validDate(date))throw new Error('تاریخ ورق میلادی معتبر نیست.');}
export function validateEntry(e:AttendanceEntry){
  const time=(s:string)=>s===''||/^([01]\d|2[0-3]):[0-5]\d$/.test(s);
  if(!Object.hasOwn(statusLabels,e.status)||!time(e.check_in)||!time(e.check_out)||!Number.isInteger(e.overtime_hundredths)||e.overtime_hundredths<0||e.overtime_hundredths>99999||Array.from(e.notes).length>255)throw new Error('وضعیت، ساعت، اضافه‌کاری یا ملاحظات معتبر نیست.');
}
export interface MonthCell {status:AttendanceStatus;overtime_hundredths:number}
export interface MonthRow {employee_id:string;emp_code:string;full_name:string;job_title:string;employee_status:'active'|'inactive';cells:(MonthCell|null)[]}
export interface MonthReport {year:number;month:number;days:number;rows:MonthRow[]}
export interface SummaryRow {employee_id:string;emp_code:string;full_name:string;job_title:string;present:number;absent:number;leave_count:number;sick:number;holiday:number;friday:number;overtime_hundredths:string}
export function daysInMonth(year:number,month:number):number {
  if(!Number.isInteger(year)||year<1||year>9999||!Number.isInteger(month)||month<1||month>12)throw new Error('سال یا ماه میلادی معتبر نیست.');
  return [31,year%400===0||(year%4===0&&year%100!==0)?29:28,31,30,31,30,31,31,30,31,30,31][month-1];
}
function ordinal(s:string):number {
  validateDate(s);const [year,month,day]=s.split('-').map(Number),y=year-1;let n=y*365+Math.floor(y/4)-Math.floor(y/100)+Math.floor(y/400)+day;
  for(let m=1;m<month;m++)n+=daysInMonth(year,m);return n;
}
export function validateRange(from:string,to:string):void {const count=ordinal(to)-ordinal(from)+1;if(count<1||count>3660)throw new Error('بازه باید مرتب و حداکثر ۳۶۶۰ روز باشد.');}
