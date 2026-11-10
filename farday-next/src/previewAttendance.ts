import type {AttendanceEntry} from './attendance';
export type PreviewRecords=Map<string,Map<string,{record_id:string;revision:number;entry:AttendanceEntry}>>;
export const previewRecords:PreviewRecords=new Map();
export const hasPreviewAttendance=(id:string)=>Array.from(previewRecords.values()).some(day=>day.has(id));
