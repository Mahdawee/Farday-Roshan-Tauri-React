import {useEffect,useState} from 'react';
import type {FormEvent} from 'react';
import {Save,Trash2,RefreshCw} from 'lucide-react';
import {blankCustomer,formatMoney,parseMoney,validateCustomer} from './customers';
import type {Customer,CustomerInput} from './customers';
import {customerStore} from './customerStore';

type TextKey=Exclude<keyof CustomerInput,'opening_balance_minor'>;
const fields:[TextKey,string,number][]=[['code','کد مشتری',20],['name','نام مشتری / شرکت',160],['contact_person','شخص رابط',120],['phone','شماره تماس مشتری',40],['vehicle_plate','پلیت موتر',40],['address','آدرس مشتری',255],['notes','توضیحات مشتری',10000]];
export default function Customers(){
  const [items,setItems]=useState<Customer[]|null>(null),[form,setForm]=useState<CustomerInput>({...blankCustomer}),[editing,setEditing]=useState<Customer|null>(null),[money,setMoney]=useState('0');
  const [query,setQuery]=useState(''),[page,setPage]=useState(1),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const load=async()=>setItems(await customerStore.list());
  useEffect(()=>{load().catch(e=>setError(String(e)));},[]);
  const reset=()=>{setForm({...blankCustomer});setEditing(null);setMoney('0');};
  const run=async(fn:()=>Promise<void>,message:string)=>{if(busy)return;setBusy(true);setError('');setNotice('');try{await fn();await load();setNotice(message);}catch(e){setError(String(e));}finally{setBusy(false);}};
  const submit=(e:FormEvent)=>{e.preventDefault();void run(async()=>{const input={...form,opening_balance_minor:parseMoney(money)};validateCustomer(input);await customerStore.save(editing?.id??null,editing?.revision??null,input);reset();},'مشتری ذخیره شد.');};
  const edit=(c:Customer)=>{setEditing(c);setForm({code:c.code,name:c.name,contact_person:c.contact_person,phone:c.phone,vehicle_plate:c.vehicle_plate,opening_balance_minor:c.opening_balance_minor,address:c.address,notes:c.notes});setMoney(formatMoney(c.opening_balance_minor));setNotice('');setError('');};
  const remove=(c:Customer)=>{if(window.confirm(`مشتری «${c.name}» حذف شود؟`))void run(async()=>{await customerStore.delete(c.id,c.revision);if(editing?.id===c.id)reset();},'مشتری حذف شد.');};
  const filtered=(items??[]).filter(c=>[c.code,c.name,c.contact_person,c.phone,c.vehicle_plate,c.address].some(x=>x.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())));
  const pages=Math.max(1,Math.ceil(filtered.length/25));const current=Math.min(page,pages);
  return <>
    {error&&<div className="alert error no-print" role="alert">{error}</div>}{notice&&<div className="alert success no-print" role="status">{notice}</div>}
    <section className="panel"><div className="panel-head"><div><h2>فهرست مشتریان</h2><p>تعداد: {items?.length??'—'} · ماندهٔ اولیه، ماندهٔ جاری حساب نیست.</p></div><button className="secondary no-print" disabled={busy} onClick={()=>{if(window.confirm('فهرست دوباره خوانده شود؟ فرم ویرایش پاک می‌شود.'))void run(async()=>reset(),'فهرست تازه خوانده شد.');}}><RefreshCw size={15}/> خواندن دوباره</button></div>
      <p className="muted">فروش آزمایشی ساخته شده است، اما رسید، کارت حساب و محاسبهٔ بدهی جاری هنوز ساخته نشده‌اند. برای جلوگیری از ارقام گمراه‌کننده در این صفحه نمایش داده نمی‌شوند.</p>
      <label className="search no-print">جستجوی مشتری<input value={query} onChange={e=>{setQuery(e.target.value);setPage(1);}} placeholder="کد، نام، رابط، تماس، پلیت یا آدرس"/></label>
      {items===null?<p>فهرست هنوز خوانده نشده است.</p>:<><div className="table-wrap"><table><thead><tr><th>کد</th><th>نام مشتری / شرکت</th><th>شخص رابط</th><th>تماس</th><th>پلیت</th><th>بدهی اولیه (افغانی)</th><th>آدرس</th><th>توضیحات</th><th className="no-print">عملیات</th></tr></thead><tbody>{filtered.slice((current-1)*25,current*25).map(c=><tr key={c.id}><td>{c.code}</td><td>{c.name}</td><td>{c.contact_person||'—'}</td><td>{c.phone||'—'}</td><td>{c.vehicle_plate||'—'}</td><td dir="ltr">{formatMoney(c.opening_balance_minor)}</td><td>{c.address||'—'}</td><td>{c.notes||'—'}</td><td className="no-print"><button disabled={busy} onClick={()=>edit(c)}>ویرایش</button> <button className="danger" disabled={busy} onClick={()=>remove(c)}><Trash2 size={14}/> حذف</button></td></tr>)}</tbody></table>{filtered.length===0&&<p className="empty">مشتری یافت نشد.</p>}</div><div className="pagination no-print"><button disabled={current<=1} onClick={()=>setPage(current-1)}>صفحهٔ قبل</button><span>صفحهٔ {current} از {pages} · {filtered.length} نتیجه</span><button disabled={current>=pages} onClick={()=>setPage(current+1)}>صفحهٔ بعد</button></div></>}
    </section>
    <section className="panel no-print"><div className="panel-head"><div><h2>{editing?'ویرایش مشتری':'ثبت مشتری جدید'}</h2><p>کد مشتری را فعلاً به صورت دستی و یکتا وارد کنید.</p></div></div><form onSubmit={submit}><div className="form-grid">{fields.map(([key,label,max])=><label key={key} className={key==='notes'?'wide':''}><span>{label}</span>{key==='notes'?<textarea maxLength={max} value={form[key]} onChange={e=>setForm({...form,[key]:e.target.value})}/>:<input required={key==='code'||key==='name'} maxLength={max} value={form[key]} onChange={e=>setForm({...form,[key]:e.target.value})}/>}</label>)}<label><span>باقی مانده بدهی اولیه (افغانی)</span><input inputMode="decimal" value={money} onChange={e=>setMoney(e.target.value)}/><small>حداکثر دو رقم اعشار؛ ارقام فارسی و عربی پذیرفته می‌شوند.</small></label></div><div className="actions"><button className="primary" disabled={busy}><Save size={16}/>{editing?'ذخیره تغییرات مشتری':'ثبت مشتری'}</button>{editing&&<button type="button" className="secondary" onClick={reset}>انصراف</button>}</div></form></section>
  </>;
}
