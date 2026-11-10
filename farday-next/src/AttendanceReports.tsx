import {useEffect,useState} from 'react';
import {RefreshCw} from 'lucide-react';
import {daysInMonth,statusLabels,validateRange} from './attendance';
import type {AttendanceStatus,MonthReport,SummaryRow} from './attendance';
import {attendanceStore} from './attendanceStore';
import {formatMoney} from './customers';

const today=()=>{const d=new Date();return `${String(d.getFullYear()).padStart(4,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
const symbols:Record<AttendanceStatus,string>={present:'ح',absent:'غ',leave:'ر',sick:'م',holiday:'ع',friday:'ج'};
const statusKeys=['present','absent','leave','sick','holiday','friday'] as const;
export function MonthlyAttendance({active}:{active:boolean}){
  const [selected,setSelected]=useState(()=>today().slice(0,7)),[report,setReport]=useState<MonthReport|null>(null),[employee,setEmployee]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const load=async()=>{if(busy)return;setBusy(true);setError('');try{if(!/^\d{4}-\d{2}$/.test(selected))throw new Error('سال و ماه میلادی معتبر نیست.');const [y,m]=selected.split('-').map(Number);daysInMonth(y,m);setReport(await attendanceStore.month(y,m));setEmployee('');}catch(e){setError(String(e));}finally{setBusy(false);}};
  useEffect(()=>{if(active)void load();},[active]);
  const rows=(report?.rows??[]).filter(r=>!employee||r.employee_id===employee);
  return <>
    {error&&<div role="alert" className="alert error no-print">{error}</div>}
    <section className="panel"><div className="panel-head"><div><h2>نمای ماهانهٔ حضور</h2><p>ماه نمایش‌داده‌شده: <span dir="ltr">{report?`${String(report.year).padStart(4,'0')}-${String(report.month).padStart(2,'0')}`:'—'}</span> میلادی</p></div></div>
      <p className="muted">فقط اطلاعات ذخیره‌شده گزارش می‌شود؛ تغییرات ذخیره‌نشدهٔ ورق شامل نیست. همهٔ کارمندان، حتی غیرفعال‌ها، نمایش داده می‌شوند. «ثبت نشده» غیبت محسوب نمی‌شود؛ روزهای قبل از استخدام نیز در شمار ثبت‌نشده‌اند. ح: حاضر، غ: غایب، ر: رخصت، م: مریض، ع: رخصتی رسمی، ج: جمعه.</p>
      <div className="attendance-toolbar no-print"><label>ماه میلادی<input type="month" min="0001-01" max="9999-12" value={selected} onChange={e=>setSelected(e.target.value)}/></label><button className="secondary" disabled={busy} onClick={()=>void load()}><RefreshCw size={15}/> نمایش ماه</button><label>کارمند ماهانه<select value={employee} onChange={e=>setEmployee(e.target.value)}><option value="">همه</option>{report?.rows.map(r=><option key={r.employee_id} value={r.employee_id}>{r.emp_code} — {r.full_name}</option>)}</select></label></div>
      {!report?<p>ماه هنوز خوانده نشده است.</p>:<div className="table-wrap"><table className="month-table"><thead><tr><th>کد</th><th>نام</th><th>وظیفه</th>{Array.from({length:report.days},(_,i)=><th key={i}>{i+1}</th>)}{statusKeys.map(k=><th key={k}>{statusLabels[k]}</th>)}<th>ثبت نشده</th><th>اضافه‌کاری</th></tr></thead><tbody>{rows.map(r=>{const counts=Object.fromEntries(statusKeys.map(k=>[k,r.cells.filter(c=>c?.status===k).length])) as Record<AttendanceStatus,number>;const missing=r.cells.filter(c=>!c).length;const overtime=r.cells.reduce((sum,c)=>sum+BigInt(c?.overtime_hundredths??0),0n);return <tr key={r.employee_id}><td>{r.emp_code}</td><td>{r.full_name}{r.employee_status==='inactive'?' (غیرفعال)':''}</td><td>{r.job_title||'—'}</td>{r.cells.map((c,i)=><td key={i} title={`${i+1}: ${c?statusLabels[c.status]:'ثبت نشده'}`}>{c?symbols[c.status]:'—'}</td>)}{statusKeys.map(k=><td key={k}>{counts[k]}</td>)}<td>{missing}</td><td dir="ltr">{formatMoney(overtime.toString())}</td></tr>;})}</tbody></table>{rows.length===0&&<p className="empty">کارمندی برای نمایش وجود ندارد.</p>}</div>}
    </section>
  </>;
}
export function SummaryAttendance({active}:{active:boolean}){
  const [from,setFrom]=useState(()=>today().slice(0,8)+'01'),[to,setTo]=useState(today),[shown,setShown]=useState<{from:string;to:string;rows:SummaryRow[]}|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const load=async()=>{if(busy)return;setBusy(true);setError('');try{validateRange(from,to);setShown({from,to,rows:await attendanceStore.summary(from,to)});}catch(e){setError(String(e));}finally{setBusy(false);}};
  useEffect(()=>{if(active)void load();},[active]);
  const totals=(shown?.rows??[]).reduce((s,r)=>({present:s.present+r.present,absent:s.absent+r.absent,leave_count:s.leave_count+r.leave_count,sick:s.sick+r.sick,holiday:s.holiday+r.holiday,friday:s.friday+r.friday,overtime:s.overtime+BigInt(r.overtime_hundredths)}),{present:0,absent:0,leave_count:0,sick:0,holiday:0,friday:0,overtime:0n});
  return <>
    {error&&<div role="alert" className="alert error no-print">{error}</div>}
    <section className="panel"><div className="panel-head"><div><h2>راپور بازه‌ای حضور</h2><p>بازهٔ نمایش‌داده‌شده: <span dir="ltr">{shown?`${shown.from} — ${shown.to}`:'—'}</span> میلادی</p></div></div>
      <p className="muted">فقط اطلاعات ذخیره‌شده گزارش می‌شود. بازه شامل هر دو تاریخ و حداکثر ۳۶۶۰ روز است؛ فقط کارمندان دارای ثبت در بازه نشان داده می‌شوند. جمعه جدا از رخصتی رسمی است؛ روزهای ثبت‌نشده در این گزارش غایب شمرده نمی‌شوند.</p>
      <div className="attendance-toolbar no-print"><label>از تاریخ میلادی<input type="date" min="0001-01-01" max="9999-12-31" value={from} onChange={e=>setFrom(e.target.value)}/></label><label>تا تاریخ میلادی<input type="date" min="0001-01-01" max="9999-12-31" value={to} onChange={e=>setTo(e.target.value)}/></label><button className="secondary" disabled={busy} onClick={()=>void load()}><RefreshCw size={15}/> نمایش راپور</button></div>
      {!shown?<p>راپور هنوز خوانده نشده است.</p>:<div className="table-wrap"><table><thead><tr><th>کد</th><th>نام</th><th>وظیفه</th>{statusKeys.map(k=><th key={k}>{statusLabels[k]}</th>)}<th>اضافه‌کاری (ساعت)</th></tr></thead><tbody>{shown.rows.map(r=><tr key={r.employee_id}><td>{r.emp_code}</td><td>{r.full_name}</td><td>{r.job_title||'—'}</td><td>{r.present}</td><td>{r.absent}</td><td>{r.leave_count}</td><td>{r.sick}</td><td>{r.holiday}</td><td>{r.friday}</td><td dir="ltr">{formatMoney(r.overtime_hundredths)}</td></tr>)}</tbody>{shown.rows.length>0&&<tfoot><tr><th colSpan={3}>مجموع</th><th>{totals.present}</th><th>{totals.absent}</th><th>{totals.leave_count}</th><th>{totals.sick}</th><th>{totals.holiday}</th><th>{totals.friday}</th><th dir="ltr">{formatMoney(totals.overtime.toString())}</th></tr></tfoot>}</table>{shown.rows.length===0&&<p className="empty">در این بازه ثبت حضوری وجود ندارد.</p>}</div>}
    </section>
  </>;
}
