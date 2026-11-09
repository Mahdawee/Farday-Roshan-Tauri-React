import { describe, expect, it } from 'vitest';
import { createDemoStore } from '../src/store';

describe('temporary preview workflow', () => {
  it('registers credit sales and only balance-affecting receipts', async () => {
    const s = createDemoStore(false);
    await s.addCustomer({ code: 'C-1', name: 'مشتری', phone: '', opening: '100' });
    const id = (await s.snapshot()).customers[0].id;
    await s.addSale({ customer_id: id, date: '2026-01-01', material: 'ریگ', volume: '10', unit_price: '500', freight: '300', payment_type: 'credit' });
    await s.addSale({ customer_id: id, date: '2026-01-02', material: 'ریگ', volume: '1', unit_price: '50', freight: '0', payment_type: 'cash' });
    await s.addReceipt({ customer_id: id, date: '2026-01-03', amount: '1000', source: 'debt' });
    await s.addReceipt({ customer_id: id, date: '2026-01-03', amount: '500', source: 'deposit' });
    const snapshot = await s.snapshot();
    expect(snapshot.customers[0].balance).toBe('7100.00');
    expect(snapshot.credit_sales).toBe('8000.00');
    expect(snapshot.receipts).toBe('1500.00');
    expect(snapshot.entries).toHaveLength(4);
    const ledger = await s.ledger(id);
    expect(ledger.opening).toBe('100.00');
    expect(ledger.balance).toBe(snapshot.customers[0].balance);
    expect(ledger.rows).toHaveLength(3); // cash sale does not appear
    expect(ledger.rows[2].affects_balance).toBe(false);
    expect(ledger.rows[1].balance).toBe(ledger.rows[2].balance);
    expect(ledger.rows[2].credit).toBe('500.00');
  });
  it('edits a customer while retaining history and recalculating the ledger', async () => {
    const s = createDemoStore(false);
    await s.addCustomer({ code: 'C-1', name: 'اول', phone: '', opening: '100' });
    await s.addCustomer({ code: 'C-2', name: 'دوم', phone: '', opening: '0' });
    const id = (await s.snapshot()).customers[0].id;
    await s.addSale({ customer_id: id, date: '2026-01-01', material: 'ریگ', volume: '1', unit_price: '500', freight: '0', payment_type: 'credit' });
    await expect(s.updateCustomer(id, { code: 'c-2', name: 'تغییر', phone: '', opening: '200' })).rejects.toThrow();
    await s.updateCustomer(id, { code: 'C-1', name: 'ویرایش', phone: '0700', opening: '200' });
    const ledger = await s.ledger(id);
    expect(ledger.customer_name).toBe('ویرایش');
    expect(ledger.balance).toBe('700.00');
    expect(ledger.rows).toHaveLength(1);
    expect((await s.snapshot()).entries[0].customer_name).toBe('ویرایش');
    await expect(s.updateCustomer('missing', { code: 'C-3', name: 'سوم', phone: '', opening: '0' })).rejects.toThrow();
  });
  it('rejects duplicates and invalid dates without changing data', async () => {
    const s = createDemoStore(false);
    const customer = { code: 'C-1', name: 'مشتری', phone: '', opening: '0' };
    await s.addCustomer(customer);
    await expect(s.addCustomer({ ...customer, code: 'c-1' })).rejects.toThrow();
    const id = (await s.snapshot()).customers[0].id;
    await expect(s.addReceipt({ customer_id: id, date: '2025-02-29', amount: '5', source: 'debt' })).rejects.toThrow();
    expect((await s.snapshot()).entries).toHaveLength(0);
    await expect(s.ledger('missing')).rejects.toThrow();
  });
});

describe('employee records', () => {
  it('creates, edits and deactivates without losing the record', async () => {
    const s = createDemoStore(false);
    const employee = { code:'EMP-1', name:'کارمند', father_name:'پدر', job_title:'راننده', hire_date:'2025-03-21', base_salary:'۱۵۰۰۰.۵۰', phone:'0700', status:'active' as const };
    await s.saveEmployee(null, employee);
    const [saved] = await s.employees();
    expect(saved.base_salary).toBe('15000.50');
    await expect(s.saveEmployee(null, { ...employee, code:'emp-1' })).rejects.toThrow();
    await s.saveEmployee(saved.id, { ...employee, status:'inactive' });
    const [updated] = await s.employees();
    expect(updated.id).toBe(saved.id);
    expect(updated.status).toBe('inactive');
    await expect(s.saveEmployee('missing', employee)).rejects.toThrow();
    await expect(s.saveEmployee(null, { ...employee, code:'EMP-2', hire_date:'2025-02-29' })).rejects.toThrow();
  });
});


describe('expense records', () => {
  it('keeps currencies separate, supports editing and rejects invalid values', async () => {
    const s = createDemoStore(false);
    const expense = { date:'2025-03-21', description:'تیل', expense_type:'سوخت', purchase_bill_no:'B-1', shop_name:'دوکان', amount_afn:'۱۰۰.۵۰', amount_usd:'5.25', payer:'دخل', payment_method:'cash' as const, notes:'یادداشت' };
    await expect(s.saveExpense(null, { ...expense, amount_afn:'0', amount_usd:'0' })).rejects.toThrow();
    await expect(s.saveExpense(null, { ...expense, date:'2025-02-29' })).rejects.toThrow();
    await s.saveExpense(null, expense);
    const [saved] = await s.expenses();
    expect(saved.amount_afn).toBe('100.50'); expect(saved.amount_usd).toBe('5.25');
    await s.saveExpense(saved.id, { ...expense, amount_afn:'0', payment_method:'credit' });
    expect(await s.expenses()).toMatchObject([{ id:saved.id, amount_afn:'0.00', amount_usd:'5.25', payment_method:'credit' }]);
    await expect(s.saveExpense('missing', expense)).rejects.toThrow();
    expect(await s.expenses()).toHaveLength(1);
  });
});


describe('salary records', () => {
  it('snapshots base pay, retains calendar and computes exact amounts', async () => {
    const s = createDemoStore(false);
    const employee = { code:'E1', name:'کارمند', father_name:'', job_title:'', hire_date:null, base_salary:'100.50', phone:'', status:'active' as const };
    await s.saveEmployee(null, employee);
    const id = (await s.employees())[0].id;
    const salary = { employee_id:id, period_calendar:'shamsi' as const, period_year:1404, period_month:1, pay_date:'2025-03-21', base:'۱۰۰.۵۰', bonus:'10.25', fine:'5', overtime:'1', payer:'دخل', payment_type:'cash' as const, notes:'' };
    await s.saveSalary(null,salary);
    const [saved] = await s.salaries(); expect(saved.total).toBe('106.75');
    await s.saveEmployee(id,{...employee,base_salary:'999',name:'نام جدید'});
    expect((await s.salaries())[0]).toMatchObject({base:'100.50',employee_name:'نام جدید'});
    await s.saveSalary(saved.id,{...salary,fine:'200',payment_type:'transfer'});
    expect((await s.salaries())[0]).toMatchObject({total:'-88.25',period_calendar:'shamsi',payment_type:'transfer'});
    await expect(s.saveSalary(null,{...salary,period_year:3178})).rejects.toThrow();
    await expect(s.saveSalary(null,{...salary,employee_id:'missing'})).rejects.toThrow();
    await expect(s.saveSalary(null,{...salary,pay_date:'2025-02-29'})).rejects.toThrow();
    await expect(s.saveSalary('missing',salary)).rejects.toThrow();
  });
});


describe('attendance records', () => {
  it('validates dates, unique employee days, optional times and overtime', async () => {
    const s=createDemoStore(false);
    await s.saveEmployee(null,{code:'E1',name:'کارمند',father_name:'',job_title:'',hire_date:null,base_salary:'0',phone:'',status:'active'});
    const id=(await s.employees())[0].id;
    const input={employee_id:id,work_date:'2025-03-21',status:'present' as const,check_in:'۰۸:۳۰',check_out:'16:30',overtime:'۱.۲۵',notes:'شرح'};
    await s.saveAttendance(null,input);
    const [saved]=await s.attendance(); expect(saved).toMatchObject({check_in:'08:30',overtime:'1.25'});
    await expect(s.saveAttendance(null,input)).rejects.toThrow('قبلاً');
    await s.saveAttendance(saved.id,{...input,status:'leave',check_in:null});
    expect((await s.attendance())[0]).toMatchObject({id:saved.id,status:'leave',check_in:null});
    await expect(s.saveAttendance(null,{...input,work_date:'2025-02-29'})).rejects.toThrow();
    await expect(s.saveAttendance(null,{...input,work_date:'2025-03-22',check_in:'24:00'})).rejects.toThrow();
    await expect(s.saveAttendance(null,{...input,work_date:'2025-03-22',overtime:'1000'})).rejects.toThrow();
    await expect(s.saveAttendance(null,{...input,employee_id:'missing'})).rejects.toThrow();
    await expect(s.saveAttendance('missing', {...input,work_date:'2025-03-22'})).rejects.toThrow();
    expect(await s.attendance()).toHaveLength(1);
  });
});


describe('daily attendance batch', () => {
  it('creates only explicit selected rows and rejects a whole conflicting batch', async () => {
    const s=createDemoStore(false);
    const employee={code:'E1',name:'اول',father_name:'',job_title:'',hire_date:null,base_salary:'0',phone:'',status:'active' as const};
    await s.saveEmployee(null,employee); await s.saveEmployee(null,{...employee,code:'E2',name:'دوم'}); await s.saveEmployee(null,{...employee,code:'E3',name:'غیرفعال',status:'inactive'});
    const [one,two,inactive]=await s.employees();
    await s.createAttendanceBatch('2025-03-21',[{employee_id:one.id,status:'present'}]);
    await expect(s.createAttendanceBatch('2025-03-21',[{employee_id:two.id,status:'leave'},{employee_id:one.id,status:'absent'}])).rejects.toThrow();
    expect(await s.attendance()).toHaveLength(1); expect((await s.attendance())[0].status).toBe('present');
    await expect(s.createAttendanceBatch('2025-03-22',[{employee_id:two.id,status:'leave'},{employee_id:inactive.id,status:'present'}])).rejects.toThrow();
    await expect(s.createAttendanceBatch('2025-03-22',[{employee_id:two.id,status:'leave'},{employee_id:two.id,status:'present'}])).rejects.toThrow();
    expect(await s.attendance()).toHaveLength(1);
    await s.createAttendanceBatch('2025-03-22',[{employee_id:one.id,status:'present'},{employee_id:two.id,status:'leave'}]);
    expect(await s.attendance()).toHaveLength(3);
  });
});

describe('paged transaction history', () => {
  it('keeps sales and receipts separate, filters beyond recent activity and treats search literally', async () => {
    const s=createDemoStore(false);
    await s.addCustomer({code:'C-1',name:'مشتری',phone:'',opening:'0'});
    const id=(await s.snapshot()).customers[0].id;
    for(let i=0;i<130;i++) await s.addSale({customer_id:id,date:i<25?'2024-01-01':'2026-01-01',material:i===0?'ویژه %':'ریگ',volume:'1',unit_price:'1',freight:'0',payment_type:'credit'});
    await s.addReceipt({customer_id:id,date:'2026-02-01',amount:'1.25',source:'deposit'});
    const query={kind:'sale' as const,page:0,search:'',from:null,to:null,customer_id:null,subtype:null};
    expect((await s.transactions(query)).total).toBe(130);
    expect((await s.transactions({...query,page:5})).rows).toHaveLength(5);
    const filtered=await s.transactions({...query,search:'%'}); expect(filtered.total).toBe(1); expect(filtered.rows[0].detail).toContain('ویژه');
    expect((await s.transactions({...query,from:'2024-01-01',to:'2024-01-01'})).total).toBe(25);
    expect((await s.transactions({...query,kind:'receipt',subtype:'deposit',customer_id:id})).rows[0].amount).toBe('1.25');
    expect((await s.transactions({...query,subtype:'cash'})).total).toBe(0);
    await expect(s.transactions({...query,kind:'receipt',subtype:'credit'})).rejects.toThrow();
    await expect(s.transactions({...query,page:-1})).rejects.toThrow();
    await expect(s.transactions({...query,from:'2025-02-29'})).rejects.toThrow();
    await expect(s.transactions({...query,from:'2026-01-01',to:'2024-01-01'})).rejects.toThrow();
  });
});

describe('transaction details',()=>{
  it('shows source components exactly and reports missing or wrong-kind records',async()=>{
    const s=createDemoStore(false); await s.addCustomer({code:'C1',name:'مشتری',phone:'',opening:'0'});
    const id=(await s.snapshot()).customers[0].id;
    await s.addSale({customer_id:id,date:'2026-01-01',material:'ریگ',volume:'1.250',unit_price:'200',freight:'30',payment_type:'credit'});
    await s.addReceipt({customer_id:id,date:'2026-01-02',amount:'1.25',source:'deposit'});
    const rows=(await s.snapshot()).entries; const sale=rows.find(e=>e.kind==='sale')!; const receipt=rows.find(e=>e.kind==='receipt')!;
    expect(await s.transactionDetail('sale',sale.id)).toMatchObject({volume:'1.250',unit_price:'200.00',freight:'30.00',total:'287.50',payment_type:'credit'});
    expect(await s.transactionDetail('receipt',receipt.id)).toMatchObject({amount:'1.25',source:'deposit'});
    await expect(s.transactionDetail('receipt',sale.id)).rejects.toThrow();
    await s.updateCustomer(id,{code:'C2',name:'نام جدید',phone:'',opening:'0'});
    expect(await s.transactionDetail('sale',sale.id)).toMatchObject({customer_code:'C2',customer_name:'نام جدید'});
  });
});

describe('editing financial transactions',()=>{
  it('recomputes both customer ledgers and rejects stale changes',async()=>{
    const s=createDemoStore(false);
    await s.addCustomer({code:'C1',name:'اول',phone:'',opening:'100'}); await s.addCustomer({code:'C2',name:'دوم',phone:'',opening:'0'});
    const [a,b]=(await s.snapshot()).customers;
    const original={customer_id:a.id,date:'2026-01-01',material:'ریگ',volume:'1',unit_price:'200',freight:'0',payment_type:'credit' as const};
    await s.addSale(original); const sale=(await s.snapshot()).entries[0];
    await s.updateSale(sale.id,{...original,customer_id:b.id,unit_price:'300'},original);
    await expect(s.updateSale(sale.id,original,original)).rejects.toThrow('تغییر کرده');
    expect((await s.ledger(a.id)).balance).toBe('100.00'); expect((await s.ledger(b.id)).balance).toBe('300.00');
    const receipt={customer_id:b.id,date:'2026-01-02',amount:'50',source:'deposit' as const};
    await s.addReceipt(receipt); const rec=(await s.snapshot()).entries.find(e=>e.kind==='receipt')!;
    await s.updateReceipt(rec.id,{...receipt,source:'debt'},receipt);
    await expect(s.updateReceipt(rec.id,receipt,receipt)).rejects.toThrow('تغییر کرده');
    expect((await s.ledger(b.id)).balance).toBe('250.00');
    const old={...original,customer_id:b.id,unit_price:'300'};
    await expect(s.updateSale(sale.id,{...old,customer_id:'missing'},old)).rejects.toThrow();
    expect((await s.ledger(b.id)).balance).toBe('250.00');
    await s.updateSale(sale.id,{...old,payment_type:'cash'},old);
    expect((await s.ledger(b.id)).balance).toBe('-50.00');
    expect((await s.snapshot()).credit_sales).toBe('0.00');
  });
});

describe('financial range summary',()=>{
  it('counts the full history with inclusive boundaries and separate amounts',async()=>{
    const s=createDemoStore(false);
    await s.addCustomer({code:'C',name:'C',phone:'',opening:'0'}); const c=(await s.snapshot()).customers[0].id;
    await s.saveEmployee(null,{code:'E',name:'E',father_name:'',job_title:'',hire_date:null,base_salary:'0',phone:'',status:'active'}); const e=(await s.employees())[0].id;
    for(let i=0;i<105;i++) await s.addSale({customer_id:c,date:'2025-03-21',material:'ریگ',volume:'1',unit_price:'1',freight:'0',payment_type:'credit'});
    await s.addSale({customer_id:c,date:'2025-03-22',material:'ریگ',volume:'1.25',unit_price:'1',freight:'0',payment_type:'cash'});
    await s.addSale({customer_id:c,date:'2025-03-23',material:'ریگ',volume:'1',unit_price:'1',freight:'0',payment_type:'credit'});
    await s.addReceipt({customer_id:c,date:'2025-03-21',amount:'2',source:'debt'}); await s.addReceipt({customer_id:c,date:'2025-03-22',amount:'3',source:'deposit'});
    await s.saveExpense(null,{date:'2025-03-21',description:'x',expense_type:'',purchase_bill_no:'',shop_name:'',amount_afn:'1.20',amount_usd:'3.40',payer:'',payment_method:'credit',notes:''});
    await s.saveSalary(null,{employee_id:e,period_calendar:'shamsi',period_year:1404,period_month:1,pay_date:'2025-03-22',base:'1',bonus:'0',fine:'3',overtime:'0',payer:'',payment_type:'transfer',notes:''});
    const report=await s.rangeSummary('2025-03-21','2025-03-22');
    expect(report).toEqual({sales_count:106,sales_credit:'105.00',sales_cash:'1.25',volume:'106.250',receipts_count:2,receipts_effective:'2.00',receipts_deposit:'3.00',expenses_count:1,expenses_afn:'1.20',expenses_usd:'3.40',salaries_count:1,salaries_afn:'-2.00'});
    expect((await s.rangeSummary('2024-01-01','2024-01-01')).sales_count).toBe(0);
    await expect(s.rangeSummary('2025-03-22','2025-03-21')).rejects.toThrow(); await expect(s.rangeSummary('2025-02-29','2025-03-21')).rejects.toThrow();
  });
});

it('financial summaries reflect edited date, customer and transaction type',async()=>{
  const s=createDemoStore(false);
  await s.addCustomer({code:'A',name:'A',phone:'',opening:'0'}); await s.addCustomer({code:'B',name:'B',phone:'',opening:'0'});
  const [a,b]=(await s.snapshot()).customers;
  const sale={customer_id:a.id,date:'2025-01-01',material:'ریگ',volume:'2',unit_price:'100',freight:'0',payment_type:'credit' as const};
  await s.addSale(sale); const id=(await s.snapshot()).entries[0].id;
  await s.updateSale(id,{...sale,customer_id:b.id,date:'2025-02-01',payment_type:'cash'},sale);
  const receipt={customer_id:b.id,date:'2025-01-01',amount:'30',source:'deposit' as const};
  await s.addReceipt(receipt); const rid=(await s.snapshot()).entries.find(e=>e.kind==='receipt')!.id;
  await s.updateReceipt(rid,{...receipt,date:'2025-02-01',source:'debt'},receipt);
  const old=await s.rangeSummary('2025-01-01','2025-01-31'); expect(old.sales_count).toBe(0); expect(old.receipts_count).toBe(0);
  const latest=await s.rangeSummary('2025-02-01','2025-02-01'); expect(latest.sales_credit).toBe('0.00'); expect(latest.sales_cash).toBe('200.00'); expect(latest.receipts_deposit).toBe('0.00'); expect(latest.receipts_effective).toBe('30.00');
});

it('retains supplemental fields, searches them, and rejects stale metadata edits',async()=>{
  const s=createDemoStore(false); await s.addCustomer({code:'C',name:'مشتری',phone:'',opening:'0'}); const c=(await s.snapshot()).customers[0].id;
  const details={bill_no:' BL-1 ',driver_name:'احمد',vehicle_plate:'123',destination:'کابل',notes:'سطر اول\nسطر دوم'};
  const sale={customer_id:c,date:'2025-01-01',material:'ریگ',volume:'1',unit_price:'100',freight:'0',payment_type:'credit' as const,details};
  await s.addSale(sale); const id=(await s.snapshot()).entries[0].id;
  const original=await s.transactionDetail('sale',id); expect(original.kind).toBe('sale'); if(original.kind!=='sale') throw new Error('wrong kind');
  expect(original.details.bill_no).toBe('BL-1'); expect(original.details.notes).toBe('سطر اول\nسطر دوم');
  const query={kind:'sale' as const,page:0,search:'bl-1',from:null,to:null,customer_id:null,subtype:null}; expect((await s.transactions(query)).total).toBe(1);
  const expected={...sale,details:original.details}; await s.updateSale(id,{...expected,details:{...expected.details,driver_name:'محمود'}},expected);
  await expect(s.updateSale(id,{...expected,unit_price:'200'},expected)).rejects.toThrow('تغییر کرده');
  expect((await s.ledger(c)).balance).toBe('100.00');
  const rec={customer_id:c,date:'2025-01-01',amount:'10',source:'deposit' as const,details:{related_bill_no:'BL-1',received_by:'احمد',notes:'یادداشت'}};
  await s.addReceipt(rec); const rid=(await s.snapshot()).entries.find(e=>e.kind==='receipt')!.id;
  await s.updateReceipt(rid,{...rec,details:{...rec.details,received_by:'محمود'}},rec);
  await expect(s.updateReceipt(rid,rec,rec)).rejects.toThrow('تغییر کرده');
  expect((await s.transactions({...query,kind:'receipt',search:'محمود'})).total).toBe(1);
  await expect(s.addSale({...sale,details:{...details,bill_no:'الف'.repeat(81)}})).rejects.toThrow();
  expect((await s.ledger(c)).balance).toBe('100.00');
});

it('allocates independent local numbers and preserves them through edits',async()=>{
  const s=createDemoStore(false); await s.addCustomer({code:'C',name:'C',phone:'',opening:'0'}); const customer_id=(await s.snapshot()).customers[0].id;
  const sale={customer_id,date:'2025-01-01',material:'ریگ',volume:'1',unit_price:'5',freight:'0',payment_type:'cash' as const};
  await expect(s.addSale({...sale,customer_id:'missing'})).rejects.toThrow(); await s.addSale(sale); await s.addSale(sale);
  const q={kind:'sale' as const,page:0,search:'S-000001',from:null,to:null,customer_id:null,subtype:null};
  const page=await s.transactions(q); expect(page.total).toBe(1); expect(page.rows[0].document_number).toBe('S-000001');
  const id=page.rows[0].id; await s.updateSale(id,{...sale,date:'2026-01-01'},sale); expect((await s.transactionDetail('sale',id)).document_number).toBe('S-000001');
  await s.addReceipt({customer_id,date:'2025-01-01',amount:'1',source:'debt'}); const rec=(await s.transactions({...q,kind:'receipt',search:'R-000001'})).rows[0]; expect(rec.document_number).toBe('R-000001');
});
