/** Shapes returned by the NestJS API. Money is always a string with two decimals. */
export type InvoiceStatus = "DRAFT" | "UNPAID" | "PARTIALLY_PAID" | "PAID" | "OVERDUE" | "VOID";
export type Method = "CASH" | "BANK_TRANSFER" | "POS";
export type SaleMethod = Method | "CREDIT";

export interface Page<T> { items: T[]; page: number; pageSize: number; total: number; totalPages: number }

export interface ActivityItem {
  id: string; label: string; category: string; date: string; sign: "+" | "-"; type: "INCOME" | "EXPENSE";
  source: "MANUAL" | "INVOICE_PAYMENT" | "IMPORTED"; amount: string; customerName: string | null; invoiceId: string | null;
}
export interface SeriesPoint { date: string; sales: string; expenses: string }
export interface Series { period: "7d" | "30d" | "90d"; from: string; to: string; points: SeriesPoint[] }
export interface Debtor { id: string; name: string; amountOwing: string }

export interface Dashboard {
  today: string; salesToday: string; expensesToday: string; moneyIn: string; moneyOut: string;
  customersOwing: { total: string; customerCount: number; invoiceCount: number };
  overdueInvoices: { count: string | number; total: string };
  topDebtors: Debtor[]; recentActivity: ActivityItem[]; chart: Series;
}

export interface Workspace {
  demoMode: boolean; notice: string; business: { id: string; name: string; currency: string } | null;
}

export interface CustomerSummary {
  id: string; name: string; email: string | null; phone: string | null; notes: string | null; archived: boolean;
  totalBought: string; totalPaid: string; amountOwing: string;
}
export interface InvoiceListItem {
  id: string; invoiceNumber: string; issueDate: string; dueDate: string; status: InvoiceStatus; total: string; amountPaid: string; balance: string;
}
export interface PaymentView { id: string; amount: string; paymentDate: string; method: string; reference: string | null }
export interface CustomerDetail extends CustomerSummary {
  invoices: InvoiceListItem[];
  payments: (PaymentView & { invoiceId: string; invoiceNumber: string })[];
}
export interface InvoiceItemView { id: string; description: string; quantity: string; unitPrice: string; lineTotal: string }
export interface InvoiceView extends InvoiceListItem {
  customer: { id: string; name: string }; items: InvoiceItemView[]; payments: PaymentView[];
}
export interface TransactionView {
  id: string; type: "INCOME" | "EXPENSE"; source: "MANUAL" | "INVOICE_PAYMENT" | "IMPORTED"; sign: "+" | "-"; amount: string;
  category: string; date: string; description: string | null; reference: string | null; paymentMethod: string | null;
  customer: { id: string; name: string } | null; invoice: { id: string; invoiceNumber: string } | null; editable: boolean;
}
export interface Categories { expense: string[]; income: string[] }
