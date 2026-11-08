export interface RangeSummary { sales_count:number; sales_cash:string; sales_credit:string; volume:string; receipts_count:number; receipts_effective:string; receipts_deposit:string; expenses_count:number; expenses_afn:string; expenses_usd:string; salaries_count:number; salaries_afn:string }
export type TransactionDetail = { kind: 'sale'; id: string; customer_id: string; date: string; customer_name: string; customer_code: string; material: string; volume: string; unit_price: string; freight: string; total: string; payment_type: 'cash' | 'credit' } | { kind: 'receipt'; id: string; customer_id: string; date: string; customer_name: string; customer_code: string; amount: string; source: ReceiptInput['source'] };
export interface TransactionQuery { kind: 'sale' | 'receipt'; page: number; search: string; from: string | null; to: string | null; customer_id: string | null; subtype: string | null }
export interface TransactionRow extends Entry { customer_code: string }
export interface TransactionPage { rows: TransactionRow[]; total: number; page: number; page_size: number }
export type AttendanceStatus = 'present' | 'absent' | 'leave' | 'sick' | 'holiday' | 'friday';
export interface AttendanceBatchRow { employee_id: string; status: AttendanceStatus }
export interface AttendanceInput { employee_id: string; work_date: string; status: AttendanceStatus; check_in: string | null; check_out: string | null; overtime: string; notes: string }
export interface Attendance extends AttendanceInput { id: string; employee_name: string; employee_code: string }
export interface SalaryInput { employee_id: string; period_calendar: 'shamsi' | 'miladi'; period_year: number; period_month: number; pay_date: string; base: string; bonus: string; fine: string; overtime: string; payer: string; payment_type: 'cash' | 'transfer'; notes: string }
export interface Salary extends SalaryInput { id: string; employee_name: string; employee_code: string; total: string }
export interface ExpenseInput { date: string; description: string; expense_type: string; purchase_bill_no: string; shop_name: string; amount_afn: string; amount_usd: string; payer: string; payment_method: 'cash' | 'credit'; notes: string }
export interface Expense extends ExpenseInput { id: string }
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
export interface Store { rangeSummary(from: string, to: string): Promise<RangeSummary>; snapshot(): Promise<Snapshot>; transactions(query: TransactionQuery): Promise<TransactionPage>; transactionDetail(kind: 'sale' | 'receipt', id: string): Promise<TransactionDetail>; attendance(): Promise<Attendance[]>; createAttendanceBatch(workDate: string, rows: AttendanceBatchRow[]): Promise<void>; saveAttendance(id: string | null, input: AttendanceInput): Promise<void>; salaries(): Promise<Salary[]>; saveSalary(id: string | null, input: SalaryInput): Promise<void>; expenses(): Promise<Expense[]>; saveExpense(id: string | null, input: ExpenseInput): Promise<void>; employees(): Promise<Employee[]>; saveEmployee(id: string | null, input: EmployeeInput): Promise<void>; ledger(customerId: string): Promise<Ledger>; addCustomer(input: CustomerInput): Promise<void>; updateCustomer(id: string, input: CustomerInput): Promise<void>; addSale(input: SaleInput): Promise<void>; updateSale(id: string, input: SaleInput, expected: SaleInput): Promise<void>; addReceipt(input: ReceiptInput): Promise<void>; updateReceipt(id: string, input: ReceiptInput, expected: ReceiptInput): Promise<void> }

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

/** Exact AFN cents, matching the legacy formula; a negative result is retained. */
export function salaryTotal(base: string, bonus: string, fine: string, overtime: string): bigint {
  return parseScaled(base, 2) + parseScaled(bonus, 2) + parseScaled(overtime, 2) - parseScaled(fine, 2);
}
export function validSalaryPeriod(calendar: string, year: number, month: number): boolean {
  return Number.isInteger(year) && Number.isInteger(month) && month >= 1 && month <= 12 && year >= 1 && (calendar === 'shamsi' ? year <= 3177 : calendar === 'miladi' && year <= 9999);
}
