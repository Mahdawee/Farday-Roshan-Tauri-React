import { invoke, isTauri } from '@tauri-apps/api/core';
import { normalizeDateDigits } from './calendar';
import { Customer, CustomerInput, Employee, Expense, Salary, Attendance, TransactionPage, TransactionDetail, Entry, Ledger, formatScaled, parseScaled, ReceiptInput, SaleInput, saleTotal, salaryTotal, validSalaryPeriod, Snapshot, Store, RangeSummary, SaleDetails, ReceiptDetails } from './domain';

const tauriStore: Store = {
  rangeSummary: (from,to) => invoke<RangeSummary>('range_summary', {from,to}),
  snapshot: () => invoke<Snapshot>('snapshot'),
  transactions: query => invoke<TransactionPage>('list_transactions', { query }),
  transactionDetail: (kind,id) => invoke<TransactionDetail>('transaction_detail', { kind,id }),
  attendance: () => invoke<Attendance[]>('list_attendance'),
  createAttendanceBatch: (workDate, rows) => invoke('create_attendance_batch', { workDate, rows }),
  saveAttendance: (id, input) => invoke('save_attendance', { id, input }),
  salaries: () => invoke<Salary[]>('list_salaries'),
  saveSalary: (id, input) => invoke('save_salary', { id, input }),
  expenses: () => invoke<Expense[]>('list_expenses'),
  saveExpense: (id, input) => invoke('save_expense', { id, input }),
  employees: () => invoke<Employee[]>('list_employees'),
  saveEmployee: (id, input) => invoke('save_employee', { id, input }),
  ledger: customerId => invoke<Ledger>('customer_ledger', { customerId }),
  addCustomer: input => invoke('add_customer', { input }),
  updateCustomer: (id, input) => invoke('update_customer', { id, input }),
  addSale: input => invoke('add_sale', { input }),
  updateSale: (id,input,expected) => invoke('update_sale', { id,input,expected }),
  addReceipt: input => invoke('add_receipt', { input }),
  updateReceipt: (id,input,expected) => invoke('update_receipt', { id,input,expected }),
};

// Explicitly temporary browser preview. It never touches the real database.
export function createDemoStore(seed = true): Store {
  const customers: Customer[] = [
    { id: 'demo-1', code: 'CUS-001', name: 'شرکت ساختمانی امید', phone: '0700 123 456', opening: '0.00', balance: '42000.00' },
    { id: 'demo-2', code: 'CUS-002', name: 'احمد رحمانی', phone: '0799 456 123', opening: '0.00', balance: '18000.00' },
    { id: 'demo-3', code: 'CUS-003', name: 'موسسه راه و ساختمان', phone: '0788 321 654', opening: '0.00', balance: '0.00' },
  ];
  const staff: Employee[] = seed ? [{ id: 'demo-staff-1', code: 'EMP-001', name: 'احمد احمدی', father_name: 'کریم', job_title: 'راننده', hire_date: '2025-03-21', base_salary: '15000.00', phone: '0700123456', status: 'active' }] : [];
  const attendance: Attendance[] = [];
  const salaries: Salary[] = [];
  const expenses: Expense[] = [];
  type DemoEntry = Entry & { document_number:string; customer_id: string; affects_balance: boolean; subtype: string; sale?: { material:string; volume:string; unit_price:string; freight:string; details?:SaleDetails }; receiptDetails?:ReceiptDetails };
  const entries: DemoEntry[] = [
    { id: 'demo-e1', document_number:'S-000002', customer_id: 'demo-1', subtype: 'credit', sale: {material:'ماسه اول',volume:'90.000',unit_price:'600.00',freight:'0.00'}, affects_balance: true, kind: 'sale', date: '2026-11-08', customer_name: 'شرکت ساختمانی امید', detail: 'ماسه اول · باقی', amount: '54000.00' },
    { id: 'demo-e2', document_number:'R-000001', customer_id: 'demo-1', subtype: 'debt', affects_balance: true, kind: 'receipt', date: '2026-11-07', customer_name: 'شرکت ساختمانی امید', detail: 'باقی داری', amount: '12000.00' },
    { id: 'demo-e3', document_number:'S-000001', customer_id: 'demo-2', subtype: 'credit', sale: {material:'ریگ',volume:'30.000',unit_price:'600.00',freight:'0.00'}, affects_balance: true, kind: 'sale', date: '2026-11-06', customer_name: 'احمد رحمانی', detail: 'ریگ · باقی', amount: '18000.00' },
  ];
  let credit = 7200000n, receipts = 1200000n; let saleNumber=seed ? 2 : 0, receiptNumber=seed ? 1 : 0;
  if (!seed) { customers.length = 0; entries.length = 0; credit = 0n; receipts = 0n; }
  const storedCents = (value: string): bigint => {
    const negative = value.startsWith('-');
    const [whole, fraction] = (negative ? value.slice(1) : value).split('.');
    const amount = BigInt(whole) * 100n + BigInt((fraction ?? '').padEnd(2, '0'));
    return negative ? -amount : amount;
  };
  const text=(value:string, limit:number) => { const v=value.trim(); if (new TextEncoder().encode(v).length>limit) throw new Error('متن واردشده بیش از حد طولانی است.'); return v; };
  const saleDetails=(d?:SaleDetails):SaleDetails => ({bill_no:text(d?.bill_no ?? '',160),driver_name:text(d?.driver_name ?? '',320),vehicle_plate:text(d?.vehicle_plate ?? '',160),destination:text(d?.destination ?? '',320),notes:text(d?.notes ?? '',4000)});
  const receiptDetails=(d?:ReceiptDetails):ReceiptDetails => ({related_bill_no:text(d?.related_bill_no ?? '',160),received_by:text(d?.received_by ?? '',320),notes:text(d?.notes ?? '',4000)});
  const update = (id: string, amount: bigint) => {
    const c = customers.find(x => x.id === id);
    if (!c) throw new Error('مشتری انتخاب‌شده وجود ندارد.');
    const balance = storedCents(c.balance);
    c.balance = formatScaled(balance + amount);
    return c;
  };
  const validateDate = (date: string) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
    if (!m) throw new Error('تاریخ میلادی معتبر وارد کنید.');
    const d = new Date(`${date}T00:00:00Z`);
    if (Number(m[1]) < 1 || !Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== date) throw new Error('تاریخ میلادی معتبر وارد کنید.');
  };
  return {
    async rangeSummary(from,to) {
      validateDate(from); validateDate(to); if (from>to) throw new Error('تاریخ آغاز نباید پس از تاریخ پایان باشد.');
      const within=(date:string)=>date>=from && date<=to;
      const sales=entries.filter(e=>e.kind==='sale' && within(e.date));
      const receipts=entries.filter(e=>e.kind==='receipt' && within(e.date));
      const ex=expenses.filter(e=>within(e.date)); const sal=salaries.filter(s=>within(s.pay_date));
      const sum=(values:string[])=>formatScaled(values.reduce((n,v)=>n+storedCents(v),0n));
      return {
        sales_count:sales.length, sales_cash:sum(sales.filter(e=>e.subtype==='cash').map(e=>e.amount)), sales_credit:sum(sales.filter(e=>e.subtype==='credit').map(e=>e.amount)),
        volume:formatScaled(sales.reduce((n,e)=>n+parseScaled(e.sale!.volume,3),0n),3),
        receipts_count:receipts.length, receipts_effective:sum(receipts.filter(e=>e.subtype!=='deposit').map(e=>e.amount)), receipts_deposit:sum(receipts.filter(e=>e.subtype==='deposit').map(e=>e.amount)),
        expenses_count:ex.length, expenses_afn:sum(ex.map(e=>e.amount_afn)), expenses_usd:sum(ex.map(e=>e.amount_usd)), salaries_count:sal.length, salaries_afn:sum(sal.map(s=>s.total)),
      };
    },
    async snapshot(): Promise<Snapshot> {
      return structuredClone({ customers, entries: entries.slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,100), credit_sales: formatScaled(credit), receipts: formatScaled(receipts), total_balance: formatScaled(customers.reduce((a,c) => a + storedCents(c.balance), 0n)) });
    },
    async transactions(query) {
      if (!['sale','receipt'].includes(query.kind) || !Number.isInteger(query.page) || query.page<0 || query.page>1000000 || new TextEncoder().encode(query.search).length>320) throw new Error('صفحه یا متن جستجو معتبر نیست.');
      if (query.customer_id !== null && (!query.customer_id.trim() || new TextEncoder().encode(query.customer_id).length>80)) throw new Error('مشتری انتخاب‌شده معتبر نیست.');
      if (query.subtype !== null && !(query.kind==='sale' ? ['cash','credit'] : ['debt','deposit','statement','advance']).includes(query.subtype)) throw new Error('فیلتر نوع عملیات معتبر نیست.');
      if (query.from) validateDate(query.from); if (query.to) validateDate(query.to);
      if (query.from && query.to && query.from>query.to) throw new Error('تاریخ آغاز نباید پس از تاریخ پایان باشد.');
      const lowerAscii=(text:string)=>text.replace(/[A-Z]/g,c=>c.toLowerCase());
      const search=lowerAscii(query.search.trim());
      const rows=entries.filter(e=>e.kind===query.kind && (!query.customer_id || e.customer_id===query.customer_id) && (!query.subtype || e.subtype===query.subtype) && (!query.from || e.date>=query.from) && (!query.to || e.date<=query.to)).map(e=>({...e,customer_code:customers.find(c=>c.id===e.customer_id)?.code || ''})).filter(e=>[e.customer_name,e.customer_code,e.detail,e.date,e.document_number,Object.values(e.kind==='sale'?saleDetails(e.sale?.details):receiptDetails(e.receiptDetails)).join(' ')].some(s=>lowerAscii(s).includes(search))).sort((a,b)=>b.date.localeCompare(a.date));
      return structuredClone({ rows:rows.slice(query.page*25,query.page*25+25), total:rows.length, page:query.page, page_size:25 });
    },
    async transactionDetail(kind,id) {
      const entry=entries.find(e=>e.kind===kind && e.id===id); if (!entry) throw new Error('عملیات انتخاب‌شده وجود ندارد.');
      const customer=customers.find(c=>c.id===entry.customer_id); if (!customer) throw new Error('مشتری انتخاب‌شده وجود ندارد.');
      const common={id:entry.id,document_number:entry.document_number,customer_id:customer.id,date:entry.date,customer_name:customer.name,customer_code:customer.code};
      if (kind==='sale' && entry.sale) return structuredClone({kind:'sale',...common,...entry.sale,details:saleDetails(entry.sale.details),total:entry.amount,payment_type:entry.subtype as 'cash' | 'credit'});
      if (kind==='receipt') return structuredClone({kind:'receipt',...common,amount:entry.amount,source:entry.subtype as ReceiptInput['source'],details:receiptDetails(entry.receiptDetails)});
      throw new Error('نوع عملیات معتبر نیست.');
    },
    async attendance() {
      return structuredClone(attendance.map(a => { const e=staff.find(employee=>employee.id===a.employee_id); return e ? {...a,employee_name:e.name,employee_code:e.code} : a; }).sort((a,b)=>b.work_date.localeCompare(a.work_date)));
    },
    async createAttendanceBatch(workDate,rows) {
      validateDate(workDate);
      if (!rows.length || rows.length>500) throw new Error('ورق باید بین ۱ تا ۵۰۰ کارمند داشته باشد.');
      const ids=new Set<string>();
      for (const row of rows) {
        if (!row.employee_id.trim() || ids.has(row.employee_id) || !['present','absent','leave','sick','holiday','friday'].includes(row.status)) throw new Error('کارمندان یا وضعیت‌های ورق معتبر نیستند.');
        ids.add(row.employee_id);
        const employee=staff.find(e=>e.id===row.employee_id);
        if (!employee || employee.status!=='active') throw new Error('کارمند انتخاب‌شده وجود ندارد یا غیرفعال است؛ هیچ ردیفی ذخیره نشد.');
        if (attendance.some(a=>a.employee_id===row.employee_id && a.work_date===workDate)) throw new Error('برای این کارمند در این تاریخ قبلاً حضور ثبت شده است؛ رکورد موجود را ویرایش کنید.');
      }
      const newRows=rows.map(row=>{const employee=staff.find(e=>e.id===row.employee_id)!; return {id:crypto.randomUUID(),employee_id:row.employee_id,employee_name:employee.name,employee_code:employee.code,work_date:workDate,status:row.status,check_in:null,check_out:null,overtime:'0.00',notes:''};});
      attendance.unshift(...newRows);
    },
    async saveAttendance(id,input) {
      validateDate(input.work_date);
      if (!['present','absent','leave','sick','holiday','friday'].includes(input.status)) throw new Error('وضعیت حضور معتبر نیست.');
      const employee=staff.find(e=>e.id===input.employee_id); if (!employee) throw new Error('کارمند انتخاب‌شده وجود ندارد.');
      if (attendance.some(a=>a.id!==id && a.employee_id===input.employee_id && a.work_date===input.work_date)) throw new Error('برای این کارمند در این تاریخ قبلاً حضور ثبت شده است؛ رکورد موجود را ویرایش کنید.');
      const time=(raw: string | null) => { const text=normalizeDateDigits((raw || '').trim()); if (!text) return null; if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(text)) throw new Error('ساعت معتبر به شکل ۲۴ ساعته، مانند 08:30 وارد کنید.'); return text; };
      const overtime=parseScaled(input.overtime,2); if (overtime>99999n) throw new Error('اضافه‌کاری نباید بیشتر از ۹۹۹٫۹۹ ساعت باشد.');
      const notes=input.notes.trim(); if (new TextEncoder().encode(notes).length>1020) throw new Error('ملاحظات بیش از حد طولانی است.');
      const record:Attendance={...input,check_in:time(input.check_in),check_out:time(input.check_out),overtime:formatScaled(overtime),notes,employee_name:employee.name,employee_code:employee.code,id:id || crypto.randomUUID()};
      if (id) { const index=attendance.findIndex(a=>a.id===id); if (index<0) throw new Error('رکورد حضور انتخاب‌شده وجود ندارد.'); attendance[index]=record; }
      else attendance.unshift(record);
    },
    async salaries() {
      return structuredClone(salaries.map(s => { const e = staff.find(employee => employee.id === s.employee_id); return e ? { ...s, employee_name:e.name, employee_code:e.code } : s; }).sort((a,b) => b.pay_date.localeCompare(a.pay_date)));
    },
    async saveSalary(id, input) {
      validateDate(input.pay_date);
      if (!validSalaryPeriod(input.period_calendar, input.period_year, input.period_month)) throw new Error('دورهٔ معاش معتبر نیست.');
      if (!['cash','transfer'].includes(input.payment_type)) throw new Error('نوع پرداخت معتبر نیست.');
      const employee = staff.find(e => e.id === input.employee_id);
      if (!employee) throw new Error('کارمند انتخاب‌شده وجود ندارد.');
      const payer=input.payer.trim(), notes=input.notes.trim();
      const bytes=(s:string) => new TextEncoder().encode(s).length;
      if (bytes(payer)>320 || bytes(notes)>4000) throw new Error('متن واردشده بیش از حد طولانی است.');
      const total=salaryTotal(input.base,input.bonus,input.fine,input.overtime);
      const salary: Salary = { ...input, payer, notes, base:formatScaled(parseScaled(input.base,2)), bonus:formatScaled(parseScaled(input.bonus,2)), fine:formatScaled(parseScaled(input.fine,2)), overtime:formatScaled(parseScaled(input.overtime,2)), total:formatScaled(total), employee_name:employee.name, employee_code:employee.code, id:id || crypto.randomUUID() };
      if (id) { const index=salaries.findIndex(s=>s.id===id); if (index<0) throw new Error('معاش انتخاب‌شده وجود ندارد.'); salaries[index]=salary; }
      else salaries.unshift(salary);
    },
    async expenses() { return structuredClone(expenses.slice().sort((a,b) => b.date.localeCompare(a.date))); },
    async saveExpense(id, input) {
      validateDate(input.date);
      const fields = { description: input.description.trim(), expense_type: input.expense_type.trim(), purchase_bill_no: input.purchase_bill_no.trim(), shop_name: input.shop_name.trim(), payer: input.payer.trim(), notes: input.notes.trim() };
      if (!fields.description) throw new Error('شرح مصرف الزامی است.');
      const bytes = (s: string) => new TextEncoder().encode(s).length;
      if (bytes(fields.description) > 1000 || bytes(fields.expense_type) > 320 || bytes(fields.purchase_bill_no) > 320 || bytes(fields.shop_name) > 320 || bytes(fields.payer) > 320 || bytes(fields.notes) > 4000) throw new Error('متن واردشده بیش از حد طولانی است.');
      if (!['cash','credit'].includes(input.payment_method)) throw new Error('روش پرداخت معتبر نیست.');
      const afn = parseScaled(input.amount_afn, 2), usd = parseScaled(input.amount_usd, 2);
      if (afn === 0n && usd === 0n) throw new Error('حداقل یکی از مبلغ‌های افغانی یا دالری باید بیشتر از صفر باشد.');
      const expense: Expense = { ...input, ...fields, amount_afn: formatScaled(afn), amount_usd: formatScaled(usd), id: id || crypto.randomUUID() };
      if (id) {
        const index = expenses.findIndex(e => e.id === id);
        if (index < 0) throw new Error('مصرف انتخاب‌شده وجود ندارد.');
        expenses[index] = expense;
      } else expenses.unshift(expense);
    },
    async employees() { return structuredClone(staff); },
    async saveEmployee(id, input) {
      const code = input.code.trim(), name = input.name.trim();
      if (!code || !name) throw new Error('کد و نام کارمند الزامی است.');
      if (staff.some(e => e.id !== id && e.code.toLowerCase() === code.toLowerCase())) throw new Error('کد کارمند قبلاً ثبت شده است.');
      if (input.hire_date) validateDate(input.hire_date);
      const base_salary = formatScaled(parseScaled(input.base_salary, 2));
      const employee = { ...input, code, name, base_salary, id: id || crypto.randomUUID() };
      if (id) {
        const index = staff.findIndex(e => e.id === id);
        if (index < 0) throw new Error('کارمند انتخاب‌شده وجود ندارد.');
        staff[index] = employee;
      } else staff.push(employee);
    },
    async ledger(customerId): Promise<Ledger> {
      const customer = customers.find(c => c.id === customerId);
      if (!customer) throw new Error('مشتری انتخاب‌شده وجود ندارد.');
      let balance = storedCents(customer.opening);
      const events = entries.slice().reverse().filter(e => e.customer_id === customerId && (e.kind === 'receipt' || e.affects_balance)).sort((a,b) => a.date.localeCompare(b.date));
      const rows = events.map(e => {
        const amount = storedCents(e.amount);
        const debit = e.kind === 'sale' ? amount : 0n;
        const credit = e.kind === 'receipt' ? amount : 0n;
        if (e.affects_balance) balance += debit - credit;
        return { id:e.id, date:e.date, kind:e.kind, detail:e.detail, debit:formatScaled(debit), credit:formatScaled(credit), affects_balance:e.affects_balance, balance:formatScaled(balance) };
      });
      return { customer_name: customer.name, customer_code: customer.code, opening: customer.opening, balance: formatScaled(balance), rows };
    },
    async addCustomer(input) {
      const code = input.code.trim(), name = input.name.trim();
      if (!code || !name) throw new Error('کد و نام مشتری الزامی است.');
      if (customers.some(c => c.code.toLowerCase() === code.toLowerCase())) throw new Error('کد مشتری قبلاً ثبت شده است.');
      const opening = parseScaled(input.opening, 2);
      customers.push({ ...input, code, name, opening: formatScaled(opening), balance: formatScaled(opening), id: crypto.randomUUID() });
    },
    async updateCustomer(id, input) {
      const code = input.code.trim(), name = input.name.trim();
      if (!code || !name) throw new Error('کد و نام مشتری الزامی است.');
      if (customers.some(c => c.id !== id && c.code.toLowerCase() === code.toLowerCase())) throw new Error('کد مشتری قبلاً ثبت شده است.');
      const customer = customers.find(c => c.id === id);
      if (!customer) throw new Error('مشتری انتخاب‌شده وجود ندارد.');
      const opening = parseScaled(input.opening, 2);
      const balance = storedCents(customer.balance) - storedCents(customer.opening) + opening;
      Object.assign(customer, { ...input, code, name, opening: formatScaled(opening), balance: formatScaled(balance) });
      for (const entry of entries) if (entry.customer_id === id) entry.customer_name = name;
    },
    async addSale(input) {
      validateDate(input.date);
      if (!input.material.trim() || new TextEncoder().encode(input.material.trim()).length>200 || !['cash','credit'].includes(input.payment_type)) throw new Error('معلومات فروش معتبر نیست.');
      const details=saleDetails(input.details);
      const total = saleTotal(input.volume, input.unit_price, input.freight);
      const c = update(input.customer_id, input.payment_type === 'credit' ? total : 0n);
      if (input.payment_type === 'credit') credit += total;
      entries.unshift({ id: crypto.randomUUID(), document_number:`S-${String(++saleNumber).padStart(6,'0')}`, customer_id: c.id, subtype: input.payment_type, sale: {material:input.material.trim(),volume:formatScaled(parseScaled(input.volume,3),3),unit_price:formatScaled(parseScaled(input.unit_price,2)),freight:formatScaled(parseScaled(input.freight,2)),details}, affects_balance: input.payment_type === 'credit', kind: 'sale', date: input.date, customer_name: c.name, detail: `${input.material} · ${input.payment_type === 'credit' ? 'باقی' : 'نقده'}`, amount: formatScaled(total) });
    },
    async updateSale(id, input, expected) {
      const validate=(s: SaleInput) => { validateDate(s.date); if (!s.material.trim() || new TextEncoder().encode(s.material.trim()).length>200 || !['cash','credit'].includes(s.payment_type)) throw new Error('معلومات فروش معتبر نیست.'); return saleTotal(s.volume,s.unit_price,s.freight); };
      const total=validate(input), oldTotal=validate(expected); const details=saleDetails(input.details), oldDetails=saleDetails(expected.details);
      const entry=entries.find(e=>e.id===id && e.kind==='sale');
      const original=entry?.sale;
      if (!entry || !original || entry.customer_id!==expected.customer_id || entry.date!==expected.date || entry.subtype!==expected.payment_type || original.material!==expected.material.trim() || parseScaled(original.volume,3)!==parseScaled(expected.volume,3) || parseScaled(original.unit_price,2)!==parseScaled(expected.unit_price,2) || parseScaled(original.freight,2)!==parseScaled(expected.freight,2) || storedCents(entry.amount)!==oldTotal || JSON.stringify(saleDetails(original.details))!==JSON.stringify(oldDetails)) throw new Error('فروش تغییر کرده یا وجود ندارد؛ جزئیات را دوباره باز کنید.');
      if (!customers.some(c=>c.id===input.customer_id)) throw new Error('مشتری انتخاب‌شده وجود ندارد.');
      if (entry.subtype==='credit') { update(entry.customer_id,-oldTotal); credit-=oldTotal; }
      if (input.payment_type==='credit') { update(input.customer_id,total); credit+=total; }
      const c=customers.find(c=>c.id===input.customer_id)!;
      Object.assign(entry,{customer_id:c.id,customer_name:c.name,date:input.date,subtype:input.payment_type,affects_balance:input.payment_type==='credit',detail:`${input.material.trim()} · ${input.payment_type==='credit' ? 'باقی' : 'نقده'}`,amount:formatScaled(total),sale:{material:input.material.trim(),volume:formatScaled(parseScaled(input.volume,3),3),unit_price:formatScaled(parseScaled(input.unit_price,2)),freight:formatScaled(parseScaled(input.freight,2)),details}});
    },
    async addReceipt(input) {
      validateDate(input.date);
      const amount = parseScaled(input.amount, 2);
      if (!amount || !['debt','deposit','statement','advance'].includes(input.source)) throw new Error('معلومات رسید معتبر نیست.');
      const details=receiptDetails(input.details);
      const c = update(input.customer_id, input.source === 'deposit' ? 0n : -amount);
      receipts += amount;
      const labels = { debt: 'باقی داری', deposit: 'امانت', statement: 'بیانیه', advance: 'پیش پرداخت' };
      entries.unshift({ id: crypto.randomUUID(), document_number:`R-${String(++receiptNumber).padStart(6,'0')}`, customer_id: c.id, subtype: input.source, affects_balance: input.source !== 'deposit', kind: 'receipt', date: input.date, customer_name: c.name, detail: labels[input.source], amount: formatScaled(amount), receiptDetails:details });
    },
    async updateReceipt(id, input, expected) {
      const validate=(r: ReceiptInput) => { validateDate(r.date); const amount=parseScaled(r.amount,2); if (!amount || !['debt','deposit','statement','advance'].includes(r.source)) throw new Error('معلومات رسید معتبر نیست.'); return amount; };
      const amount=validate(input), oldAmount=validate(expected); const details=receiptDetails(input.details), oldDetails=receiptDetails(expected.details);
      const entry=entries.find(e=>e.id===id && e.kind==='receipt');
      if (!entry || entry.customer_id!==expected.customer_id || entry.date!==expected.date || entry.subtype!==expected.source || storedCents(entry.amount)!==oldAmount || JSON.stringify(receiptDetails(entry.receiptDetails))!==JSON.stringify(oldDetails)) throw new Error('رسید تغییر کرده یا وجود ندارد؛ جزئیات را دوباره باز کنید.');
      if (!customers.some(c=>c.id===input.customer_id)) throw new Error('مشتری انتخاب‌شده وجود ندارد.');
      if (entry.subtype!=='deposit') update(entry.customer_id,oldAmount);
      if (input.source!=='deposit') update(input.customer_id,-amount);
      receipts+=amount-oldAmount;
      const c=customers.find(c=>c.id===input.customer_id)!; const labels={debt:'باقی داری',deposit:'امانت',statement:'بیانیه',advance:'پیش پرداخت'};
      Object.assign(entry,{customer_id:c.id,customer_name:c.name,date:input.date,subtype:input.source,affects_balance:input.source!=='deposit',detail:labels[input.source],amount:formatScaled(amount),receiptDetails:details});
    },
  };
}

export const inDesktop = isTauri();
// No accidental fake persistence in a production web deployment.
export const store: Store = inDesktop ? tauriStore : import.meta.env.DEV ? createDemoStore() : {
  rangeSummary: async () => { throw new Error('نسخهٔ آنلاین هنوز پیاده‌سازی نشده است.'); },
  transactionDetail: async () => { throw new Error('نسخهٔ آنلاین هنوز پیاده‌سازی نشده است.'); },
  transactions: async () => { throw new Error('نسخهٔ آنلاین هنوز پیاده‌سازی نشده است.'); },
  snapshot: async () => { throw new Error('نسخهٔ آنلاین هنوز پیاده‌سازی نشده است.'); },
  createAttendanceBatch: async () => { throw new Error('نسخهٔ آنلاین هنوز پیاده‌سازی نشده است.'); },
  attendance: async () => { throw new Error('نسخهٔ آنلاین هنوز پیاده‌سازی نشده است.'); },
  saveAttendance: async () => { throw new Error('نسخهٔ آنلاین هنوز پیاده‌سازی نشده است.'); },
  salaries: async () => { throw new Error('نسخهٔ آنلاین هنوز پیاده‌سازی نشده است.'); },
  saveSalary: async () => { throw new Error('نسخهٔ آنلاین هنوز پیاده‌سازی نشده است.'); },
  expenses: async () => { throw new Error('نسخهٔ آنلاین هنوز پیاده‌سازی نشده است.'); },
  saveExpense: async () => { throw new Error('نسخهٔ آنلاین هنوز پیاده‌سازی نشده است.'); },
  employees: async () => { throw new Error('نسخهٔ آنلاین هنوز پیاده‌سازی نشده است.'); },
  saveEmployee: async () => { throw new Error('نسخهٔ آنلاین هنوز پیاده‌سازی نشده است.'); },
  ledger: async () => { throw new Error('نسخهٔ آنلاین هنوز پیاده‌سازی نشده است.'); },
  addCustomer: async () => { throw new Error('نسخهٔ آنلاین هنوز پیاده‌سازی نشده است.'); },
  updateCustomer: async () => { throw new Error('نسخهٔ آنلاین هنوز پیاده‌سازی نشده است.'); },
  updateSale: async () => { throw new Error('نسخهٔ آنلاین هنوز پیاده‌سازی نشده است.'); },
  addSale: async () => { throw new Error('نسخهٔ آنلاین هنوز پیاده‌سازی نشده است.'); },
  updateReceipt: async () => { throw new Error('نسخهٔ آنلاین هنوز پیاده‌سازی نشده است.'); },
  addReceipt: async () => { throw new Error('نسخهٔ آنلاین هنوز پیاده‌سازی نشده است.'); },
};
