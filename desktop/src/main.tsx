import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowDownLeft, ArrowLeft, ArrowUpLeft, Box, Building2, Check, ChevronDown, CircleDollarSign, ClipboardList, Clock3, FileBarChart, LayoutDashboard, Menu, Package, Plus, ReceiptText, Search, Settings, ShieldCheck, ShoppingCart, Users, Wallet, X } from 'lucide-react';
import { CustomerInput, displayMoney, Ledger, ReceiptInput, SaleInput, Snapshot, saleTotal, formatScaled } from './domain';
import { inDesktop, store } from './store';
import './style.css';

type Page = 'dashboard' | 'customers' | 'sales' | 'receipts';
type Modal = 'customer' | 'sale' | 'receipt' | null;
const pageTitles: Record<Page, string> = { dashboard: 'داشبورد', customers: 'مشتریان', sales: 'فروشات', receipts: 'رسیدات' };
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const empty: Snapshot = { customers: [], entries: [], credit_sales: '0.00', receipts: '0.00', total_balance: '0.00' };

function App() {
  const [page, setPage] = useState<Page>('dashboard');
  const [snapshot, setSnapshot] = useState<Snapshot>(empty);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState<Modal>(null);
  const [ledgerId, setLedgerId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState('');
  const refresh = async () => { const next = await store.snapshot(); setSnapshot(next); };
  useEffect(() => { refresh().catch(e => setError(String(e))).finally(() => setLoading(false)); }, []);
  const navigate = (p: Page) => { setPage(p); setSearch(''); setMenuOpen(false); };
  const saved = async () => { setModal(null); try { await refresh(); setError(''); setNotice('معلومات با موفقیت ثبت شد.'); window.setTimeout(() => setNotice(''), 3500); } catch (e) { setError(String(e)); } };
  const recent = snapshot.entries.filter(x => (page === 'dashboard' || (page === 'sales' && x.kind === 'sale') || (page === 'receipts' && x.kind === 'receipt')) && `${x.customer_name} ${x.detail} ${x.date}`.includes(search));
  const customers = snapshot.customers.filter(c => `${c.code} ${c.name} ${c.phone}`.toLowerCase().includes(search.toLowerCase()));
  return <div className="app-shell">
    {menuOpen && <button className="scrim" aria-label="بستن منو" onClick={() => setMenuOpen(false)} />}
    <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
      <div className="brand"><div className="brand-mark"><Box size={23} strokeWidth={1.8}/></div><div><strong>فردای روشن</strong><span>سیستم مدیریت شرکت</span></div></div>
      <div className="side-label">فضای کاری</div>
      <nav className="nav" aria-label="منوی اصلی">
        {([[LayoutDashboard, 'داشبورد', 'dashboard'], [Users, 'مشتریان', 'customers'], [ShoppingCart, 'فروشات', 'sales'], [ReceiptText, 'رسیدات', 'receipts']] as const).map(([Icon,label,p]) => <button key={p} className={page === p ? 'active' : ''} onClick={() => navigate(p)}><Icon size={19}/><span>{label}</span>{page === p && <span className="nav-dot"/>}</button>)}
      </nav>
      <div className="side-label section-label">در مراحل بعدی</div>
      <div className="nav pending">{([[Users,'کارمندان'],[Wallet,'مصارف و معاشات'],[FileBarChart,'راپورها'],[Settings,'تنظیمات']] as const).map(([Icon,label]) => <div key={label}><Icon size={18}/><span>{label}</span><small>به‌زودی</small></div>)}</div>
      <div className="side-bottom"><div className="side-status"><span className="status-dot"/><div><b>{inDesktop ? 'نسخهٔ محلی' : 'پیش‌نمایش آزمایشی'}</b><small>{inDesktop ? 'ذخیره روی این دستگاه' : 'اطلاعات موقت مرورگر'}</small></div></div><p>نسخهٔ اولیه · ۰.۱</p></div>
    </aside>
    <div className="workspace">
      <header className="topbar"><div className="top-title"><button className="mobile-menu icon-button" onClick={() => setMenuOpen(true)} aria-label="باز کردن منو"><Menu size={21}/></button><span>فضای کاری</span><span className="crumb">/</span><b>{pageTitles[page]}</b></div><div className="top-meta"><span className="top-date"><Clock3 size={16}/> {new Intl.DateTimeFormat('fa-AF-u-ca-persian', { dateStyle: 'long' }).format(new Date())}</span><div className="avatar">فر</div><div className="user-label"><b>فردای روشن</b><span>نسخهٔ آزمایشی</span></div><ChevronDown size={15}/></div></header>
      <main className="main">
        {!inDesktop && <div className="demo-banner"><ShieldCheck size={18}/><span><b>حالت نمایش:</b> داده‌ها نمونه و موقتی‌اند و با بستن یا تازه‌کردن صفحه از بین می‌روند. برای ذخیرهٔ واقعی باید برنامهٔ دسکتاپ اجرا شود.</span></div>}
        {inDesktop && <div className="demo-banner"><ShieldCheck size={18}/><span><b>نسخهٔ اولیه:</b> هنوز ورود کاربران، پشتیبان‌گیری و انتقال اطلاعات آماده نیستند؛ برای داده‌های واقعی شرکت استفاده نشود.</span></div>}
        {notice && <div className="notice"><Check size={17}/>{notice}</div>}
        {error && <div className="error" role="alert">{error}</div>}
        <div className="page-heading"><div><div className="eyebrow"><span/> مدیریت کسب‌وکار</div><h1>{page === 'dashboard' ? 'سلام، به فردای روشن خوش آمدید' : pageTitles[page]}</h1><p>{page === 'dashboard' ? 'نمایی روشن از فعالیت‌ها و حساب‌های شرکت در یک نگاه.' : page === 'customers' ? 'مشتریان و مانده حساب آن‌ها را در یک جا مدیریت کنید.' : page === 'sales' ? 'فروشات نقدی و قرضه را ثبت و دنبال کنید.' : 'رسیدهای مشتریان و پرداخت‌های دریافتی را ثبت کنید.'}</p></div><div className="heading-actions">{page === 'dashboard' && <button className="btn secondary" onClick={() => setModal('receipt')}><Plus size={17}/> ثبت رسید</button>}<button className="btn primary" onClick={() => setModal(page === 'customers' ? 'customer' : page === 'receipts' ? 'receipt' : 'sale')}><Plus size={18}/>{page === 'customers' ? 'مشتری جدید' : page === 'receipts' ? 'رسید جدید' : 'فروش جدید'}</button></div></div>
        {page === 'dashboard' && <>
          <div className="stats-grid"><Stat icon={<Users/>} label="مجموع مشتریان" value={String(snapshot.customers.length)} unit="مشتری" note="مشتریان ثبت‌شده" color="teal"/><Stat icon={<ShoppingCart/>} label="فروشات قرضه" value={displayMoney(snapshot.credit_sales)} unit="افغانی" note="مجموع تمام دوره‌ها" color="blue"/><Stat icon={<ArrowDownLeft/>} label="رسیدات دریافتی" value={displayMoney(snapshot.receipts)} unit="افغانی" note="شامل تمام منابع رسید" color="green"/><Stat icon={<Wallet/>} label="مانده حساب مشتریان" value={displayMoney(snapshot.total_balance)} unit="افغانی" note="مانده خالص همه مشتریان" color="amber"/></div>
          <div className="content-grid"><section className="panel activity-panel"><div className="panel-head"><div><h2>آخرین فعالیت‌ها</h2><p>آخرین فروشات و رسیدهای ثبت‌شده</p></div><button className="text-button" onClick={() => navigate('sales')}>همه فروشات <ArrowLeft size={15}/></button></div><Entries entries={recent.slice(0,6)} loading={loading}/></section><section className="panel quick-panel"><div className="panel-head"><div><h2>دسترسی سریع</h2><p>کارهای روزانه را سریع‌تر انجام دهید</p></div></div><div className="quick-list"><Quick icon={<Users/>} title="مشتری جدید" text="افزودن به فهرست مشتریان" onClick={() => setModal('customer')}/><Quick icon={<ShoppingCart/>} title="ثبت فروش" text="ایجاد یک فروش جدید" onClick={() => setModal('sale')}/><Quick icon={<ReceiptText/>} title="ثبت رسید" text="ثبت مبلغ دریافتی از مشتری" onClick={() => setModal('receipt')}/></div><div className="quick-note"><Package size={19}/><div><b>یک شروع تازه</b><p>بخش‌های دیگر سیستم در مراحل بعدی اضافه می‌شوند.</p></div></div></section></div>
          <section className="panel customers-panel"><div className="panel-head"><div><h2>مشتریان اخیر</h2><p>نگاهی به حساب مشتریان شما</p></div><button className="text-button" onClick={() => navigate('customers')}>مشاهده مشتریان <ArrowLeft size={15}/></button></div><CustomerTable customers={snapshot.customers.slice(0,5)} loading={loading} openLedger={setLedgerId}/></section>
        </>}
        {page !== 'dashboard' && <section className="panel listing"><div className="panel-head list-header"><div><h2>{page === 'customers' ? 'فهرست مشتریان' : page === 'sales' ? 'فهرست فروشات' : 'فهرست رسیدات'}</h2><p>{page === 'customers' ? `${snapshot.customers.length} مشتری ثبت شده` : 'حداکثر ۱۰۰ فعالیت اخیر نمایش داده می‌شود'}</p></div><label className="search"><Search size={17}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="جستجو..." aria-label="جستجو"/></label></div>{page === 'customers' ? <CustomerTable customers={customers} loading={loading} openLedger={setLedgerId}/> : <Entries entries={recent} loading={loading}/>}</section>}
        <footer><span>© سیستم مدیریت فردای روشن</span><span>ساخته‌شده برای کار بهتر، هر روز.</span></footer>
      </main>
    </div>
    {ledgerId && <LedgerModal customerId={ledgerId} close={() => setLedgerId(null)}/>}
    {modal && <FormModal kind={modal} snapshot={snapshot} close={() => setModal(null)} saved={saved}/>}
  </div>;
}
function Stat({ icon,label,value,unit,note,color }: { icon: React.ReactNode; label: string; value: string; unit: string; note: string; color: string }) { return <div className="stat"><div className="stat-top"><span>{label}</span><div className={`stat-icon ${color}`}>{icon}</div></div><div className="stat-value"><b dir="ltr">{value}</b><span>{unit}</span></div><div className="stat-note"><span className="tiny-dot"/>{note}</div></div>; }
function Quick({icon,title,text,onClick}: {icon:React.ReactNode;title:string;text:string;onClick:()=>void}) { return <button className="quick" onClick={onClick}><span className="quick-icon">{icon}</span><span><b>{title}</b><small>{text}</small></span><ArrowLeft size={17}/></button>; }
function CustomerTable({ customers, loading, openLedger }: { customers: Snapshot['customers']; loading: boolean; openLedger: (id: string) => void }) { return <div className="table-wrap"><table><thead><tr><th>مشتری</th><th>کد مشتری</th><th>شماره تماس</th><th>مانده حساب</th><th>وضعیت</th><th>عملیات</th></tr></thead><tbody>{customers.map((c,i) => <tr key={c.id}><td><div className="person"><span className={`person-avatar p${i%4}`}>{c.name.slice(0,1)}</span><b>{c.name}</b></div></td><td><span className="code" dir="ltr">{c.code}</span></td><td dir="ltr" className="ltr-cell">{c.phone || '—'}</td><td><b dir="ltr">{displayMoney(c.balance)}</b> <span className="unit">افغانی</span></td><td><span className={`badge ${c.balance === '0.00' ? 'good' : c.balance.startsWith('-') ? 'blue-badge' : 'warn'}`}>{c.balance === '0.00' ? 'تصفیه شده' : c.balance.startsWith('-') ? 'بستانکار' : 'دارای مانده'}</span></td><td><button className="text-button" onClick={() => openLedger(c.id)}>کارت حساب <ArrowLeft size={14}/></button></td></tr>)}</tbody></table>{!customers.length && <div className="empty">{loading ? 'در حال بارگذاری...' : 'هنوز مشتری‌ای برای نمایش وجود ندارد.'}</div>}</div>; }
function Entries({ entries,loading }: { entries: Snapshot['entries']; loading:boolean }) { return <div className="table-wrap"><table><thead><tr><th>نوع فعالیت</th><th>مشتری</th><th>شرح</th><th>تاریخ میلادی</th><th>مبلغ</th></tr></thead><tbody>{entries.map(e => <tr key={e.id}><td><div className="activity-type"><span className={`activity-icon ${e.kind}`} >{e.kind === 'sale' ? <ArrowUpLeft size={17}/> : <ArrowDownLeft size={17}/>}</span><b>{e.kind === 'sale' ? 'فروش' : 'رسید'}</b></div></td><td>{e.customer_name}</td><td className="muted">{e.detail}</td><td><span dir="ltr" className="code">{e.date}</span></td><td><b dir="ltr">{displayMoney(e.amount)}</b> <span className="unit">افغانی</span></td></tr>)}</tbody></table>{!entries.length && <div className="empty">{loading ? 'در حال بارگذاری...' : 'هنوز فعالیتی برای نمایش وجود ندارد.'}</div>}</div>; }

function LedgerModal({ customerId, close }: { customerId: string; close: () => void }) {
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    store.ledger(customerId).then(value => { if (active) setLedger(value); }).catch(e => { if (active) setError(String(e)); });
    return () => { active = false; };
  }, [customerId]);
  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) close(); }}>
    <div className="modal ledger-modal" role="dialog" aria-modal="true" aria-labelledby="ledger-title">
      <div className="modal-head"><div><span className="eyebrow"><span/> گزارش حساب</span><h2 id="ledger-title">کارت حساب مشتری</h2><p>{ledger ? `${ledger.customer_name} · ${ledger.customer_code}` : 'در حال بارگذاری...'}</p></div><button className="icon-button" aria-label="بستن" onClick={close}><X size={20}/></button></div>
      {error && <div className="error" role="alert">{error}</div>}
      {ledger && <><div className="ledger-summary"><div><span>بدهی اولیه</span><b>{displayMoney(ledger.opening)} <small>افغانی</small></b></div><div><span>ماندهٔ حساب</span><b>{displayMoney(ledger.balance)} <small>افغانی</small></b></div></div>
        <div className="table-wrap"><table><thead><tr><th>تاریخ میلادی</th><th>شرح</th><th>بدهکار</th><th>بستانکار</th><th>مانده</th></tr></thead><tbody>{ledger.rows.map(row => <tr key={row.id}><td><span dir="ltr" className="code">{row.date}</span></td><td>{row.kind === 'sale' ? 'فروش قرضه' : 'رسید'} · {row.detail}{!row.affects_balance && <span className="ledger-note"> بدون تأثیر بر مانده</span>}</td><td dir="ltr" className="ltr-cell">{row.debit === '0.00' ? '—' : displayMoney(row.debit)}</td><td dir="ltr" className="ltr-cell">{row.credit === '0.00' ? '—' : displayMoney(row.credit)}</td><td><b dir="ltr">{displayMoney(row.balance)}</b></td></tr>)}</tbody></table>{!ledger.rows.length && <div className="empty">هنوز گردش حسابی برای این مشتری ثبت نشده است.</div>}</div>
        <div className="form-hint">فروش نقده در این کارت بدهی وارد نمی‌شود. رسید امانت فقط برای اطلاع نمایش داده می‌شود و از مانده کم نمی‌شود.</div></>}
      <div className="modal-actions"><button className="btn secondary" onClick={close}>بستن</button></div>
    </div>
  </div>;
}

function FormModal({ kind, snapshot, close, saved }: { kind: Exclude<Modal,null>; snapshot:Snapshot; close:()=>void; saved:()=>Promise<void> }) {
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const [customer, setCustomer] = useState<CustomerInput>({ code:'',name:'',phone:'',opening:'0' });
  const [sale, setSale] = useState<SaleInput>({ customer_id:snapshot.customers[0]?.id || '',date:today(),material:'ماسه اول',volume:'',unit_price:'',freight:'0',payment_type:'cash' });
  const [receipt, setReceipt] = useState<ReceiptInput>({ customer_id:snapshot.customers[0]?.id || '',date:today(),amount:'',source:'debt' });
  let total = '—'; try { total = displayMoney(formatScaled(saleTotal(sale.volume, sale.unit_price, sale.freight))); } catch { /* incomplete input */ }
  const submit = async (e:React.FormEvent) => { e.preventDefault(); setError(''); setBusy(true); try { if (kind === 'customer') await store.addCustomer(customer); else if (kind === 'sale') await store.addSale(sale); else await store.addReceipt(receipt); await saved(); } catch(e) { setError(String(e)); } finally { setBusy(false); } };
  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) close(); }}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-head"><div><span className="eyebrow"><span/> ثبت معلومات</span><h2 id="modal-title">{kind === 'customer' ? 'مشتری جدید' : kind === 'sale' ? 'ثبت فروش جدید' : 'ثبت رسید جدید'}</h2><p>لطفاً معلومات زیر را با دقت وارد کنید.</p></div><button className="icon-button" aria-label="بستن" onClick={close}><X size={20}/></button></div><form onSubmit={submit}>
    {error && <div className="error" role="alert">{error}</div>}
    {kind === 'customer' ? <div className="form-grid"><Field label="کد مشتری" required><input required value={customer.code} onChange={e=>setCustomer({...customer,code:e.target.value})} placeholder="مثلاً CUS-001"/></Field><Field label="نام مشتری / شرکت" required><input required value={customer.name} onChange={e=>setCustomer({...customer,name:e.target.value})} placeholder="نام مشتری"/></Field><Field label="شماره تماس"><input value={customer.phone} onChange={e=>setCustomer({...customer,phone:e.target.value})} placeholder="شماره تماس"/></Field><Field label="بدهی اولیه (افغانی)"><input inputMode="decimal" value={customer.opening} onChange={e=>setCustomer({...customer,opening:e.target.value})}/></Field></div> : <>
      {!snapshot.customers.length && <div className="form-hint">ابتدا یک مشتری ثبت کنید.</div>}
      <div className="form-grid"><Field label="مشتری" required><select required value={kind === 'sale' ? sale.customer_id : receipt.customer_id} onChange={e=>kind==='sale'?setSale({...sale,customer_id:e.target.value}):setReceipt({...receipt,customer_id:e.target.value})}><option value="">انتخاب مشتری</option>{snapshot.customers.map(c=><option value={c.id} key={c.id}>{c.name} ({c.code})</option>)}</select></Field><Field label="تاریخ میلادی" required><input type="date" required value={kind === 'sale' ? sale.date : receipt.date} onChange={e=>kind==='sale'?setSale({...sale,date:e.target.value}):setReceipt({...receipt,date:e.target.value})}/></Field>
      {kind === 'sale' ? <><Field label="نوع مواد" required><select value={sale.material} onChange={e=>setSale({...sale,material:e.target.value})}>{['ماسه اول','ماسه دوم','ریگ','سنگ غرقه','خاک','خامه','ماشک','ریگ باد','سنگ پارچاو','چسنی','کانکریت','سی منټ','دیگر'].map(x=><option key={x}>{x}</option>)}</select></Field><Field label="نوع پرداخت"><select value={sale.payment_type} onChange={e=>setSale({...sale,payment_type:e.target.value as SaleInput['payment_type']})}><option value="cash">نقده</option><option value="credit">باقی</option></select></Field><Field label="متراژ (متر مکعب)" required><input required inputMode="decimal" value={sale.volume} onChange={e=>setSale({...sale,volume:e.target.value})} placeholder="مثلاً ۱۰"/></Field><Field label="قیمت فی متر (افغانی)" required><input required inputMode="decimal" value={sale.unit_price} onChange={e=>setSale({...sale,unit_price:e.target.value})} placeholder="۰"/></Field><Field label="کرایه فی متر (افغانی)"><input inputMode="decimal" value={sale.freight} onChange={e=>setSale({...sale,freight:e.target.value})}/></Field><div className="total-box"><span>مجموع فروش</span><b>{total} <small>افغانی</small></b></div></> : <><Field label="مبلغ رسید (افغانی)" required><input required inputMode="decimal" value={receipt.amount} onChange={e=>setReceipt({...receipt,amount:e.target.value})} placeholder="۰"/></Field><Field label="منبع رسید"><select value={receipt.source} onChange={e=>setReceipt({...receipt,source:e.target.value as ReceiptInput['source']})}><option value="debt">باقی داری</option><option value="deposit">امانت (بدون تأثیر بر بدهی)</option><option value="statement">بیانیه</option><option value="advance">پیش پرداخت</option></select></Field></>}
      </div></>}
    <div className="form-hint">{kind === 'sale' ? 'مجموع = متراژ × (قیمت فی متر + کرایه فی متر)' : kind === 'receipt' ? 'رسید امانت از ماندهٔ بدهی مشتری کم نمی‌شود.' : 'ماندهٔ حساب از بدهی اولیه، فروش قرضه و رسیدهای مؤثر محاسبه می‌شود.'}</div><div className="modal-actions"><button type="button" className="btn secondary" onClick={close}>انصراف</button><button type="submit" disabled={busy || (kind !== 'customer' && !snapshot.customers.length)} className="btn primary">{busy ? 'در حال ثبت...' : 'ذخیره معلومات'} <Check size={17}/></button></div>
  </form></div></div>;
}
function Field({label,required,children}:{label:string;required?:boolean;children:React.ReactNode}) { return <label className="field"><span>{label} {required && <i>*</i>}</span>{children}</label>; }

createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
