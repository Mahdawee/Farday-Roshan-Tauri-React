import {useState} from 'react';
import AttendancePage from './AttendancePage';
import {MonthlyAttendance,SummaryAttendance} from './AttendanceReports';
export default function AttendanceWorkspace({active}:{active:boolean}){
  const [tab,setTab]=useState<'day'|'month'|'summary'>('day');
  return <>
    <nav className="attendance-tabs no-print" aria-label="بخش‌های حضور"><button className={tab==='day'?'primary':'secondary'} onClick={()=>setTab('day')}>ورق روزانه</button><button className={tab==='month'?'primary':'secondary'} onClick={()=>setTab('month')}>نمای ماهانه</button><button className={tab==='summary'?'primary':'secondary'} onClick={()=>setTab('summary')}>راپور حضور</button></nav>
    <div hidden={tab!=='day'}><AttendancePage active={active&&tab==='day'}/></div><div hidden={tab!=='month'}><MonthlyAttendance active={active&&tab==='month'}/></div><div hidden={tab!=='summary'}><SummaryAttendance active={active&&tab==='summary'}/></div>
  </>;
}
