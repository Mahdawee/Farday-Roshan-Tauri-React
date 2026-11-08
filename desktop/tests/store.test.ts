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
