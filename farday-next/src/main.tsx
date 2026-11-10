import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Building2,Factory,Save,Trash2,RefreshCw,Users} from 'lucide-react';
import {blankMachine,integer,validateCompany,validateMachine} from './company';
import type {Company,Machine,MachineInput,MachineStatus,Snapshot} from './company';
import {inDesktop,store} from './store';
import Customers from './Customers';
import './style.css';

const statusLabels:Record<MachineStatus,string>={active:'فعال',inactive:'غیرفعال',repair:'تحت ترمیم'};
function App(){
  const [view,setView]=useState<'company'|'customers'>('company');
  const [data,setData]=useState<Snapshot|null>(null),[form,setForm]=useState<Company|null>(null);
  const [machine,setMachine]=useState<MachineInput>({...blankMachine});const [editing,setEditing]=useState<Machine|null>(null);
  const [employeesRaw,setEmployeesRaw]=useState('0'),[countRaw,setCountRaw]=useState('1'),[orderRaw,setOrderRaw]=useState('10');
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const load=async()=>{const next=await store.snapshot();setData(next);setForm(next.company);setEmployeesRaw(String(next.company.employees_count));};
  useEffect(()=>{load().catch(e=>setError(String(e)));},[]);
  const action=async(fn:()=>Promise<void>,message:string)=>{if(busy)return;setBusy(true);setError('');setNotice('');try{await fn();await load();setNotice(message);}catch(e){setError(String(e));}finally{setBusy(false);}};
  const saveCompany=(e:React.FormEvent)=>{e.preventDefault();if(!form)return;const {revision,...rest}=form;const input={...rest,employees_count:integer(employeesRaw)};void action(async()=>{validateCompany(input);await store.saveCompany(input,revision);},'مشخصات شرکت ذخیره شد.');};
  const saveMachine=(e:React.FormEvent)=>{e.preventDefault();void action(async()=>{const input={...machine,count:integer(countRaw),sort_order:integer(orderRaw)};validateMachine(input);await store.saveMachine(editing?.id??null,editing?.revision??null,input);setMachine({...blankMachine});setCountRaw('1');setOrderRaw('10');setEditing(null);},'ماشینری ذخیره شد.');};
  const edit=(m:Machine)=>{setEditing(m);setCountRaw(String(m.count));setOrderRaw(String(m.sort_order));setMachine({name:m.name,count:m.count,status:m.status,notes:m.notes,sort_order:m.sort_order});setError('');setNotice('');};
  const remove=(m:Machine)=>{if(window.confirm('این ماشینری حذف شود؟'))void action(()=>store.deleteMachine(m.id,m.revision),'ماشینری حذف شد.');};
  const fields:[keyof Omit<Company,'revision'|'employees_count'>,string,number][]=[['name','نام شرکت',120],['activity_type','نوع فعالیت',120],['address','آدرس',255],['finance_manager','مدیر مالی',120],['supervisor','سرپرست',120],['fiscal_year_note','سال مالی',60],['phone','شماره تماس',60],['email','ایمیل',120],['license_no','شماره جواز',60],['notes','توضیحات',10000]];
  return <div className="app"><aside className="sidebar no-print"><div className="brand"><Building2 size={27}/><div><strong>فردای روشن</strong><small>نسخهٔ جدید · آزمایشی</small></div></div><p className="side-label">فضای کاری</p><nav aria-label="منوی اصلی"><button className={view==='company'?'active':''} onClick={()=>setView('company')}><Factory size={18}/> مشخصات شرکت</button><button className={view==='customers'?'active':''} onClick={()=>setView('customers')}><Users size={18}/> مشتریان</button></nav><p className="sidebar-note">بخش‌های دیگر بر اساس نقشهٔ تطبیق در حال ساخت‌اند.</p></aside>
  <main><header className="top no-print"><div><span>سیستم مدیریت شرکت</span><h1>{view==='company'?'مشخصات شرکت':'مشتریان'}</h1></div><button className="secondary" type="button" onClick={()=>window.print()}>چاپ آزمایشی</button></header>
    <div className="warning" role="note"><b>نسخهٔ در حال ساخت — فقط برای معلومات آزمایشی.</b> {inDesktop?'اطلاعات در دیتابیس جداگانهٔ این نسخه ذخیره می‌شوند.':'پیش‌نمایش مرورگر موقت است و با تازه‌کردن صفحه پاک می‌شود.'} ورود، مجوز کاربران، تاریخچه و پشتیبان هنوز فعال نیستند.</div>
    <div hidden={view!=='company'}>
    {error&&<div className="alert error no-print" role="alert">{error}</div>}{notice&&<div className="alert success no-print" role="status">{notice}</div>}
    {!data||!form?<div className="panel">{error?'خواندن اطلاعات ناموفق بود.':'در حال خواندن اطلاعات...' } <button className="secondary no-print" onClick={()=>void action(async()=>{},'اطلاعات دوباره خوانده شد.')} disabled={busy}>تلاش دوباره</button></div>:<>
    <section className="panel"><div className="panel-head"><div><h2>مشخصات ثابت شرکت</h2><p>فیلدهای شیت مشخصات نسخهٔ قبلی</p></div><button type="button" className="secondary no-print" disabled={busy} onClick={()=>{if(window.confirm('معلومات تازه خوانده شود؟ تغییرات ذخیره‌نشده از بین می‌روند.'))void action(async()=>{setEditing(null);setMachine({...blankMachine});setCountRaw('1');setOrderRaw('10');},'اطلاعات تازه خوانده شد.');}}><RefreshCw size={15}/> خواندن دوباره</button></div>
      <form onSubmit={saveCompany}><div className="form-grid">{fields.map(([key,label,max])=><label key={key} className={key==='notes'?'wide':''}><span>{label}</span>{key==='notes'?<textarea maxLength={max} value={form[key]} onChange={e=>setForm({...form,[key]:e.target.value})}/>:<input required={key==='name'} maxLength={max} value={form[key]} onChange={e=>setForm({...form,[key]:e.target.value})}/>}</label>)}<label><span>تعداد کارمندان</span><input inputMode="numeric" value={employeesRaw} onChange={e=>setEmployeesRaw(e.target.value)}/><small>تعداد ثبت‌شده؛ شمارش خودکار کارمندان هنوز ساخته نشده است.</small></label></div><div className="actions no-print"><button className="primary" disabled={busy}><Save size={16}/> ذخیره مشخصات شرکت</button></div></form>
    </section>
    <section className="panel"><div className="panel-head"><div><h2>انواع و تعداد ماشینری</h2><p>مجموع ماشین‌ها: {data.machines.reduce((n,m)=>n+BigInt(m.count),0n).toString()} عدد</p></div></div><div className="table-wrap"><table><thead><tr><th>نوع ماشین</th><th>تعداد</th><th>وضعیت</th><th>توضیحات</th><th>ترتیب</th><th className="no-print">عملیات</th></tr></thead><tbody>{data.machines.map(m=><tr key={m.id}><td>{m.name}</td><td>{m.count}</td><td>{statusLabels[m.status]}</td><td>{m.notes||'—'}</td><td>{m.sort_order}</td><td className="no-print"><button type="button" disabled={busy} onClick={()=>edit(m)}>ویرایش</button> <button className="danger" type="button" disabled={busy} onClick={()=>remove(m)}><Trash2 size={14}/> حذف</button></td></tr>)}</tbody></table>{data.machines.length===0&&<p className="empty">هنوز ماشینری ثبت نشده است.</p>}</div>
      <form onSubmit={saveMachine} className="machine-form no-print"><h3>{editing?'ویرایش ماشینری':'ثبت ماشینری جدید'}</h3><div className="form-grid"><label><span>نوع ماشین</span><input required maxLength={120} value={machine.name} onChange={e=>setMachine({...machine,name:e.target.value})}/></label><label><span>تعداد ماشین</span><input inputMode="numeric" value={countRaw} onChange={e=>setCountRaw(e.target.value)}/></label><label><span>وضعیت ماشین</span><select value={machine.status} onChange={e=>setMachine({...machine,status:e.target.value as MachineStatus})}>{Object.entries(statusLabels).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label><label><span>توضیحات ماشین</span><input maxLength={255} value={machine.notes} onChange={e=>setMachine({...machine,notes:e.target.value})}/></label><label><span>ترتیب ماشین</span><input inputMode="numeric" value={orderRaw} onChange={e=>setOrderRaw(e.target.value)}/></label></div><div className="actions"><button className="primary" disabled={busy}>{editing?'ذخیره تغییرات ماشین':'ثبت ماشین'}</button>{editing&&<button className="secondary" type="button" onClick={()=>{setEditing(null);setMachine({...blankMachine});setCountRaw('1');setOrderRaw('10');}}>انصراف</button>}</div></form>
    </section></>}
    </div><div hidden={view!=='customers'}><Customers/></div>
    <footer>فردای روشن — پیش‌نمایش مستقل، برای استفادهٔ واقعی آماده نیست.</footer>
  </main></div>;
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
