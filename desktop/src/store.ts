import { invoke, isTauri } from '@tauri-apps/api/core';
import { Customer, CustomerInput, Entry, Ledger, formatScaled, parseScaled, ReceiptInput, SaleInput, saleTotal, Snapshot, Store } from './domain';

const tauriStore: Store = {
  snapshot: () => invoke<Snapshot>('snapshot'),
  ledger: customerId => invoke<Ledger>('customer_ledger', { customerId }),
  addCustomer: input => invoke('add_customer', { input }),
  addSale: input => invoke('add_sale', { input }),
  addReceipt: input => invoke('add_receipt', { input }),
};

// Explicitly temporary browser preview. It never touches the real database.
export function createDemoStore(seed = true): Store {
  const customers: Customer[] = [
    { id: 'demo-1', code: 'CUS-001', name: 'شرکت ساختمانی امید', phone: '0700 123 456', opening: '0.00', balance: '42000.00' },
    { id: 'demo-2', code: 'CUS-002', name: 'احمد رحمانی', phone: '0799 456 123', opening: '0.00', balance: '18000.00' },
    { id: 'demo-3', code: 'CUS-003', name: 'موسسه راه و ساختمان', phone: '0788 321 654', opening: '0.00', balance: '0.00' },
  ];
  type DemoEntry = Entry & { customer_id: string; affects_balance: boolean };
  const entries: DemoEntry[] = [
    { id: 'demo-e1', customer_id: 'demo-1', affects_balance: true, kind: 'sale', date: '2026-11-08', customer_name: 'شرکت ساختمانی امید', detail: 'ماسه اول · باقی', amount: '54000.00' },
    { id: 'demo-e2', customer_id: 'demo-1', affects_balance: true, kind: 'receipt', date: '2026-11-07', customer_name: 'شرکت ساختمانی امید', detail: 'باقی داری', amount: '12000.00' },
    { id: 'demo-e3', customer_id: 'demo-2', affects_balance: true, kind: 'sale', date: '2026-11-06', customer_name: 'احمد رحمانی', detail: 'ریگ · باقی', amount: '18000.00' },
  ];
  let credit = 7200000n, receipts = 1200000n;
  if (!seed) { customers.length = 0; entries.length = 0; credit = 0n; receipts = 0n; }
  const storedCents = (value: string): bigint => {
    const negative = value.startsWith('-');
    const [whole, fraction] = (negative ? value.slice(1) : value).split('.');
    const amount = BigInt(whole) * 100n + BigInt((fraction ?? '').padEnd(2, '0'));
    return negative ? -amount : amount;
  };
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
    async snapshot(): Promise<Snapshot> {
      return structuredClone({ customers, entries, credit_sales: formatScaled(credit), receipts: formatScaled(receipts), total_balance: formatScaled(customers.reduce((a,c) => a + storedCents(c.balance), 0n)) });
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
    async addSale(input) {
      validateDate(input.date);
      if (!input.material.trim()) throw new Error('نوع مواد الزامی است.');
      const total = saleTotal(input.volume, input.unit_price, input.freight);
      const c = update(input.customer_id, input.payment_type === 'credit' ? total : 0n);
      if (input.payment_type === 'credit') credit += total;
      entries.unshift({ id: crypto.randomUUID(), customer_id: c.id, affects_balance: input.payment_type === 'credit', kind: 'sale', date: input.date, customer_name: c.name, detail: `${input.material} · ${input.payment_type === 'credit' ? 'باقی' : 'نقده'}`, amount: formatScaled(total) });
    },
    async addReceipt(input) {
      validateDate(input.date);
      const amount = parseScaled(input.amount, 2);
      if (!amount) throw new Error('مبلغ رسید باید بیشتر از صفر باشد.');
      const c = update(input.customer_id, input.source === 'deposit' ? 0n : -amount);
      receipts += amount;
      const labels = { debt: 'باقی داری', deposit: 'امانت', statement: 'بیانیه', advance: 'پیش پرداخت' };
      entries.unshift({ id: crypto.randomUUID(), customer_id: c.id, affects_balance: input.source !== 'deposit', kind: 'receipt', date: input.date, customer_name: c.name, detail: labels[input.source], amount: formatScaled(amount) });
    },
  };
}

export const inDesktop = isTauri();
// No accidental fake persistence in a production web deployment.
export const store: Store = inDesktop ? tauriStore : import.meta.env.DEV ? createDemoStore() : {
  snapshot: async () => { throw new Error('نسخهٔ آنلاین هنوز پیاده‌سازی نشده است.'); },
  ledger: async () => { throw new Error('نسخهٔ آنلاین هنوز پیاده‌سازی نشده است.'); },
  addCustomer: async () => { throw new Error('نسخهٔ آنلاین هنوز پیاده‌سازی نشده است.'); },
  addSale: async () => { throw new Error('نسخهٔ آنلاین هنوز پیاده‌سازی نشده است.'); },
  addReceipt: async () => { throw new Error('نسخهٔ آنلاین هنوز پیاده‌سازی نشده است.'); },
};
