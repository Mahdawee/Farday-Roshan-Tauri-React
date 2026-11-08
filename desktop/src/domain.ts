// Monetary values cross the adapter boundary as decimal strings, never JS floats.
export interface EmployeeInput { code: string; name: string; father_name: string; job_title: string; hire_date: string | null; base_salary: string; phone: string; status: 'active' | 'inactive' }
export interface Employee extends EmployeeInput { id: string }
export interface CustomerInput { code: string; name: string; phone: string; opening: string }
export interface Customer extends CustomerInput { id: string; balance: string }
export interface SaleInput { customer_id: string; date: string; material: string; volume: string; unit_price: string; freight: string; payment_type: 'cash' | 'credit' }
export interface ReceiptInput { customer_id: string; date: string; amount: string; source: 'debt' | 'deposit' | 'statement' | 'advance' }
export interface Entry { id: string; kind: 'sale' | 'receipt'; date: string; customer_name: string; detail: string; amount: string }
export interface Snapshot { customers: Customer[]; entries: Entry[]; credit_sales: string; receipts: string; total_balance: string }
export interface LedgerRow { id: string; date: string; kind: 'sale' | 'receipt'; detail: string; debit: string; credit: string; affects_balance: boolean; balance: string }
export interface Ledger { customer_name: string; customer_code: string; opening: string; balance: string; rows: LedgerRow[] }
export interface Store { snapshot(): Promise<Snapshot>; employees(): Promise<Employee[]>; saveEmployee(id: string | null, input: EmployeeInput): Promise<void>; ledger(customerId: string): Promise<Ledger>; addCustomer(input: CustomerInput): Promise<void>; addSale(input: SaleInput): Promise<void>; addReceipt(input: ReceiptInput): Promise<void> }

const MAX = 1000000000000n; // 10 billion AFN per field, bounded to make aggregate overflow remote.
export function parseScaled(raw: string, decimals: number): bigint {
  const normalized = raw.trim().replace(/[۰-۹٠-٩]/g, c => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c) >= 0 ? '۰۱۲۳۴۵۶۷۸۹'.indexOf(c) : '٠١٢٣٤٥٦٧٨٩'.indexOf(c))).replace(/[,٬ ]/g, '');
  const m = /^(\d+)(?:\.(\d+))?$/.exec(normalized);
  if (!m || (m[2]?.length ?? 0) > decimals) throw new Error(`عدد معتبر با حداکثر ${decimals} رقم اعشار وارد کنید.`);
  const n = BigInt(m[1]) * 10n ** BigInt(decimals) + BigInt((m[2] ?? '').padEnd(decimals, '0') || '0');
  if (n > MAX) throw new Error('عدد واردشده بیش از حد مجاز است.');
  return n;
}
export function formatScaled(n: bigint, decimals = 2): string {
  const neg = n < 0n; const v = neg ? -n : n; const base = 10n ** BigInt(decimals);
  return `${neg ? '-' : ''}${v / base}.${String(v % base).padStart(decimals, '0')}`;
}
export function saleTotal(volume: string, price: string, freight: string): bigint {
  const v = parseScaled(volume, 3); const p = parseScaled(price, 2); const f = parseScaled(freight, 2);
  if (v === 0n) throw new Error('متراژ باید بیشتر از صفر باشد.');
  const result = (v * (p + f) + 500n) / 1000n;
  if (result > MAX) throw new Error('مجموع فروش بیش از حد مجاز است.');
  return result;
}
export function displayMoney(value: string): string {
  const [whole, decimal] = value.split('.');
  return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}${decimal && decimal !== '00' ? '.' + decimal : ''}`;
}
