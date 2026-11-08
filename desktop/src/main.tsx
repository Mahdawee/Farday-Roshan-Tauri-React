import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowDownLeft, ArrowLeft, ArrowUpLeft, Archive, Box, Building2, Check, ChevronDown, CircleDollarSign, ClipboardList, Clock3, FileBarChart, LayoutDashboard, Menu, Package, Plus, ReceiptText, Search, Settings, ShieldCheck, ShoppingCart, Users, Wallet, X } from 'lucide-react';
import { Customer, CustomerInput, Employee, EmployeeInput, Expense, ExpenseInput, Salary, SalaryInput, Attendance, AttendanceInput, AttendanceStatus, TransactionPage, TransactionDetail, RangeSummary, displayMoney, Ledger, ReceiptInput, SaleInput, Snapshot, saleTotal, salaryTotal, formatScaled } from './domain';
import { inDesktop, store } from './store';
import { BackupInfo, chooseBackup, createBackup, restoreBackup, exportRangeCsv } from './backup';
import { attendanceLabels, summarizeAttendance, monthlyAttendance } from './attendance';
import { summarizeSalaries } from './salaries';
import { summarizeExpenses } from './expenses';
import { Calendar, displayCalendarDate, normalizeDateDigits, parseCalendarDate, todayKabul } from './calendar';
import './style.css';

type Page = 'dashboard' | 'customers' | 'sales' | 'receipts' | 'employees' | 'expenses' | 'salaries' | 'attendance' | 'attendance-report' | 'financial-report' | 'backup';
type Modal = 'customer' | 'sale' | 'receipt' | null;
const pageTitles: Record<Page, string> = { dashboard: 'داشبورد', customers: 'مشتریان', sales: 'فروشات', receipts: 'رسیدات', employees: 'کارمندان', expenses: 'مصارف', salaries: 'معاشات', attendance: 'حضور و غیاب', 'attendance-report': 'راپور حضور ماهانه', 'financial-report': 'راپور مالی بازه‌ای', backup: 'پشتیبان‌گیری' };
const empty: Snapshot = { customers: [], entries: [], credit_sales: '0.00', receipts: '0.00', total_balance: '0.00' };

function App() {
  const [page, setPage] = useState<Page>('dashboard');
  const [calendar, setCalendar] = useState<Calendar>('shamsi');
  const [snapshot, setSnapshot] = useState<Snapshot>(empty);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState<Modal>(null);
  const [customerEdit, setCustomerEdit] = useState<Customer | null>(null);
  const editCustomer = (customer: Customer) => { setCustomerEdit(customer); setModal('customer'); };
  const closeModal = () => { setModal(null); setCustomerEdit(null); };
  const [ledgerId, setLedgerId] = useState<string | null>(null);
  const [staff, setStaff] = useState<Employee[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [batchOpen, setBatchOpen] = useState(false);
  const [attendanceModal, setAttendanceModal] = useState<Attendance | 'new' | null>(null);
  const [salaries, setSalaries] = useState<Salary[]>([]);
  const [salaryModal, setSalaryModal] = useState<Salary | 'new' | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [expenseModal, setExpenseModal] = useState<Expense | 'new' | null>(null);
  const [employeeModal, setEmployeeModal] = useState<Employee | 'new' | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState('');
  const refresh = async () => { const [next, employees, expenses, salaries, attendance] = await Promise.all([store.snapshot(), store.employees(), store.expenses(), store.salaries(), store.attendance()]); setSnapshot(next); setStaff(employees); setExpenses(expenses); setSalaries(salaries); setAttendance(attendance); };
  useEffect(() => { refresh().catch(e => setError(String(e))).finally(() => setLoading(false)); }, []);
  const navigate = (p: Page) => { setPage(p); setSearch(''); setMenuOpen(false); };
  const saved = async () => { closeModal(); try { await refresh(); setError(''); setNotice('معلومات با موفقیت ثبت شد.'); window.setTimeout(() => setNotice(''), 3500); } catch (e) { setError(String(e)); } };
  const recent = snapshot.entries;
  const customers = snapshot.customers.filter(c => `${c.code} ${c.name} ${c.phone}`.toLowerCase().includes(search.toLowerCase()));
  return <div className="app-shell">
    {menuOpen && <button className="scrim" aria-label="بستن منو" onClick={() => setMenuOpen(false)} />}
    <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
      <div className="brand"><div className="brand-mark"><Box size={23} strokeWidth={1.8}/></div><div><strong>فردای روشن</strong><span>سیستم مدیریت شرکت</span></div></div>
      <div className="side-label">فضای کاری</div>
      <nav className="nav" aria-label="منوی اصلی">
        {([[LayoutDashboard, 'داشبورد', 'dashboard'], [Users, 'مشتریان', 'customers'], [Users, 'کارمندان', 'employees'], [ClipboardList, 'حضور و غیاب', 'attendance'], [FileBarChart, 'راپور حضور ماهانه', 'attendance-report'], [FileBarChart, 'راپور مالی بازه‌ای', 'financial-report'], [Wallet, 'مصارف', 'expenses'], [CircleDollarSign, 'معاشات', 'salaries'], [ShoppingCart, 'فروشات', 'sales'], [ReceiptText, 'رسیدات', 'receipts'], [Archive, 'پشتیبان‌گیری', 'backup']] as const).map(([Icon,label,p]) => <button key={p} className={page === p ? 'active' : ''} onClick={() => navigate(p)}><Icon size={19}/><span>{label}</span>{page === p && <span className="nav-dot"/>}</button>)}
      </nav>
      <div className="side-label section-label">در مراحل بعدی</div>
      <div className="nav pending">{([[FileBarChart,'راپورها'],[Settings,'تنظیمات']] as const).map(([Icon,label]) => <div key={label}><Icon size={18}/><span>{label}</span><small>به‌زودی</small></div>)}</div>
      <div className="side-bottom"><div className="side-status"><span className="status-dot"/><div><b>{inDesktop ? 'نسخهٔ محلی' : 'پیش‌نمایش آزمایشی'}</b><small>{inDesktop ? 'ذخیره روی این دستگاه' : 'اطلاعات موقت مرورگر'}</small></div></div><p>نسخهٔ اولیه · ۰.۱</p></div>
    </aside>
    <div className="workspace">
      <header className="topbar"><div className="top-title"><button className="mobile-menu icon-button" onClick={() => setMenuOpen(true)} aria-label="باز کردن منو"><Menu size={21}/></button><span>فضای کاری</span><span className="crumb">/</span><b>{pageTitles[page]}</b></div><div className="top-meta"><span className="top-date"><Clock3 size={16}/> {new Intl.DateTimeFormat(calendar === 'shamsi' ? 'fa-AF-u-ca-persian' : 'fa-AF-u-ca-gregory', { dateStyle: 'long', timeZone: 'Asia/Kabul' }).format(new Date())}</span><label className="calendar-control"><span>تقویم</span><select aria-label="تقویم نمایش" value={calendar} onChange={e => setCalendar(e.target.value as Calendar)}><option value="shamsi">شمسی</option><option value="miladi">میلادی</option></select></label><div className="avatar">فر</div><div className="user-label"><b>فردای روشن</b><span>نسخهٔ آزمایشی</span></div><ChevronDown size={15}/></div></header>
      <main className="main">
        {!inDesktop && <div className="demo-banner"><ShieldCheck size={18}/><span><b>حالت نمایش:</b> داده‌ها نمونه و موقتی‌اند و با بستن یا تازه‌کردن صفحه از بین می‌روند. برای ذخیرهٔ واقعی باید برنامهٔ دسکتاپ اجرا شود.</span></div>}
        {inDesktop && <div className="demo-banner"><ShieldCheck size={18}/><span><b>نسخهٔ اولیه:</b> هنوز ورود کاربران و انتقال اطلاعات آماده نیستند؛ بازیابی نیازمند آزمایش بیشتر است؛ برای داده‌های واقعی شرکت استفاده نشود.</span></div>}
        {notice && <div className="notice"><Check size={17}/>{notice}</div>}
        {error && <div className="error" role="alert">{error}</div>}
        <div className="page-heading"><div><div className="eyebrow"><span/> مدیریت کسب‌وکار</div><h1>{page === 'dashboard' ? 'سلام، به فردای روشن خوش آمدید' : pageTitles[page]}</h1><p>{page === 'dashboard' ? 'نمایی روشن از فعالیت‌ها و حساب‌های شرکت در یک نگاه.' : page === 'customers' ? 'مشتریان و مانده حساب آن‌ها را در یک جا مدیریت کنید.' : page === 'employees' ? 'معلومات، وضعیت و معاش پایهٔ کارمندان را مدیریت کنید.' : page === 'attendance' ? 'حضور و غیاب هر کارمند را برای هر روز ثبت کنید.' : page === 'attendance-report' ? 'خلاصهٔ رکوردهای حضور ثبت‌شده در هر ماه را بررسی کنید.' : page === 'financial-report' ? 'جمع عملیات ثبت‌شده را در یک بازهٔ تاریخ بررسی کنید.' : page === 'salaries' ? 'پرداخت‌های معاش و دورهٔ هر کارمند را ثبت و بررسی کنید.' : page === 'expenses' ? 'مصارف افغانی و دالری را جداگانه ثبت و بررسی کنید.' : page === 'sales' ? 'فروشات نقدی و قرضه را ثبت و دنبال کنید.' : page === 'receipts' ? 'رسیدهای مشتریان و پرداخت‌های دریافتی را ثبت کنید.' : 'یک نسخهٔ جداگانه از معلومات محلی تهیه کنید.'}</p></div><div className="heading-actions">{page !== 'backup' && page !== 'attendance-report' && page !== 'financial-report' && <>{page === 'attendance' && <button className="btn secondary" onClick={() => setBatchOpen(true)}><ClipboardList size={17}/> ورق روزانه</button>}{page === 'dashboard' && <button className="btn secondary" onClick={() => setModal('receipt')}><Plus size={17}/> ثبت رسید</button>}<button className="btn primary" onClick={() => page === 'employees' ? setEmployeeModal('new') : page === 'expenses' ? setExpenseModal('new') : page === 'salaries' ? setSalaryModal('new') : page === 'attendance' ? setAttendanceModal('new') : setModal(page === 'customers' ? 'customer' : page === 'receipts' ? 'receipt' : 'sale')}><Plus size={18}/>{page === 'customers' ? 'مشتری جدید' : page === 'employees' ? 'کارمند جدید' : page === 'expenses' ? 'مصرف جدید' : page === 'salaries' ? 'پرداخت معاش جدید' : page === 'attendance' ? 'ثبت حضور جدید' : page === 'receipts' ? 'رسید جدید' : 'فروش جدید'}</button></>}</div></div>
        {page === 'dashboard' && <>
          <div className="stats-grid"><Stat icon={<Users/>} label="مجموع مشتریان" value={String(snapshot.customers.length)} unit="مشتری" note="مشتریان ثبت‌شده" color="teal"/><Stat icon={<ShoppingCart/>} label="فروشات قرضه" value={displayMoney(snapshot.credit_sales)} unit="افغانی" note="مجموع تمام دوره‌ها" color="blue"/><Stat icon={<ArrowDownLeft/>} label="رسیدات دریافتی" value={displayMoney(snapshot.receipts)} unit="افغانی" note="شامل تمام منابع رسید" color="green"/><Stat icon={<Wallet/>} label="مانده حساب مشتریان" value={displayMoney(snapshot.total_balance)} unit="افغانی" note="مانده خالص همه مشتریان" color="amber"/></div>
          <div className="content-grid"><section className="panel activity-panel"><div className="panel-head"><div><h2>آخرین فعالیت‌ها</h2><p>آخرین فروشات و رسیدهای ثبت‌شده</p></div><button className="text-button" onClick={() => navigate('sales')}>همه فروشات <ArrowLeft size={15}/></button></div><Entries entries={recent.slice(0,6)} loading={loading} calendar={calendar}/></section><section className="panel quick-panel"><div className="panel-head"><div><h2>دسترسی سریع</h2><p>کارهای روزانه را سریع‌تر انجام دهید</p></div></div><div className="quick-list"><Quick icon={<Users/>} title="مشتری جدید" text="افزودن به فهرست مشتریان" onClick={() => setModal('customer')}/><Quick icon={<ShoppingCart/>} title="ثبت فروش" text="ایجاد یک فروش جدید" onClick={() => setModal('sale')}/><Quick icon={<ReceiptText/>} title="ثبت رسید" text="ثبت مبلغ دریافتی از مشتری" onClick={() => setModal('receipt')}/></div><div className="quick-note"><Package size={19}/><div><b>یک شروع تازه</b><p>بخش‌های دیگر سیستم در مراحل بعدی اضافه می‌شوند.</p></div></div></section></div>
          <section className="panel customers-panel"><div className="panel-head"><div><h2>مشتریان اخیر</h2><p>نگاهی به حساب مشتریان شما</p></div><button className="text-button" onClick={() => navigate('customers')}>مشاهده مشتریان <ArrowLeft size={15}/></button></div><CustomerTable customers={snapshot.customers.slice(0,5)} loading={loading} openLedger={setLedgerId} edit={editCustomer}/></section>
        </>}
        {page === 'backup' && <BackupPanel onRestored={refresh}/>}
        {page === 'attendance' && <AttendanceList key={calendar} records={attendance} staff={staff} calendar={calendar} loading={loading} edit={setAttendanceModal}/>}
        {page === 'salaries' && <SalaryList key={calendar} salaries={salaries} staff={staff} calendar={calendar} loading={loading} edit={setSalaryModal}/>}
        {page === 'financial-report' && <FinancialReport key={calendar} calendar={calendar}/>}
        {page === 'attendance-report' && <AttendanceReport key={calendar} records={attendance} staff={staff} calendar={calendar} loading={loading}/>}
        {page === 'expenses' && <ExpenseList key={calendar} expenses={expenses} calendar={calendar} loading={loading} edit={setExpenseModal}/>}
        {page === 'employees' && <EmployeeList staff={staff} calendar={calendar} loading={loading} edit={setEmployeeModal}/>}
        {page === 'customers' && <section className="panel listing"><div className="panel-head list-header"><div><h2>فهرست مشتریان</h2><p>{snapshot.customers.length} مشتری ثبت شده</p></div><label className="search"><Search size={17}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="جستجو..." aria-label="جستجو"/></label></div><CustomerTable customers={customers} loading={loading} openLedger={setLedgerId} edit={editCustomer}/></section>}
        {(page === 'sales' || page === 'receipts') && <TransactionList key={`${page}-${calendar}`} kind={page === 'sales' ? 'sale' : 'receipt'} calendar={calendar} revision={snapshot} onChanged={async()=>{try {await refresh(); setNotice('عملیات ویرایش شد.'); window.setTimeout(()=>setNotice(''),3500);} catch(e) {setError(String(e));}}}/>}
        <footer><span>© سیستم مدیریت فردای روشن</span><span>ساخته‌شده برای کار بهتر، هر روز.</span></footer>
      </main>
    </div>
    {batchOpen && <AttendanceBatchModal staff={staff} records={attendance} calendar={calendar} reload={refresh} close={() => setBatchOpen(false)} saved={async () => { setBatchOpen(false); try { await refresh(); setNotice('ورق روزانه ذخیره شد.'); window.setTimeout(() => setNotice(''), 3500); } catch (e) { setError(String(e)); } }}/> }
    {attendanceModal && <AttendanceModal record={attendanceModal} staff={staff} calendar={calendar} close={() => setAttendanceModal(null)} saved={async () => { setAttendanceModal(null); try { await refresh(); setNotice('حضور و غیاب ذخیره شد.'); window.setTimeout(() => setNotice(''), 3500); } catch (e) { setError(String(e)); } }}/> }
    {salaryModal && <SalaryModal salary={salaryModal} salaries={salaries} staff={staff} calendar={calendar} close={() => setSalaryModal(null)} saved={async () => { setSalaryModal(null); try { await refresh(); setNotice('معاش ذخیره شد.'); window.setTimeout(() => setNotice(''), 3500); } catch (e) { setError(String(e)); } }}/> }
    {expenseModal && <ExpenseModal expense={expenseModal} calendar={calendar} close={() => setExpenseModal(null)} saved={async () => { setExpenseModal(null); try { await refresh(); setNotice('مصرف ذخیره شد.'); window.setTimeout(() => setNotice(''), 3500); } catch (e) { setError(String(e)); } }}/> }
    {employeeModal && <EmployeeModal employee={employeeModal} calendar={calendar} close={() => setEmployeeModal(null)} saved={async () => { setEmployeeModal(null); try { await refresh(); setNotice('معلومات کارمند ذخیره شد.'); window.setTimeout(() => setNotice(''), 3500); } catch (e) { setError(String(e)); } }}/> }
    {ledgerId && <LedgerModal calendar={calendar} customerId={ledgerId} close={() => setLedgerId(null)}/>}
    {modal && <FormModal calendar={calendar} kind={modal} snapshot={snapshot} customerEdit={customerEdit} close={closeModal} saved={saved}/>}
  </div>;
}
function Stat({ icon,label,value,unit,note,color }: { icon: React.ReactNode; label: string; value: string; unit: string; note: string; color: string }) { return <div className="stat"><div className="stat-top"><span>{label}</span><div className={`stat-icon ${color}`}>{icon}</div></div><div className="stat-value"><b dir="ltr">{value}</b><span>{unit}</span></div><div className="stat-note"><span className="tiny-dot"/>{note}</div></div>; }
function Quick({icon,title,text,onClick}: {icon:React.ReactNode;title:string;text:string;onClick:()=>void}) { return <button className="quick" onClick={onClick}><span className="quick-icon">{icon}</span><span><b>{title}</b><small>{text}</small></span><ArrowLeft size={17}/></button>; }
function CustomerTable({ customers, loading, openLedger, edit }: { customers: Snapshot['customers']; loading: boolean; openLedger: (id: string) => void; edit: (customer: Customer) => void }) { return <div className="table-wrap"><table><thead><tr><th>مشتری</th><th>کد مشتری</th><th>شماره تماس</th><th>مانده حساب</th><th>وضعیت</th><th>عملیات</th></tr></thead><tbody>{customers.map((c,i) => <tr key={c.id}><td><div className="person"><span className={`person-avatar p${i%4}`}>{c.name.slice(0,1)}</span><b>{c.name}</b></div></td><td><span className="code" dir="ltr">{c.code}</span></td><td dir="ltr" className="ltr-cell">{c.phone || '—'}</td><td><b dir="ltr">{displayMoney(c.balance)}</b> <span className="unit">افغانی</span></td><td><span className={`badge ${c.balance === '0.00' ? 'good' : c.balance.startsWith('-') ? 'blue-badge' : 'warn'}`}>{c.balance === '0.00' ? 'تصفیه شده' : c.balance.startsWith('-') ? 'بستانکار' : 'دارای مانده'}</span></td><td><button className="text-button" onClick={() => openLedger(c.id)}>کارت حساب <ArrowLeft size={14}/></button> <button className="text-button" onClick={() => edit(c)}>ویرایش</button></td></tr>)}</tbody></table>{!customers.length && <div className="empty">{loading ? 'در حال بارگذاری...' : 'هنوز مشتری‌ای برای نمایش وجود ندارد.'}</div>}</div>; }
function Entries({ entries,loading,calendar }: { entries: Snapshot['entries']; loading:boolean; calendar:Calendar }) { return <div className="table-wrap"><table><thead><tr><th>نوع فعالیت</th><th>مشتری</th><th>شرح</th><th>{calendar === 'shamsi' ? 'تاریخ شمسی' : 'تاریخ میلادی'}</th><th>مبلغ</th></tr></thead><tbody>{entries.map(e => <tr key={e.id}><td><div className="activity-type"><span className={`activity-icon ${e.kind}`} >{e.kind === 'sale' ? <ArrowUpLeft size={17}/> : <ArrowDownLeft size={17}/>}</span><b>{e.kind === 'sale' ? 'فروش' : 'رسید'}</b></div></td><td>{e.customer_name}</td><td className="muted">{e.detail}</td><td><span dir="ltr" className="code">{displayCalendarDate(e.date, calendar)}</span></td><td><b dir="ltr">{displayMoney(e.amount)}</b> <span className="unit">افغانی</span></td></tr>)}</tbody></table>{!entries.length && <div className="empty">{loading ? 'در حال بارگذاری...' : 'هنوز فعالیتی برای نمایش وجود ندارد.'}</div>}</div>; }

function TransactionList({ kind, calendar, revision, onChanged }: { kind: 'sale' | 'receipt'; calendar: Calendar; revision: Snapshot; onChanged:()=>Promise<void> }) {
  const [search,setSearch]=useState(''); const [from,setFrom]=useState(''); const [to,setTo]=useState(''); const [page,setPage]=useState(0);
  const [customer,setCustomer]=useState(''); const [subtype,setSubtype]=useState(''); const [detailId,setDetailId]=useState<string | null>(null); const [edit,setEdit]=useState<TransactionDetail | null>(null);
  const [data,setData]=useState<TransactionPage | null>(null); const [error,setError]=useState(''); const [loading,setLoading]=useState(true);
  useEffect(()=>{
    let active=true;
    const start=from.trim() ? parseCalendarDate(from,calendar) : null; const end=to.trim() ? parseCalendarDate(to,calendar) : null;
    setData(null); setError('');
    if ((from.trim() && !start) || (to.trim() && !end)) { setLoading(false); setError('تاریخ آغاز یا پایان معتبر نیست.'); return ()=>{active=false;}; }
    if (start && end && start>end) { setLoading(false); setError('تاریخ آغاز نباید پس از تاریخ پایان باشد.'); return ()=>{active=false;}; }
    const normalized=normalizeDateDigits(search.trim());
    const text=parseCalendarDate(normalized,calendar) ?? normalized;
    setLoading(true);
    const timer=window.setTimeout(()=>{store.transactions({kind,page,search:text,from:start,to:end,customer_id:customer || null,subtype:subtype || null}).then(result=>{if(active) setData(result);}).catch(e=>{if(active) setError(String(e));}).finally(()=>{if(active) setLoading(false);});},120);
    return ()=>{active=false;window.clearTimeout(timer);};
  },[kind,page,search,from,to,calendar,revision,customer,subtype]);
  return <section className="panel listing"><div className="panel-head list-header"><div><h2>{kind === 'sale' ? 'فهرست فروشات' : 'فهرست رسیدات'}</h2><p>{data ? `${data.total} رکورد مطابق فیلترها · هر صفحه ${data.page_size} رکورد` : error ? 'فیلترها را بررسی کنید' : 'در حال بررسی فهرست'} · تغییر تقویم فیلترها را پاک می‌کند.</p></div><label className="search"><Search size={17}/><input value={search} onChange={e=>{setSearch(e.target.value);setPage(0);}} placeholder="جستجو..." aria-label="جستجو"/></label></div>
    <div className="expense-filters"><Field label={`از تاریخ (${calendar === 'shamsi' ? 'شمسی' : 'میلادی'})`}><input dir="ltr" value={from} onChange={e=>{setFrom(e.target.value);setPage(0);}} placeholder={calendar === 'shamsi' ? '1405/01/01' : '2026/03/21'}/></Field><Field label={`تا تاریخ (${calendar === 'shamsi' ? 'شمسی' : 'میلادی'})`}><input dir="ltr" value={to} onChange={e=>{setTo(e.target.value);setPage(0);}} placeholder={calendar === 'shamsi' ? '1405/12/29' : '2027/03/20'}/></Field><Field label="فیلتر مشتری"><select value={customer} onChange={e=>{setCustomer(e.target.value);setPage(0);}}><option value="">همه</option>{revision.customers.map(c=><option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}</select></Field><Field label={kind === 'sale' ? 'فیلتر نوع پرداخت' : 'فیلتر منبع رسید'}><select value={subtype} onChange={e=>{setSubtype(e.target.value);setPage(0);}}><option value="">همه</option>{kind === 'sale' ? <><option value="cash">نقده</option><option value="credit">باقی</option></> : <><option value="debt">باقی داری</option><option value="deposit">امانت</option><option value="statement">بیانیه</option><option value="advance">پیش پرداخت</option></>}</select></Field></div>
    {error && <div className="error expense-feedback" role="alert">{error}</div>}
    {data && <div className="table-wrap"><table><thead><tr><th>مشتری</th><th>کد مشتری</th><th>شرح</th><th>تاریخ</th><th>مبلغ</th><th>عملیات</th></tr></thead><tbody>{data.rows.map(e=><tr key={e.id}><td>{e.customer_name}</td><td><span className="code" dir="ltr">{e.customer_code}</span></td><td>{e.detail}</td><td><span className="code" dir="ltr">{displayCalendarDate(e.date,calendar)}</span></td><td><b dir="ltr">{displayMoney(e.amount)}</b> <span className="unit">افغانی</span></td><td><button className="text-button" onClick={()=>setDetailId(e.id)}>جزئیات</button></td></tr>)}</tbody></table>{!data.rows.length && <div className="empty">رکوردی برای نمایش وجود ندارد.</div>}</div>}
    {loading && <div className="empty" role="status">در حال بارگذاری...</div>}
    <div className="pagination"><button className="btn secondary" disabled={loading || page===0} onClick={()=>setPage(p=>p-1)}>صفحهٔ قبلی</button><span>صفحهٔ {page+1}</span><button className="btn secondary" disabled={loading || !data || (page+1)*data.page_size>=data.total} onClick={()=>setPage(p=>p+1)}>صفحهٔ بعدی</button></div>
    <div className="form-hint">جستجو در نام و کد مشتری، شرح و تاریخ انجام می‌شود؛ برای جستجوی تاریخ، تاریخ کامل را در تقویم انتخاب‌شده وارد کنید. تغییر اطلاعات هم‌زمان می‌تواند ترتیب صفحه‌ها را عوض کند.</div>
    {detailId && <TransactionDetailModal kind={kind} id={detailId} calendar={calendar} close={()=>setDetailId(null)} onEdit={item=>{setDetailId(null);setEdit(item);}}/>}
    {edit && <FormModal kind={edit.kind} snapshot={revision} customerEdit={null} transactionEdit={edit} calendar={calendar} close={()=>setEdit(null)} saved={async()=>{setEdit(null);await onChanged();}}/>}
  </section>;
}
function TransactionDetailModal({ kind, id, calendar, close, onEdit }: {kind:'sale'|'receipt'; id:string; calendar:Calendar; close:()=>void; onEdit:(detail:TransactionDetail)=>void}) {
  const [detail,setDetail]=useState<TransactionDetail | null>(null); const [error,setError]=useState('');
  useEffect(()=>{ let active=true; store.transactionDetail(kind,id).then(value=>{if(active)setDetail(value);}).catch(e=>{if(active)setError(String(e));}); return ()=>{active=false;}; },[kind,id]);
  const sourceLabels={debt:'باقی داری',deposit:'امانت',statement:'بیانیه',advance:'پیش پرداخت'};
  return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)close();}}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="transaction-detail-title"><div className="modal-head"><div><span className="eyebrow"><span/> جزئیات عملیات</span><h2 id="transaction-detail-title">{kind==='sale' ? 'جزئیات فروش' : 'جزئیات رسید'}</h2><p>اطلاعات فعلی این رکورد؛ شمارهٔ سند رسمی هنوز آماده نیست.</p></div><button className="icon-button" aria-label="بستن" onClick={close}><X size={20}/></button></div>
    {error && <div className="error" role="alert">{error}</div>}{!detail && !error && <div className="empty" role="status">در حال بارگذاری...</div>}
    {detail && <><div className="ledger-summary"><div><span>مشتری</span><b>{detail.customer_name} <small dir="ltr">{detail.customer_code}</small></b></div><div><span>تاریخ</span><b dir="ltr">{displayCalendarDate(detail.date,calendar)}</b></div></div>
      <div className="table-wrap"><table><tbody>{detail.kind === 'sale' ? <><tr><th>نوع مواد</th><td>{detail.material}</td></tr><tr><th>متراژ (متر مکعب)</th><td dir="ltr" className="ltr-cell">{detail.volume}</td></tr><tr><th>قیمت فی متر</th><td dir="ltr" className="ltr-cell">{displayMoney(detail.unit_price)} افغانی</td></tr><tr><th>کرایه فی متر</th><td dir="ltr" className="ltr-cell">{displayMoney(detail.freight)} افغانی</td></tr><tr><th>نوع پرداخت</th><td>{detail.payment_type==='credit' ? 'باقی' : 'نقده'}</td></tr><tr><th>مجموع فروش</th><td dir="ltr" className="ltr-cell">{displayMoney(detail.total)} افغانی</td></tr></> : <><tr><th>منبع رسید</th><td>{sourceLabels[detail.source]}</td></tr><tr><th>مبلغ رسید</th><td dir="ltr" className="ltr-cell">{displayMoney(detail.amount)} افغانی</td></tr></>}</tbody></table></div>
      {detail.kind === 'receipt' && detail.source === 'deposit' && <div className="form-hint">رسید امانت در بدهی مشتری تأثیر ندارد.</div>}
      <div className="form-hint">شناسهٔ داخلی: <span dir="ltr">{detail.id}</span> · این شناسه شمارهٔ رسمی سند نیست.</div></>}
    <div className="modal-actions"><button className="btn secondary" onClick={close}>بستن</button>{detail && <button className="btn primary" onClick={()=>onEdit(detail)}>ویرایش</button>}</div>
  </div></div>;
}

function FinancialReport({calendar}:{calendar:Calendar}) {
  const today=displayCalendarDate(todayKabul(),calendar);
  const [from,setFrom]=useState(today); const [to,setTo]=useState(today);
  const [result,setResult]=useState<{data:RangeSummary;from:string;to:string}|null>(null); const [busy,setBusy]=useState(false); const [error,setError]=useState(''); const [message,setMessage]=useState('');
  const submit=async(e:React.FormEvent)=>{
    e.preventDefault(); setError(''); setMessage(''); setResult(null);
    const start=parseCalendarDate(from,calendar), end=parseCalendarDate(to,calendar);
    if (!start || !end) {setError('تاریخ آغاز و پایان معتبر وارد کنید.'); return;}
    if (start>end) {setError('تاریخ آغاز نباید پس از تاریخ پایان باشد.'); return;}
    setBusy(true);
    try { const data=await store.rangeSummary(start,end); setResult({data,from:start,to:end}); }
    catch(e) {setError(String(e));} finally {setBusy(false);}
  };
  const exportCsv=async()=>{
    if (!result) return; setBusy(true); setError(''); setMessage('');
    try { if (await exportRangeCsv(result.from,result.to,result.data)) setMessage('فایل CSV ساخته شد.'); }
    catch(e) {setError(String(e));} finally {setBusy(false);}
  };
  return <section className="panel listing"><div className="panel-head"><div><h2>راپور مالی بازه‌ای آزمایشی</h2><p>جمع همهٔ رکوردهای ذخیره‌شده در بازهٔ انتخابی، شامل روز آغاز و پایان.</p></div></div>
    <form onSubmit={submit}><div className="expense-filters"><Field label={`از تاریخ (${calendar==='shamsi'?'شمسی':'میلادی'})`} required><input required disabled={busy} dir="ltr" value={from} onChange={e=>{setFrom(e.target.value);setResult(null);setError('');setMessage('');}}/></Field><Field label={`تا تاریخ (${calendar==='shamsi'?'شمسی':'میلادی'})`} required><input required disabled={busy} dir="ltr" value={to} onChange={e=>{setTo(e.target.value);setResult(null);setError('');setMessage('');}}/></Field></div><div className="expense-feedback"><button className="btn primary" disabled={busy} type="submit">{busy?'در حال محاسبه...':'محاسبهٔ راپور'}</button></div></form>
    {error && <div className="error expense-feedback" role="alert">{error}</div>}{message && <div className="notice expense-feedback" role="status">{message}</div>}
    {result && <><div className="form-hint">نتیجه از {displayCalendarDate(result.from,calendar)} تا {displayCalendarDate(result.to,calendar)}؛ برای دریافت اطلاعات تازه دوباره محاسبه کنید.</div>
      <div className="table-wrap"><table><thead><tr><th>شاخص</th><th>جمع</th></tr></thead><tbody>
        {([
          ['تعداد فروش',String(result.data.sales_count),'رکورد'],['فروش نقده',displayMoney(result.data.sales_cash),'افغانی'],['فروش باقی',displayMoney(result.data.sales_credit),'افغانی'],['متراژ فروش',result.data.volume,'متر مکعب'],
          ['تعداد رسید',String(result.data.receipts_count),'رکورد'],['رسیدهای مؤثر بر بدهی',displayMoney(result.data.receipts_effective),'افغانی'],['رسید امانت',displayMoney(result.data.receipts_deposit),'افغانی'],
          ['تعداد مصارف',String(result.data.expenses_count),'رکورد'],['مصارف افغانی',displayMoney(result.data.expenses_afn),'افغانی'],['مصارف دالری',displayMoney(result.data.expenses_usd),'دالر'],
          ['تعداد معاشات',String(result.data.salaries_count),'رکورد'],['معاشات',displayMoney(result.data.salaries_afn),'افغانی'],
        ] as [string,string,string][]).map(([label,value,unit])=><tr key={label}><th>{label}</th><td><b dir="ltr">{value}</b> <span className="unit">{unit}</span></td></tr>)}
      </tbody></table></div><div className="expense-feedback"><button type="button" className="btn secondary" disabled={!inDesktop || busy} onClick={exportCsv}>خروجی CSV</button> <span className="form-hint">{inDesktop ? 'فایل باید جدید باشد؛ اگر جمع‌ها تغییر کرده‌اند، ابتدا راپور را دوباره محاسبه کنید.' : 'خروجی فایل در پیش‌نمایش مرورگر فعال نیست.'}</span></div></>}
    <div className="form-hint">رسید امانت از بدهی کم نمی‌شود؛ باقی رسیدها در جمع مؤثر بر بدهی آمده‌اند. مصارف نقده و باقی هر دو شامل‌اند؛ معاش بر اساس تاریخ پرداخت است و ممکن است منفی باشد. ارزها تبدیل یا جمع نمی‌شوند. این ارقام موجودی دخل، سود یا زیان نیستند؛ قواعد و داده‌ها باید با حسابدار تطبیق شوند. چاپ و سایر راپورهای قدیمی هنوز آماده نیست.</div>
  </section>;
}

function AttendanceReport({ records, staff, calendar, loading }: {records:Attendance[]; staff:Employee[]; calendar:Calendar; loading:boolean}) {
  const [month,setMonth]=useState(()=>displayCalendarDate(todayKabul(),calendar).slice(0,7));
  let report:ReturnType<typeof monthlyAttendance> | null=null; let error='';
  try { report=monthlyAttendance(records,staff,month,calendar); } catch(e) { error=String(e).replace(/^Error: /,''); }
  return <section className="panel listing"><div className="panel-head"><div><h2>راپور حضور ماهانه</h2><p>شماری از وضعیت‌های ثبت‌شده برای هر کارمند؛ تغییر تقویم ماه را به ماه جاری بازمی‌گرداند.</p></div></div>
    <div className="expense-filters"><Field label={`ماه (${calendar === 'shamsi' ? 'شمسی' : 'میلادی'})`}><input dir="ltr" value={month} onChange={e=>setMonth(e.target.value)} placeholder={calendar==='shamsi'?'1404/01':'2025/03'}/></Field></div>
    {error && <div className="error expense-feedback" role="alert">{error}</div>}
    {report && <><div className="form-hint">از {displayCalendarDate(report.from,calendar)} تا {displayCalendarDate(report.to,calendar)} · نام و وضعیت کارمند کنونی است. روزهای ثبت‌نشده نه غایب و نه حاضر شمرده می‌شوند؛ این راپور محاسبهٔ معاش نیست.</div>
      <div className="table-wrap"><table><thead><tr><th>کارمند</th><th>وضعیت کنونی</th><th>رکورد ثبت‌شده</th>{(Object.entries(attendanceLabels) as [AttendanceStatus,string][]).map(([key,label])=><th key={key}>{label}</th>)}<th>اضافه‌کاری (ساعت)</th></tr></thead><tbody>{report.rows.map(row=><tr key={row.employee.id}><td>{row.employee.name} <span className="code" dir="ltr">{row.employee.code}</span></td><td>{row.employee.status==='active'?'فعال':'غیرفعال'}</td><td dir="ltr">{row.recorded}</td>{(Object.keys(attendanceLabels) as AttendanceStatus[]).map(key=><td key={key} dir="ltr">{row.counts[key]}</td>)}<td dir="ltr">{displayMoney(row.overtime)}</td></tr>)}</tbody></table>{!report.rows.length && <div className="empty">{loading?'در حال بارگذاری...':'کارمندی برای نمایش وجود ندارد.'}</div>}</div></>}
  </section>;
}

function AttendanceList({ records, staff, calendar, loading, edit }: { records: Attendance[]; staff: Employee[]; calendar: Calendar; loading: boolean; edit:(record:Attendance)=>void }) {
  const [search,setSearch]=useState(''); const [from,setFrom]=useState(''); const [to,setTo]=useState('');
  const [employee,setEmployee]=useState(''); const [status,setStatus]=useState('');
  let summary:ReturnType<typeof summarizeAttendance> | null=null; let error='';
  try { summary=summarizeAttendance(records,search,from,to,calendar,employee,status); } catch(e) {error=String(e).replace(/^Error: /,'');}
  const rows=summary?.rows ?? [];
  return <section className="panel listing"><div className="panel-head list-header"><div><h2>فهرست حضور و غیاب</h2><p>{rows.length} رکورد نمایش داده می‌شود؛ نام و کد از اطلاعات فعلی کارمند خوانده می‌شود. تغییر تقویم فیلترها را پاک می‌کند.</p></div><label className="search"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="جستجو..." aria-label="جستجوی حضور و غیاب"/></label></div>
    <div className="expense-filters"><Field label={`از تاریخ کار (${calendar === 'shamsi' ? 'شمسی' : 'میلادی'})`}><input dir="ltr" value={from} onChange={e=>setFrom(e.target.value)} placeholder={calendar === 'shamsi' ? '1405/01/01' : '2026/03/21'}/></Field><Field label={`تا تاریخ کار (${calendar === 'shamsi' ? 'شمسی' : 'میلادی'})`}><input dir="ltr" value={to} onChange={e=>setTo(e.target.value)} placeholder={calendar === 'shamsi' ? '1405/12/29' : '2027/03/20'}/></Field><Field label="فیلتر کارمند"><select value={employee} onChange={e=>setEmployee(e.target.value)}><option value="">همه</option>{staff.map(e=><option key={e.id} value={e.id}>{e.name} ({e.code})</option>)}</select></Field><Field label="فیلتر وضعیت حضور"><select value={status} onChange={e=>setStatus(e.target.value)}><option value="">همه</option>{(Object.entries(attendanceLabels) as [AttendanceStatus,string][]).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></Field></div>
    {error ? <div className="error expense-feedback" role="alert">{error}</div> : summary && <div className="expense-summary">خلاصهٔ رکوردهای نمایش‌داده‌شده: {(Object.entries(attendanceLabels) as [AttendanceStatus,string][]).map(([key,label])=><span key={key}>{label}: <b dir="ltr">{summary.counts[key]}</b> · </span>)} اضافه‌کاری: <b dir="ltr">{displayMoney(summary.overtime)}</b> ساعت. روزهای ثبت‌نشده در این خلاصه محسوب نمی‌شوند.</div>}
    <div className="table-wrap"><table><thead><tr><th>کارمند</th><th>تاریخ</th><th>وضعیت</th><th>ورود</th><th>خروج</th><th>اضافه‌کاری (ساعت)</th><th>ملاحظات</th><th>عملیات</th></tr></thead><tbody>{rows.map(a=><tr key={a.id}><td>{a.employee_name} <span className="code" dir="ltr">{a.employee_code}</span></td><td><span className="code" dir="ltr">{displayCalendarDate(a.work_date,calendar)}</span></td><td>{attendanceLabels[a.status]}</td><td dir="ltr">{a.check_in || '—'}</td><td dir="ltr">{a.check_out || '—'}</td><td dir="ltr">{displayMoney(a.overtime)}</td><td>{a.notes || '—'}</td><td><button className="text-button" onClick={()=>edit(a)}>ویرایش</button></td></tr>)}</tbody></table>{!error && !rows.length && <div className="empty">{loading ? 'در حال بارگذاری...' : 'رکورد حضوری برای نمایش وجود ندارد.'}</div>}</div>
    <div className="form-hint">برای هر کارمند در هر تاریخ فقط یک رکورد ثبت می‌شود؛ برای اصلاح، رکورد موجود را ویرایش کنید. حذف، راپور ماهانه و محاسبهٔ خودکار معاش هنوز آماده نیست.</div>
  </section>;
}
function AttendanceBatchModal({ staff, records, calendar, reload, close, saved }: { staff:Employee[]; records:Attendance[]; calendar:Calendar; reload:()=>Promise<void>; close:()=>void; saved:()=>Promise<void> }) {
  const [date,setDate]=useState(todayKabul()); const [statuses,setStatuses]=useState<Record<string,AttendanceStatus | ''>>({});
  const [error,setError]=useState(''); const [busy,setBusy]=useState(false);
  const already=new Set(records.filter(r=>r.work_date===date).map(r=>r.employee_id));
  const available=staff.filter(e=>e.status==='active' && !already.has(e.id));
  const selected=available.flatMap(e => statuses[e.id] ? [{employee_id:e.id,status:statuses[e.id] as AttendanceStatus}] : []);
  const submit=async(e:React.FormEvent)=>{e.preventDefault();setError('');setBusy(true);try {await store.createAttendanceBatch(date,selected);await saved();} catch(e) {setStatuses({}); try { await reload(); setError(`ثبت ورق ناموفق بود. اطلاعات تازه شد؛ فهرست را بررسی کنید: ${String(e)}`); } catch { setError(`ثبت ورق ناموفق بود و تازه‌سازی انجام نشد؛ برنامه را دوباره باز کنید: ${String(e)}`); }} finally {setBusy(false);}};
  return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget && !busy) close();}}><div className="modal ledger-modal" role="dialog" aria-modal="true" aria-labelledby="batch-title"><div className="modal-head"><div><span className="eyebrow"><span/> حضور و غیاب</span><h2 id="batch-title">ورق روزانه</h2><p>برای هر کارمند موردنظر وضعیت انتخاب کنید؛ انتخاب‌نشده‌ها ذخیره نمی‌شوند.</p></div><button className="icon-button" type="button" disabled={busy} aria-label="بستن" onClick={close}><X size={20}/></button></div>
    <form onSubmit={submit}>{error && <div className="error" role="alert">{error}</div>}<div className="form-grid"><DateField key={calendar} calendar={calendar} value={date} title="تاریخ ورق" onChange={value=>{setDate(value);setStatuses({});}}/></div>
      <div className="form-hint">فقط کارمندان فعال و بدون رکورد در این تاریخ نمایش داده می‌شوند. رکوردهای قبلی بازنویسی نمی‌شوند. ساعت‌ها خالی و اضافه‌کاری صفر ثبت می‌شود؛ برای جزئیات، بعداً رکورد را ویرایش کنید. تغییر تاریخ انتخاب‌ها را پاک می‌کند.</div>
      <div className="modal-actions"><button type="button" className="btn secondary" disabled={!date || busy || !available.length} onClick={()=>setStatuses(Object.fromEntries(available.map(e=>[e.id,'present'])))}>همهٔ قابل ثبت حاضر</button></div>
      <div className="table-wrap"><table><thead><tr><th>کارمند</th><th>وضعیت</th></tr></thead><tbody>{available.map(e=><tr key={e.id}><td>{e.name} <span className="code" dir="ltr">{e.code}</span></td><td><label className="field"><span className="sr-only">وضعیت {e.name} ({e.code})</span><select aria-label={`وضعیت ${e.name} (${e.code})`} value={statuses[e.id] || ''} onChange={event=>setStatuses({...statuses,[e.id]:event.target.value as AttendanceStatus | ''})}><option value="">ثبت نشود</option>{(Object.entries(attendanceLabels) as [AttendanceStatus,string][]).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label></td></tr>)}</tbody></table>{!available.length && <div className="empty">کارمند فعال بدون رکورد برای این تاریخ وجود ندارد.</div>}</div>
      <div className="form-hint">{selected.length} ردیف انتخاب شده؛ حداکثر ۵۰۰ ردیف در هر ذخیره. ثبت ردیف‌ها در یک تراکنش انجام می‌شود. در صورت تغییر هم‌زمان، پس از خطا فهرست دوباره بارگذاری می‌شود.</div>
      <div className="modal-actions"><button type="button" className="btn secondary" disabled={busy} onClick={close}>انصراف</button><button type="submit" className="btn primary" disabled={busy || !date || selected.length===0 || selected.length>500}>{busy ? 'در حال ثبت...' : 'ذخیره ورق'} <Check size={17}/></button></div>
    </form></div></div>;
}

function AttendanceModal({ record, staff, calendar, close, saved }: { record: Attendance | 'new'; staff: Employee[]; calendar: Calendar; close:()=>void; saved:()=>Promise<void> }) {
  const initial: AttendanceInput=record === 'new' ? {employee_id:staff[0]?.id || '',work_date:todayKabul(),status:'present',check_in:null,check_out:null,overtime:'0',notes:''} : record;
  const [form,setForm]=useState<AttendanceInput>(initial); const [error,setError]=useState(''); const [busy,setBusy]=useState(false);
  const submit=async(e:React.FormEvent)=>{e.preventDefault(); setError(''); setBusy(true); try { await store.saveAttendance(record === 'new' ? null : record.id,form); await saved(); } catch(e) { setError(String(e)); } finally {setBusy(false);} };
  return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget && !busy) close();}}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="attendance-title"><div className="modal-head"><div><span className="eyebrow"><span/> حضور و غیاب</span><h2 id="attendance-title">{record === 'new' ? 'ثبت حضور جدید' : 'ویرایش حضور'}</h2><p>یک رکورد برای کارمند و تاریخ انتخاب‌شده ثبت می‌شود.</p></div><button className="icon-button" type="button" disabled={busy} aria-label="بستن" onClick={close}><X size={20}/></button></div>
    <form onSubmit={submit}>{error && <div className="error" role="alert">{error}</div>}{!staff.length && <div className="form-hint">ابتدا یک کارمند ثبت کنید.</div>}<div className="form-grid">
      <Field label="کارمند" required><select required value={form.employee_id} onChange={e=>setForm({...form,employee_id:e.target.value})}><option value="">انتخاب کارمند</option>{staff.map(e=><option key={e.id} value={e.id}>{e.name} ({e.code}){e.status === 'inactive' ? ' · غیرفعال' : ''}</option>)}</select></Field>
      <DateField key={calendar} calendar={calendar} value={form.work_date} title="تاریخ کار" onChange={work_date=>setForm({...form,work_date})}/>
      <Field label="وضعیت حضور"><select value={form.status} onChange={e=>setForm({...form,status:e.target.value as AttendanceStatus})}>{(Object.entries(attendanceLabels) as [AttendanceStatus,string][]).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></Field>
      <Field label="ساعت ورود"><input dir="ltr" value={form.check_in || ''} onChange={e=>setForm({...form,check_in:e.target.value || null})} placeholder="08:30"/></Field>
      <Field label="ساعت خروج"><input dir="ltr" value={form.check_out || ''} onChange={e=>setForm({...form,check_out:e.target.value || null})} placeholder="16:30"/></Field>
      <Field label="اضافه‌کاری (ساعت)" required><input required inputMode="decimal" value={form.overtime} onChange={e=>setForm({...form,overtime:e.target.value})}/></Field>
      <Field label="ملاحظات"><input value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></Field>
    </div><div className="form-hint">ساعت ورود و خروج اختیاری و به شکل ۲۴ ساعته، مانند 08:30 است؛ ساعات به‌طور خودکار محاسبه نمی‌شوند. اضافه‌کاری با حداکثر دو رقم اعشار ثبت می‌شود و به معاش وصل نیست.</div><div className="modal-actions"><button type="button" className="btn secondary" disabled={busy} onClick={close}>انصراف</button><button type="submit" className="btn primary" disabled={busy || !staff.length}>{busy ? 'در حال ثبت...' : 'ذخیره معلومات'} <Check size={17}/></button></div></form>
  </div></div>;
}

function SalaryList({ salaries, staff, calendar, loading, edit }: { salaries: Salary[]; staff: Employee[]; calendar: Calendar; loading: boolean; edit: (salary: Salary) => void }) {
  const [search,setSearch]=useState(''); const [from,setFrom]=useState(''); const [to,setTo]=useState('');
  const [employee,setEmployee]=useState(''); const [payment,setPayment]=useState('');
  let summary: ReturnType<typeof summarizeSalaries> | null = null; let error = '';
  try { summary=summarizeSalaries(salaries,search,from,to,calendar,employee,payment); } catch(e) { error=String(e).replace(/^Error: /,''); }
  const rows=summary?.rows ?? [];
  return <section className="panel listing"><div className="panel-head list-header"><div><h2>فهرست معاشات</h2><p>{rows.length} پرداخت نمایش داده می‌شود. نام و کد از اطلاعات فعلی کارمند خوانده می‌شوند. تغییر تقویم فیلترها را پاک می‌کند.</p></div><label className="search"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="جستجو..." aria-label="جستجوی معاشات"/></label></div>
    <div className="expense-filters"><Field label={`از تاریخ پرداخت (${calendar === 'shamsi' ? 'شمسی' : 'میلادی'})`}><input dir="ltr" value={from} onChange={e=>setFrom(e.target.value)} placeholder={calendar === 'shamsi' ? '1405/01/01' : '2026/03/21'}/></Field><Field label={`تا تاریخ پرداخت (${calendar === 'shamsi' ? 'شمسی' : 'میلادی'})`}><input dir="ltr" value={to} onChange={e=>setTo(e.target.value)} placeholder={calendar === 'shamsi' ? '1405/12/29' : '2027/03/20'}/></Field><Field label="فیلتر کارمند"><select value={employee} onChange={e=>setEmployee(e.target.value)}><option value="">همه</option>{staff.map(e=><option key={e.id} value={e.id}>{e.name} ({e.code})</option>)}</select></Field><Field label="فیلتر نوع پرداخت"><select value={payment} onChange={e=>setPayment(e.target.value)}><option value="">همه</option><option value="cash">نقد</option><option value="transfer">حواله</option></select></Field></div>
    {error ? <div className="error expense-feedback" role="alert">{error}</div> : summary && <div className="expense-summary">مجموع موارد نمایش‌داده‌شده (مطابق فیلترها): <b dir="ltr">{displayMoney(summary.total)}</b> افغانی</div>}
    <div className="table-wrap"><table><thead><tr><th>کارمند</th><th>دورهٔ معاش</th><th>تاریخ پرداخت</th><th>معاش پایه</th><th>مجموع پرداخت</th><th>پرداخت‌کننده</th><th>نوع پرداخت</th><th>عملیات</th></tr></thead><tbody>{rows.map(s=><tr key={s.id}><td>{s.employee_name} <span className="code" dir="ltr">{s.employee_code}</span></td><td><span dir="ltr">{s.period_year}/{String(s.period_month).padStart(2,'0')}</span> {s.period_calendar === 'shamsi' ? 'شمسی' : 'میلادی'}</td><td><span className="code" dir="ltr">{displayCalendarDate(s.pay_date,calendar)}</span></td><td><b dir="ltr">{displayMoney(s.base)}</b></td><td><b dir="ltr">{displayMoney(s.total)}</b> <span className="unit">افغانی</span></td><td>{s.payer || '—'}</td><td>{s.payment_type === 'cash' ? 'نقد' : 'حواله'}</td><td><button className="text-button" onClick={()=>edit(s)}>ویرایش</button></td></tr>)}</tbody></table>{!error && !rows.length && <div className="empty">{loading ? 'در حال بارگذاری...' : 'معاشی برای نمایش وجود ندارد.'}</div>}</div>
    <div className="form-hint">ثبت معاش به حساب دخل وصل نیست؛ شمارهٔ سند، چاپ و کنترل پرداخت تکراری هنوز آماده نیست. مجموع منفی نیز مطابق فرمول قدیمی پذیرفته می‌شود و باید توسط حسابدار بررسی شود.</div>
  </section>;
}
function SalaryModal({ salary, salaries, staff, calendar, close, saved }: { salary: Salary | 'new'; salaries: Salary[]; staff: Employee[]; calendar: Calendar; close:()=>void; saved:()=>Promise<void> }) {
  const today=todayKabul(); const dateParts=displayCalendarDate(today,calendar).split('/');
  const initial: SalaryInput = salary === 'new' ? { employee_id:staff[0]?.id || '', period_calendar:calendar, period_year:Number(dateParts[0]), period_month:Number(dateParts[1]), pay_date:today, base:staff[0]?.base_salary || '0', bonus:'0', fine:'0', overtime:'0', payer:'', payment_type:'cash', notes:'' } : salary;
  const [form,setForm]=useState<SalaryInput>(initial); const [year,setYear]=useState(String(initial.period_year));
  const [error,setError]=useState(''); const [busy,setBusy]=useState(false);
  const yearDigits=normalizeDateDigits(year.trim());
  const duplicates=/^\d{1,4}$/.test(yearDigits) ? salaries.filter(s => (salary === 'new' || s.id !== salary.id) && s.employee_id === form.employee_id && s.period_calendar === form.period_calendar && s.period_year === Number(yearDigits) && s.period_month === form.period_month).length : 0;
  let total='—'; let negative=false; try { const n=salaryTotal(form.base,form.bonus,form.fine,form.overtime); total=displayMoney(formatScaled(n)); negative=n<0n; } catch { /* incomplete */ }
  const submit=async(e:React.FormEvent)=> { e.preventDefault(); setError(''); setBusy(true); try {
    const normalized=normalizeDateDigits(year.trim()); if (!/^\d{1,4}$/.test(normalized)) throw new Error('سال دورهٔ معاش معتبر نیست.');
    await store.saveSalary(salary === 'new' ? null : salary.id, {...form,period_year:Number(normalized)}); await saved();
  } catch(e) { setError(String(e)); } finally { setBusy(false); } };
  return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget && !busy) close();}}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="salary-title"><div className="modal-head"><div><span className="eyebrow"><span/> معاشات</span><h2 id="salary-title">{salary === 'new' ? 'پرداخت معاش جدید' : 'ویرایش معاش'}</h2><p>معلومات پرداخت را با دقت بررسی کنید.</p></div><button className="icon-button" type="button" disabled={busy} aria-label="بستن" onClick={close}><X size={20}/></button></div>
    <form onSubmit={submit}>{error && <div className="error" role="alert">{error}</div>}{!staff.length && <div className="form-hint">ابتدا یک کارمند ثبت کنید.</div>}<div className="form-grid">
      <Field label="کارمند" required><select required value={form.employee_id} onChange={e=>{const employee=staff.find(s=>s.id===e.target.value); setForm({...form,employee_id:e.target.value,...(salary === 'new' && employee ? {base:employee.base_salary} : {})});}}><option value="">انتخاب کارمند</option>{staff.map(e=><option key={e.id} value={e.id}>{e.name} ({e.code}){e.status === 'inactive' ? ' · غیرفعال' : ''}</option>)}</select></Field>
      <DateField key={calendar} calendar={calendar} value={form.pay_date} title="تاریخ پرداخت" onChange={pay_date=>setForm({...form,pay_date})}/>
      <Field label="تقویم دوره"><select value={form.period_calendar} onChange={e=>setForm({...form,period_calendar:e.target.value as SalaryInput['period_calendar']})}><option value="shamsi">شمسی</option><option value="miladi">میلادی</option></select></Field>
      <Field label="سال دوره" required><input required inputMode="numeric" value={year} onChange={e=>setYear(e.target.value)}/></Field>
      <Field label="ماه دوره"><select value={form.period_month} onChange={e=>setForm({...form,period_month:Number(e.target.value)})}>{Array.from({length:12},(_,i)=><option key={i+1} value={i+1}>{i+1}</option>)}</select></Field>
      <Field label="معاش ثابت" required><input required inputMode="decimal" value={form.base} onChange={e=>setForm({...form,base:e.target.value})}/></Field>
      <Field label="پاداش" required><input required inputMode="decimal" value={form.bonus} onChange={e=>setForm({...form,bonus:e.target.value})}/></Field>
      <Field label="جریمه" required><input required inputMode="decimal" value={form.fine} onChange={e=>setForm({...form,fine:e.target.value})}/></Field>
      <Field label="اضافه‌کاری" required><input required inputMode="decimal" value={form.overtime} onChange={e=>setForm({...form,overtime:e.target.value})}/></Field>
      <div className="total-box"><span>مجموع پرداخت</span><b dir="ltr">{total} <small>افغانی</small></b></div>
      <Field label="پرداخت‌کننده"><input value={form.payer} onChange={e=>setForm({...form,payer:e.target.value})}/></Field>
      <Field label="نوع پرداخت"><select value={form.payment_type} onChange={e=>setForm({...form,payment_type:e.target.value as SalaryInput['payment_type']})}><option value="cash">نقد</option><option value="transfer">حواله</option></select></Field>
      <Field label="توضیحات"><input value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></Field>
    </div>{duplicates > 0 && <div className="form-hint salary-warning" role="status">هشدار: {duplicates} پرداخت دیگر برای این کارمند و دوره در فهرست فعلی وجود دارد. ثبت پرداخت قسطی مسدود نیست؛ پیش از ذخیره تکراری‌نبودن را بررسی کنید. این هشدار کنترل هم‌زمان چند کاربر نیست.</div>}<div className="form-hint">مجموع = معاش ثابت + پاداش + اضافه‌کاری − جریمه. تقویم دوره مستقل از تاریخ پرداخت است؛ با تغییر تقویم دوره، سال و ماه خودکار تبدیل نمی‌شوند.{salary === 'new' ? ' با انتخاب کارمند، معاش ثابت از معلومات فعلی او پیشنهاد می‌شود.' : ' تغییر کارمند در ویرایش، معاش ثابت ثبت‌شده را عوض نمی‌کند.'}{negative && ' هشدار: مجموع منفی است؛ پیش از ذخیره بررسی کنید.'}</div><div className="modal-actions"><button type="button" className="btn secondary" disabled={busy} onClick={close}>انصراف</button><button type="submit" className="btn primary" disabled={busy || !staff.length}>{busy ? 'در حال ثبت...' : 'ذخیره معلومات'} <Check size={17}/></button></div></form>
  </div></div>;
}

function ExpenseList({ expenses, calendar, loading, edit }: { expenses: Expense[]; calendar: Calendar; loading: boolean; edit: (expense: Expense) => void }) {
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState(''); const [to, setTo] = useState('');
  let summary: ReturnType<typeof summarizeExpenses> | null = null; let error = '';
  try { summary = summarizeExpenses(expenses, search, from, to, calendar); } catch (e) { error = String(e).replace(/^Error: /, ''); }
  const rows = summary?.rows ?? [];
  return <section className="panel listing"><div className="panel-head list-header"><div><h2>فهرست مصارف</h2><p>{rows.length} مصرف نمایش داده می‌شود؛ ارزها به هم تبدیل نمی‌شوند. تغییر تقویم فیلترهای این صفحه را پاک می‌کند.</p></div><label className="search"><Search size={17}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="جستجو..." aria-label="جستجوی مصارف"/></label></div>
    <div className="expense-filters"><Field label={`از تاریخ (${calendar === 'shamsi' ? 'شمسی' : 'میلادی'})`}><input dir="ltr" value={from} onChange={e=>setFrom(e.target.value)} placeholder={calendar === 'shamsi' ? '1405/01/01' : '2026/03/21'}/></Field><Field label={`تا تاریخ (${calendar === 'shamsi' ? 'شمسی' : 'میلادی'})`}><input dir="ltr" value={to} onChange={e=>setTo(e.target.value)} placeholder={calendar === 'shamsi' ? '1405/12/29' : '2027/03/20'}/></Field></div>
    {error ? <div className="error expense-feedback" role="alert">{error}</div> : summary && <div className="expense-summary">مجموع موارد نمایش‌داده‌شده، شامل نقده و باقی: <b dir="ltr">{displayMoney(summary.afn)}</b> افغانی · <b dir="ltr">{displayMoney(summary.usd)}</b> دالر</div>}
    <div className="table-wrap"><table><thead><tr><th>تاریخ</th><th>شرح</th><th>نوع مصرف</th><th>افغانی</th><th>دالر</th><th>پرداخت‌کننده</th><th>روش</th><th>عملیات</th></tr></thead><tbody>{rows.map(e => <tr key={e.id}><td><span className="code" dir="ltr">{displayCalendarDate(e.date, calendar)}</span></td><td>{e.description}</td><td>{e.expense_type || '—'}</td><td><b dir="ltr">{displayMoney(e.amount_afn)}</b></td><td><b dir="ltr">{displayMoney(e.amount_usd)}</b></td><td>{e.payer || '—'}</td><td>{e.payment_method === 'cash' ? 'نقده' : 'باقی'}</td><td><button className="text-button" onClick={() => edit(e)}>ویرایش</button></td></tr>)}</tbody></table>{!error && !rows.length && <div className="empty">{loading ? 'در حال بارگذاری...' : 'مصرفی برای نمایش وجود ندارد.'}</div>}</div>
    <div className="form-hint">این نسخه شمارهٔ رسمی سند، حساب دخل و فهرست‌های مشترک انواع مصرف و پرداخت‌کنندگان را هنوز پیاده‌سازی نکرده است.</div>
  </section>;
}
function ExpenseModal({ expense, calendar, close, saved }: { expense: Expense | 'new'; calendar: Calendar; close: () => void; saved: () => Promise<void> }) {
  const initial: ExpenseInput = expense === 'new' ? { date:todayKabul(), description:'', expense_type:'', purchase_bill_no:'', shop_name:'', amount_afn:'0', amount_usd:'0', payer:'', payment_method:'cash', notes:'' } : expense;
  const [form, setForm] = useState<ExpenseInput>(initial);
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async (event: React.FormEvent) => { event.preventDefault(); setError(''); setBusy(true); try { await store.saveExpense(expense === 'new' ? null : expense.id, form); await saved(); } catch (e) { setError(String(e)); } finally { setBusy(false); } };
  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget && !busy) close(); }}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="expense-title"><div className="modal-head"><div><span className="eyebrow"><span/> ثبت معلومات</span><h2 id="expense-title">{expense === 'new' ? 'ثبت مصرف جدید' : 'ویرایش مصرف'}</h2><p>حداقل یکی از مبلغ‌های افغانی یا دالری باید بیشتر از صفر باشد.</p></div><button className="icon-button" type="button" aria-label="بستن" disabled={busy} onClick={close}><X size={20}/></button></div>
    <form onSubmit={submit}>{error && <div className="error" role="alert">{error}</div>}<div className="form-grid">
      <DateField key={calendar} calendar={calendar} value={form.date} onChange={date => setForm({...form,date})}/>
      <Field label="شرح مصرف" required><input required value={form.description} onChange={e => setForm({...form,description:e.target.value})}/></Field>
      <Field label="نوع مصرف"><input value={form.expense_type} onChange={e => setForm({...form,expense_type:e.target.value})}/></Field>
      <Field label="نمبر بل خرید"><input value={form.purchase_bill_no} onChange={e => setForm({...form,purchase_bill_no:e.target.value})}/></Field>
      <Field label="نام فروشگاه"><input value={form.shop_name} onChange={e => setForm({...form,shop_name:e.target.value})}/></Field>
      <Field label="پرداخت‌کننده"><input value={form.payer} onChange={e => setForm({...form,payer:e.target.value})}/></Field>
      <Field label="مبلغ افغانی"><input inputMode="decimal" required value={form.amount_afn} onChange={e => setForm({...form,amount_afn:e.target.value})}/></Field>
      <Field label="مبلغ دالری"><input inputMode="decimal" required value={form.amount_usd} onChange={e => setForm({...form,amount_usd:e.target.value})}/></Field>
      <Field label="روش پرداخت"><select value={form.payment_method} onChange={e => setForm({...form,payment_method:e.target.value as ExpenseInput['payment_method']})}><option value="cash">نقده</option><option value="credit">باقی</option></select></Field>
      <Field label="توضیحات"><input value={form.notes} onChange={e => setForm({...form,notes:e.target.value})}/></Field>
    </div><div className="form-hint">مبلغ‌های دو ارز جداگانه ذخیره می‌شوند و هیچ نرخ تبدیلی اعمال نمی‌شود. مصرف فعلاً به حساب دخل متصل نیست.</div><div className="modal-actions"><button type="button" className="btn secondary" disabled={busy} onClick={close}>انصراف</button><button type="submit" className="btn primary" disabled={busy}>{busy ? 'در حال ثبت...' : 'ذخیره معلومات'} <Check size={17}/></button></div></form>
  </div></div>;
}

function EmployeeList({ staff, calendar, loading, edit }: { staff: Employee[]; calendar: Calendar; loading: boolean; edit: (employee: Employee) => void }) {
  const [search, setSearch] = useState('');
  const rows = staff.filter(e => `${e.code} ${e.name} ${e.father_name} ${e.job_title} ${e.phone}`.toLowerCase().includes(search.toLowerCase()));
  return <section className="panel listing"><div className="panel-head list-header"><div><h2>فهرست کارمندان</h2><p>{staff.length} کارمند ثبت شده · {staff.filter(e => e.status === 'active').length} فعال</p></div><label className="search"><Search size={17}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="جستجو..." aria-label="جستجوی کارمندان"/></label></div>
    <div className="table-wrap"><table><thead><tr><th>نام کارمند</th><th>کد</th><th>وظیفه</th><th>تاریخ استخدام</th><th>معاش پایه</th><th>وضعیت</th><th>عملیات</th></tr></thead><tbody>{rows.map(e => <tr key={e.id}><td><div className="person"><span className="person-avatar">{e.name.slice(0,1)}</span><b>{e.name}</b></div></td><td><span className="code" dir="ltr">{e.code}</span></td><td>{e.job_title || '—'}</td><td><span className="code" dir="ltr">{e.hire_date ? displayCalendarDate(e.hire_date, calendar) : '—'}</span></td><td><b dir="ltr">{displayMoney(e.base_salary)}</b> <span className="unit">افغانی</span></td><td><span className={`badge ${e.status === 'active' ? 'good' : 'warn'}`}>{e.status === 'active' ? 'فعال' : 'غیرفعال'}</span></td><td><button className="text-button" onClick={() => edit(e)}>ویرایش</button></td></tr>)}</tbody></table>{!rows.length && <div className="empty">{loading ? 'در حال بارگذاری...' : 'کارمندی برای نمایش وجود ندارد.'}</div>}</div>
  </section>;
}
function EmployeeModal({ employee, calendar, close, saved }: { employee: Employee | 'new'; calendar: Calendar; close: () => void; saved: () => Promise<void> }) {
  const initial: EmployeeInput = employee === 'new' ? {code:'',name:'',father_name:'',job_title:'',hire_date:null,base_salary:'0',phone:'',status:'active'} : { ...employee };
  const [data, setData] = useState<EmployeeInput>(initial);
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => { e.preventDefault(); setBusy(true); setError(''); try { await store.saveEmployee(employee === 'new' ? null : employee.id, data); await saved(); } catch (err) { setError(String(err)); } finally { setBusy(false); } };
  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget && !busy) close(); }}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="employee-title"><div className="modal-head"><div><span className="eyebrow"><span/> مدیریت کارمندان</span><h2 id="employee-title">{employee === 'new' ? 'کارمند جدید' : 'ویرایش کارمند'}</h2><p>معلومات کارمند را وارد کنید.</p></div><button className="icon-button" disabled={busy} aria-label="بستن" onClick={close}><X size={20}/></button></div>
    <form onSubmit={submit}>{error && <div className="error" role="alert">{error}</div>}<div className="form-grid">
      <Field label="کد کارمند" required><input required value={data.code} onChange={e=>setData({...data,code:e.target.value})}/></Field>
      <Field label="نام و تخلص" required><input required value={data.name} onChange={e=>setData({...data,name:e.target.value})}/></Field>
      <Field label="نام پدر"><input value={data.father_name} onChange={e=>setData({...data,father_name:e.target.value})}/></Field>
      <Field label="وظیفه"><input value={data.job_title} onChange={e=>setData({...data,job_title:e.target.value})}/></Field>
      <DateField key={calendar} calendar={calendar} value={data.hire_date || ''} title="تاریخ استخدام" required={false} onChange={date=>setData({...data,hire_date:date || null})}/>
      <Field label="معاش پایه (افغانی)" required><input required inputMode="decimal" value={data.base_salary} onChange={e=>setData({...data,base_salary:e.target.value})}/></Field>
      <Field label="شماره تماس"><input value={data.phone} onChange={e=>setData({...data,phone:e.target.value})}/></Field>
      <Field label="وضعیت"><select value={data.status} onChange={e=>setData({...data,status:e.target.value as EmployeeInput['status']})}><option value="active">فعال</option><option value="inactive">غیرفعال</option></select></Field>
    </div><div className="form-hint">حذف کارمند در این نسخه انجام نمی‌شود؛ برای حفظ سوابق می‌توانید او را غیرفعال کنید.</div><div className="modal-actions"><button type="button" className="btn secondary" disabled={busy} onClick={close}>انصراف</button><button type="submit" disabled={busy} className="btn primary">{busy ? 'در حال ذخیره...' : 'ذخیره معلومات'} <Check size={17}/></button></div></form>
  </div></div>;
}

function BackupPanel({ onRestored }: { onRestored: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [selection, setSelection] = useState<{path: string; info: BackupInfo} | null>(null);
  const [confirmation, setConfirmation] = useState('');
  const run = async () => {
    setBusy(true); setMessage(''); setError('');
    try { if (await createBackup()) setMessage('فایل پشتیبان ساخته شد و بررسی صحت و ارتباطات آن موفق بود.'); }
    catch (e) { setError(String(e)); }
    finally { setBusy(false); }
  };
  const choose = async () => {
    setBusy(true); setMessage(''); setError(''); setConfirmation('');
    try { const selected = await chooseBackup(); if (selected) setSelection(selected); }
    catch (e) { setError(String(e)); }
    finally { setBusy(false); }
  };
  const restore = async () => {
    if (!selection || confirmation !== 'بازگردانی') return;
    setBusy(true); setMessage(''); setError('');
    try {
      const result = await restoreBackup(selection.path);
      setSelection(null); setConfirmation('');
      setMessage(`بازگردانی انجام شد. نسخهٔ ایمنی وضعیت قبلی: ${result.safety_backup}`);
      try { await onRestored(); } catch { setMessage(`بازگردانی انجام شد، اما تازه‌سازی صفحه ناموفق بود؛ برنامه را دوباره باز کنید. نسخهٔ ایمنی: ${result.safety_backup}`); }
    } catch (e) { setError(String(e)); }
    finally { setBusy(false); }
  };
  return <section className="panel backup-panel">
    <div className="backup-heading"><div className="backup-icon"><Archive size={25}/></div><div><h2>پشتیبان‌گیری و بازگردانی</h2><p>تهیه و بازگردانی فایل SQLite مربوط به نسخهٔ جدید دسکتاپ.</p></div></div>
    <div className="backup-instructions"><b>نکات مهم</b><ul><li>فایل پشتیبان جدید نباید از قبل وجود داشته باشد.</li><li>فایل‌ها رمزگذاری نشده‌اند؛ آن‌ها را در محل امن نگه دارید.</li><li>این بخش با دیتابیس یا فایل SQL برنامهٔ PHP قدیمی سازگار نیست.</li><li>برنامه هنوز آزمایشی است؛ برای اطلاعات واقعی به آن تکیه نکنید.</li></ul></div>
    {!inDesktop && <div className="form-hint">در پیش‌نمایش مرورگر هیچ دیتابیس دائمی وجود ندارد و پشتیبان ساخته یا بازگردانی نمی‌شود.</div>}
    {message && <div className="notice backup-result" role="status"><Check size={17}/>{message}</div>}
    {error && !selection && <div className="error" role="alert">{error}</div>}
    <div className="backup-buttons"><button className="btn primary backup-action" disabled={!inDesktop || busy} onClick={run}><Archive size={17}/>{busy ? 'در حال بررسی...' : 'انتخاب محل و ساخت پشتیبان'}</button><button className="btn secondary backup-action" disabled={!inDesktop || busy} onClick={choose}>انتخاب فایل برای بازگردانی</button></div>
    {selection && <div className="modal-backdrop"><div className="modal" role="dialog" aria-modal="true" aria-labelledby="restore-title">
      <div className="modal-head"><div><span className="eyebrow"><span/> عملیات حساس</span><h2 id="restore-title">تأیید بازگردانی</h2><p>پیش از ادامه معلومات فایل را بررسی کنید.</p></div><button className="icon-button" disabled={busy} aria-label="بستن" onClick={() => setSelection(null)}><X size={20}/></button></div>
      <div className="backup-instructions restore-warning"><b>تمام اطلاعات فعلی نسخهٔ جدید جایگزین می‌شود.</b><p>یک نسخهٔ ایمنی از وضعیت فعلی در پوشهٔ دادهٔ برنامه ساخته می‌شود. فایل در هنگام بازگردانی دوباره بررسی می‌شود.</p><p className="backup-result" dir="auto">{selection.path}</p><p>مشتریان: {selection.info.customers} · فروشات: {selection.info.sales} · رسیدات: {selection.info.receipts} · کارمندان: {selection.info.employees} · مصارف: {selection.info.expenses} · معاشات: {selection.info.salaries} · حضور و غیاب: {selection.info.attendance}</p>{selection.info.schema_version === 1 && <p><b>این فایل قدیمی کارمند ندارد؛ کارمندان فعلی حذف می‌شوند و در نسخهٔ ایمنی باقی می‌مانند.</b></p>}{selection.info.schema_version < 3 && <p><b>این فایل قدیمی مصرف ندارد؛ مصارف فعلی حذف می‌شوند و در نسخهٔ ایمنی باقی می‌مانند.</b></p>}{selection.info.schema_version < 4 && <p><b>این فایل قدیمی معاش ندارد؛ معاشات فعلی حذف می‌شوند و در نسخهٔ ایمنی باقی می‌مانند.</b></p>}{selection.info.schema_version < 5 && <p><b>این فایل قدیمی حضور و غیاب ندارد؛ رکوردهای فعلی حذف می‌شوند و در نسخهٔ ایمنی باقی می‌مانند.</b></p>}</div>
      <label className="field restore-confirm"><span>برای تأیید، کلمهٔ «بازگردانی» را بنویسید</span><input value={confirmation} disabled={busy} onChange={e => setConfirmation(e.target.value)} autoComplete="off"/></label>
      {error && <div className="error" role="alert">{error}</div>}
      <div className="modal-actions"><button className="btn secondary" disabled={busy} onClick={() => setSelection(null)}>انصراف</button><button className="btn danger" disabled={busy || confirmation !== 'بازگردانی'} onClick={restore}>{busy ? 'در حال بازگردانی...' : 'تأیید و بازگردانی'}</button></div>
    </div></div>}
  </section>;
}

function LedgerModal({ customerId, close, calendar }: { customerId: string; close: () => void; calendar: Calendar }) {
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
        <div className="table-wrap"><table><thead><tr><th>{calendar === 'shamsi' ? 'تاریخ شمسی' : 'تاریخ میلادی'}</th><th>شرح</th><th>بدهکار</th><th>بستانکار</th><th>مانده</th></tr></thead><tbody>{ledger.rows.map(row => <tr key={row.id}><td><span dir="ltr" className="code">{displayCalendarDate(row.date, calendar)}</span></td><td>{row.kind === 'sale' ? 'فروش قرضه' : 'رسید'} · {row.detail}{!row.affects_balance && <span className="ledger-note"> بدون تأثیر بر مانده</span>}</td><td dir="ltr" className="ltr-cell">{row.debit === '0.00' ? '—' : displayMoney(row.debit)}</td><td dir="ltr" className="ltr-cell">{row.credit === '0.00' ? '—' : displayMoney(row.credit)}</td><td><b dir="ltr">{displayMoney(row.balance)}</b></td></tr>)}</tbody></table>{!ledger.rows.length && <div className="empty">هنوز گردش حسابی برای این مشتری ثبت نشده است.</div>}</div>
        <div className="form-hint">فروش نقده در این کارت بدهی وارد نمی‌شود. رسید امانت فقط برای اطلاع نمایش داده می‌شود و از مانده کم نمی‌شود.</div></>}
      <div className="modal-actions"><button className="btn secondary" onClick={close}>بستن</button></div>
    </div>
  </div>;
}

function FormModal({ kind, snapshot, customerEdit, transactionEdit, close, saved, calendar }: { kind: Exclude<Modal,null>; snapshot:Snapshot; customerEdit: Customer | null; transactionEdit?: TransactionDetail; close:()=>void; saved:()=>Promise<void>; calendar:Calendar }) {
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const [customer, setCustomer] = useState<CustomerInput>(customerEdit ? { code:customerEdit.code, name:customerEdit.name, phone:customerEdit.phone, opening:customerEdit.opening } : { code:'',name:'',phone:'',opening:'0' });
  const [sale, setSale] = useState<SaleInput>(transactionEdit?.kind === 'sale' ? {customer_id:transactionEdit.customer_id,date:transactionEdit.date,material:transactionEdit.material,volume:transactionEdit.volume,unit_price:transactionEdit.unit_price,freight:transactionEdit.freight,payment_type:transactionEdit.payment_type} : { customer_id:snapshot.customers[0]?.id || '',date:todayKabul(),material:'ماسه اول',volume:'',unit_price:'',freight:'0',payment_type:'cash' });
  const [receipt, setReceipt] = useState<ReceiptInput>(transactionEdit?.kind === 'receipt' ? {customer_id:transactionEdit.customer_id,date:transactionEdit.date,amount:transactionEdit.amount,source:transactionEdit.source} : { customer_id:snapshot.customers[0]?.id || '',date:todayKabul(),amount:'',source:'debt' });
  let total = '—'; try { total = displayMoney(formatScaled(saleTotal(sale.volume, sale.unit_price, sale.freight))); } catch { /* incomplete input */ }
  const submit = async (e:React.FormEvent) => { e.preventDefault(); setError(''); setBusy(true); try { if (kind === 'customer') { if (customerEdit) await store.updateCustomer(customerEdit.id, customer); else await store.addCustomer(customer); } else if (kind === 'sale') { if (transactionEdit?.kind === 'sale') await store.updateSale(transactionEdit.id,sale,{customer_id:transactionEdit.customer_id,date:transactionEdit.date,material:transactionEdit.material,volume:transactionEdit.volume,unit_price:transactionEdit.unit_price,freight:transactionEdit.freight,payment_type:transactionEdit.payment_type}); else await store.addSale(sale); } else { if (transactionEdit?.kind === 'receipt') await store.updateReceipt(transactionEdit.id,receipt,{customer_id:transactionEdit.customer_id,date:transactionEdit.date,amount:transactionEdit.amount,source:transactionEdit.source}); else await store.addReceipt(receipt); } await saved(); } catch(e) { setError(String(e)); } finally { setBusy(false); } };
  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) close(); }}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-head"><div><span className="eyebrow"><span/> ثبت معلومات</span><h2 id="modal-title">{kind === 'customer' ? (customerEdit ? 'ویرایش مشتری' : 'مشتری جدید') : kind === 'sale' ? (transactionEdit ? 'ویرایش فروش' : 'ثبت فروش جدید') : (transactionEdit ? 'ویرایش رسید' : 'ثبت رسید جدید')}</h2><p>لطفاً معلومات زیر را با دقت وارد کنید.</p></div><button className="icon-button" aria-label="بستن" onClick={close}><X size={20}/></button></div><form onSubmit={submit}>
    {error && <div className="error" role="alert">{error}</div>}
    {kind === 'customer' ? <div className="form-grid"><Field label="کد مشتری" required><input required value={customer.code} onChange={e=>setCustomer({...customer,code:e.target.value})} placeholder="مثلاً CUS-001"/></Field><Field label="نام مشتری / شرکت" required><input required value={customer.name} onChange={e=>setCustomer({...customer,name:e.target.value})} placeholder="نام مشتری"/></Field><Field label="شماره تماس"><input value={customer.phone} onChange={e=>setCustomer({...customer,phone:e.target.value})} placeholder="شماره تماس"/></Field><Field label="بدهی اولیه (افغانی)"><input inputMode="decimal" value={customer.opening} onChange={e=>setCustomer({...customer,opening:e.target.value})}/></Field></div> : <>
      {!snapshot.customers.length && <div className="form-hint">ابتدا یک مشتری ثبت کنید.</div>}
      <div className="form-grid"><Field label="مشتری" required><select required value={kind === 'sale' ? sale.customer_id : receipt.customer_id} onChange={e=>kind==='sale'?setSale({...sale,customer_id:e.target.value}):setReceipt({...receipt,customer_id:e.target.value})}><option value="">انتخاب مشتری</option>{snapshot.customers.map(c=><option value={c.id} key={c.id}>{c.name} ({c.code})</option>)}</select></Field><DateField key={calendar} calendar={calendar} value={kind === 'sale' ? sale.date : receipt.date} onChange={date=>kind==='sale'?setSale({...sale,date}):setReceipt({...receipt,date})}/>
      {kind === 'sale' ? <><Field label="نوع مواد" required><select value={sale.material} onChange={e=>setSale({...sale,material:e.target.value})}>{!['ماسه اول','ماسه دوم','ریگ','سنگ غرقه','خاک','خامه','ماشک','ریگ باد','سنگ پارچاو','چسنی','کانکریت','سی منټ','دیگر'].includes(sale.material) && <option value={sale.material}>{sale.material}</option>}{['ماسه اول','ماسه دوم','ریگ','سنگ غرقه','خاک','خامه','ماشک','ریگ باد','سنگ پارچاو','چسنی','کانکریت','سی منټ','دیگر'].map(x=><option key={x}>{x}</option>)}</select></Field><Field label="نوع پرداخت"><select value={sale.payment_type} onChange={e=>setSale({...sale,payment_type:e.target.value as SaleInput['payment_type']})}><option value="cash">نقده</option><option value="credit">باقی</option></select></Field><Field label="متراژ (متر مکعب)" required><input required inputMode="decimal" value={sale.volume} onChange={e=>setSale({...sale,volume:e.target.value})} placeholder="مثلاً ۱۰"/></Field><Field label="قیمت فی متر (افغانی)" required><input required inputMode="decimal" value={sale.unit_price} onChange={e=>setSale({...sale,unit_price:e.target.value})} placeholder="۰"/></Field><Field label="کرایه فی متر (افغانی)"><input inputMode="decimal" value={sale.freight} onChange={e=>setSale({...sale,freight:e.target.value})}/></Field><div className="total-box"><span>مجموع فروش</span><b>{total} <small>افغانی</small></b></div></> : <><Field label="مبلغ رسید (افغانی)" required><input required inputMode="decimal" value={receipt.amount} onChange={e=>setReceipt({...receipt,amount:e.target.value})} placeholder="۰"/></Field><Field label="منبع رسید"><select value={receipt.source} onChange={e=>setReceipt({...receipt,source:e.target.value as ReceiptInput['source']})}><option value="debt">باقی داری</option><option value="deposit">امانت (بدون تأثیر بر بدهی)</option><option value="statement">بیانیه</option><option value="advance">پیش پرداخت</option></select></Field></>}
      </div></>}
    {transactionEdit && <div className="form-hint salary-warning">تغییر این سند می‌تواند ماندهٔ حساب و کارت حساب مشتری را عوض کند. سابقهٔ تغییرات و مجوز کاربران هنوز ثبت نمی‌شود؛ پیش از ذخیره بررسی کنید.</div>}
    <div className="form-hint">{kind === 'sale' ? 'مجموع = متراژ × (قیمت فی متر + کرایه فی متر)' : kind === 'receipt' ? 'رسید امانت از ماندهٔ بدهی مشتری کم نمی‌شود.' : customerEdit ? 'تغییر بدهی اولیه ماندهٔ حساب و مانده‌های کارت حساب را تغییر می‌دهد؛ سوابق فروش و رسید حفظ می‌شوند.' : 'ماندهٔ حساب از بدهی اولیه، فروش قرضه و رسیدهای مؤثر محاسبه می‌شود.'}</div><div className="modal-actions"><button type="button" className="btn secondary" onClick={close}>انصراف</button><button type="submit" disabled={busy || (kind !== 'customer' && !snapshot.customers.length)} className="btn primary">{busy ? 'در حال ثبت...' : 'ذخیره معلومات'} <Check size={17}/></button></div>
  </form></div></div>;
}
function DateField({ calendar, value, onChange, required = true, title }: { calendar: Calendar; value: string; onChange: (iso: string) => void; required?: boolean; title?: string }) {
  const [text, setText] = useState(() => displayCalendarDate(value, calendar));
  const [invalid, setInvalid] = useState(false);
  const label = title ? `${title} (${calendar === 'shamsi' ? 'شمسی' : 'میلادی'})` : calendar === 'shamsi' ? 'تاریخ شمسی' : 'تاریخ میلادی';
  return <Field label={label} required={required}><input required={required} type="text" inputMode="numeric" dir="ltr" value={text}
    placeholder={calendar === 'shamsi' ? '1405/01/01' : '2026/03/21'} aria-invalid={invalid}
    onChange={e => {
      const next = e.target.value;
      const parsed = parseCalendarDate(next, calendar);
      const bad = next.trim() !== '' && !parsed;
      e.target.setCustomValidity(bad ? 'تاریخ معتبر وارد کنید.' : '');
      setInvalid(bad); setText(next); onChange(parsed ?? '');
    }}
    onBlur={() => { const parsed = parseCalendarDate(text, calendar); if (parsed) setText(displayCalendarDate(parsed, calendar)); }}/></Field>;
}
function Field({label,required,children}:{label:string;required?:boolean;children:React.ReactNode}) { return <label className="field"><span>{label} {required && <i>*</i>}</span>{children}</label>; }

createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
