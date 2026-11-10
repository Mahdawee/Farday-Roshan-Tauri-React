import {useEffect,useState} from 'react';
import {RefreshCw,Save} from 'lucide-react';
import {formatMoney,parseMoney} from './customers';
import {statusLabels,validateDate,validateEntry} from './attendance';
import type {AttendanceChange,AttendanceEntry,AttendanceStatus,DayRow} from './attendance';
import {attendanceStore} from './attendanceStore';

type Draft={status:AttendanceStatus|'';check_in:string;check_out:string;overtime:string;notes:string};
const localToday=()=>{const d=new Date();return `${d.getFullYear().toString().padStart(4,'0')}-${(d.getMonth()+1).toString().padStart(2,'0')}-${d.getDate().toString().padStart(2,'0')}`;};
const draftFor=(r:DayRow):Draft=>r.entry?{...r.entry,overtime:formatMoney(String(r.entry.overtime_hundredths))}:{status:'',check_in:'',check_out:'',overtime:'0',notes:''};
export default function AttendancePage({active}:{active:boolean}){
  const [date,setDate]=useState(localToday),[loadedDate,setLoadedDate]=useState(''),[rows,setRows]=useState<DayRow[]|null>(null),[draft,setDraft]=useState<Record<string,Draft>>({}),[dirty,setDirty]=useState<Set<string>>(new Set());
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const load=async(day:string)=>{validateDate(day);const data=await attendanceStore.day(day);setRows(data);setDraft(Object.fromEntries(data.map(r=>[r.employee_id,draftFor(r)])));setDirty(new Set());setLoadedDate(day);};
  useEffect(()=>{if(active&&dirty.size===0){setBusy(true);load(date).catch(e=>setError(String(e))).finally(()=>setBusy(false));}},[active]);
  const change=(id:string,patch:Partial<Draft>)=>{setDraft(prev=>({...prev,[id]:{...prev[id],...patch}}));setDirty(prev=>new Set(prev).add(id));setNotice('');};
  const refresh=async()=>{if(dirty.size&&!window.confirm('تغییرات ذخیره‌نشده پاک و ورق دوباره خوانده شود؟'))return;setBusy(true);setError('');setNotice('');try{await load(date);setNotice('ورق خوانده شد.');}catch(e){setError(String(e));}finally{setBusy(false);}};
  const save=async()=>{
    if(!rows||busy)return;
    setBusy(true);setError('');setNotice('');
    try {
      if(date!==loadedDate)throw new Error('ابتدا تاریخ انتخاب‌شده را نمایش دهید یا تاریخ را به تاریخ ورق برگردانید.');
      const changes:AttendanceChange[]=[];
      for(const row of rows){if(!dirty.has(row.employee_id))continue;const d=draft[row.employee_id];
        if(!d.status){if(row.revision!==null)changes.push({employee_id:row.employee_id,record_id:row.record_id,revision:row.revision,entry:null});continue;}
        const minor=parseMoney(d.overtime,'اضافه‌کاری');if(BigInt(minor)<0n||BigInt(minor)>99999n)throw new Error('اضافه‌کاری باید بین صفر و ۹۹۹٫۹۹ ساعت باشد.');
        const entry:AttendanceEntry={status:d.status,check_in:d.check_in,check_out:d.check_out,overtime_hundredths:Number(minor),notes:d.notes};validateEntry(entry);changes.push({employee_id:row.employee_id,record_id:row.record_id,revision:row.revision,entry});
      }
      if(!changes.length)throw new Error('تغییری برای ذخیره وجود ندارد.');
      await attendanceStore.save(loadedDate,changes);
      try{await load(loadedDate);setNotice(`تغییرات ${changes.length} ردیف ذخیره شد.`);}catch(e){setError(`ذخیره انجام شد اما بازخوانی ناموفق بود؛ قبل از تلاش دوباره ورق را بخوانید. ${String(e)}`);}
    }catch(e){setError(String(e));}finally{setBusy(false);}
  };
  const setAll=(status:AttendanceStatus)=>{if(!rows)return;setDraft(prev=>{const next={...prev};for(const r of rows)next[r.employee_id]={...next[r.employee_id],status};return next;});setDirty(new Set(rows.map(r=>r.employee_id)));setNotice('');};
  return <>
    {error&&<div role="alert" className="alert error no-print">{error}</div>}{notice&&<div role="status" className="alert success no-print">{notice}</div>}
    <section className="panel"><div className="panel-head"><div><h2>ورق روزانهٔ حضور</h2><p>تاریخ نمایش‌داده‌شده: <span dir="ltr">{loadedDate||'—'}</span> · ثبت‌شده: {rows?.filter(r=>r.entry).length??'—'} از {rows?.length??'—'}</p></div></div>
      <p className="muted">فقط ردیف‌های تغییرکرده ذخیره می‌شوند؛ «ثبت نشده» حضور یا غیبت محسوب نمی‌شود. کارمندان فعال و کارمندان غیرفعال دارای ثبت در همین روز نشان داده می‌شوند. ساعت‌ها و تاریخ میلادی‌اند. تغییرات این صفحه ثبت هویت یا تاریخچهٔ محافظت‌شده ندارند.</p>
      <div className="attendance-toolbar no-print"><label>تاریخ ورق میلادی<input type="date" min="0001-01-01" max="9999-12-31" value={date} onChange={e=>setDate(e.target.value)}/></label><button className="secondary" disabled={busy} onClick={()=>void refresh()}><RefreshCw size={15}/> نمایش ورق</button><button disabled={busy||!rows?.length} onClick={()=>setAll('present')}>همه حاضر</button><button disabled={busy||!rows?.length} onClick={()=>setAll('holiday')}>همه رخصتی رسمی</button></div>
      {dirty.size>0&&<p className="muted no-print">{dirty.size} ردیف تغییر کرده و هنوز ذخیره نشده است.</p>}
      {rows===null?<p>ورق هنوز خوانده نشده است.</p>:<div className="table-wrap"><table className="attendance-table"><thead><tr><th>کد</th><th>نام</th><th>نام پدر</th><th>وظیفه</th><th>وضعیت حضور</th><th>ورود</th><th>خروج</th><th>اضافه‌کاری (ساعت)</th><th>ملاحظات</th></tr></thead><tbody>{rows.map(r=>{const d=draft[r.employee_id];return <tr key={r.employee_id}><td>{r.emp_code}</td><td>{r.full_name}{r.employee_status==='inactive'?' (غیرفعال)':''}</td><td>{r.father_name||'—'}</td><td>{r.job_title||'—'}</td><td><select aria-label={`وضعیت حضور ${r.emp_code}`} value={d.status} disabled={busy} onChange={e=>change(r.employee_id,{status:e.target.value as Draft['status']})}><option value="">ثبت نشده / پاک کردن</option>{Object.entries(statusLabels).map(([v,t])=><option key={v} value={v}>{t}</option>)}</select></td><td><input aria-label={`ورود ${r.emp_code}`} type="time" disabled={busy||!d.status} value={d.check_in} onChange={e=>change(r.employee_id,{check_in:e.target.value})}/></td><td><input aria-label={`خروج ${r.emp_code}`} type="time" disabled={busy||!d.status} value={d.check_out} onChange={e=>change(r.employee_id,{check_out:e.target.value})}/></td><td><input aria-label={`اضافه کاری ${r.emp_code}`} inputMode="decimal" disabled={busy||!d.status} value={d.overtime} onChange={e=>change(r.employee_id,{overtime:e.target.value})}/></td><td><input aria-label={`ملاحظات ${r.emp_code}`} maxLength={255} disabled={busy||!d.status} value={d.notes} onChange={e=>change(r.employee_id,{notes:e.target.value})}/></td></tr>;})}</tbody></table>{rows.length===0&&<p className="empty">کارمند فعالی یا سابقه‌ای برای این روز وجود ندارد.</p>}</div>}
      <div className="actions no-print"><button className="primary" disabled={busy||dirty.size===0} onClick={()=>void save()}><Save size={16}/> ذخیرهٔ تغییرات ورق</button></div>
    </section>
  </>;
}
