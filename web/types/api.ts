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
  topDebtors: Debtor[]; recentActivity: ActivityItem[];
  statement: StatementTotals;
  cashflow: Cashflow;
}

/** Totals taken from an uploaded bank statement, never estimated. */
export interface StatementTotals {
  credits: string; debits: string; net: string;
  openingBalance: string | null; closingBalance: string | null;
  reconciles: boolean | null; importCount: number; rowCount: number;
}
export interface CashflowPoint { date: string; in: string; out: string; net: string; balance: string }
export interface Cashflow {
  from: string; to: string; openingBalance: string | null; openingKnown: boolean;
  closingBalance: string; points: CashflowPoint[];
}

/* ---- Business performance chart (GET /api/reports/performance) ---- */
export type PerformancePeriod = "7d" | "30d" | "90d" | "6m" | "1y";
export type TrendDirection = "UP" | "DOWN" | "FLAT";
export interface PerformancePoint {
  start: string; end: string; sales: string; expenses: string; profit: string;
}
export interface MetricComparison {
  current: string; previous: string; changePct: number | null; direction: TrendDirection;
}
export interface Performance {
  period: PerformancePeriod;
  granularity: "day" | "week" | "month";
  currency: string;
  from: string; to: string; previousFrom: string; previousTo: string; previousLabel: string;
  points: PerformancePoint[];
  totals: { sales: string; expenses: string; profit: string };
  comparison: { sales: MetricComparison; expenses: MetricComparison; profit: MetricComparison };
  trend: "IMPROVING" | "DECLINING" | "STABLE" | "UNKNOWN";
  hasData: boolean;
  enoughHistory: boolean;
  insights: string[];
}

/** GET /api/reports/summary */
export interface ReportSummary {
  range: { from: string; to: string };
  sales: { total: string; recorded: string; onInvoices: string };
  expenses: { total: string };
  moneyIn: string; moneyOut: string; netRecordedMovement: string;
  customersOwing: { total: string; customerCount: number; invoiceCount: number };
  overdueInvoices: { count: number; total: string };
  expensesByCategory: { category: string; total: string; count: number }[];
  incomeByCategory: { category: string; total: string; count: number }[];
}
export type ExportType = "transactions" | "invoices" | "customers-owing";

export type WorkspaceKind = "PERSONAL" | "BUSINESS";
export type MemberRole = "OWNER" | "MANAGER" | "STAFF";

/** A workspace the user belongs to, with the role they hold in it. */
export interface WorkspaceSummary {
  id: string; name: string; kind: WorkspaceKind; currency: string; role: MemberRole; memberCount?: number;
}

/** The signed-in user plus their active workspace (null until onboarding completes). */
export interface Me {
  userId: string; fullName: string | null; email?: string | null;
  business: { id: string; name: string; currency: string; kind?: WorkspaceKind } | null;
  role?: MemberRole | null;
  workspaces?: WorkspaceSummary[];
}

/* ---- Debts (GET /api/debts) ---- */
export type DebtDirection = "OWED_TO_ME" | "I_OWE";
export type DebtStatus = "PENDING" | "PARTIAL" | "OVERDUE" | "PAID" | "DISPUTED" | "WRITTEN_OFF" | "CANCELLED";

export interface DebtView {
  id: string; counterpartyName: string; counterpartyPhone: string | null; counterpartyEmail: string | null;
  direction: DebtDirection; principal: string; currency: string; description: string;
  incurredOn: string; dueOn: string | null; terms: string | null; status: DebtStatus;
  override: "DISPUTED" | "WRITTEN_OFF" | "CANCELLED" | null;
  balance: string; totalRepaid: string; daysOverdue: number;
  customer: { id: string; name: string } | null; assignedToUserId: string | null;
  repaymentCount: number; lastPaymentOn: string | null; createdAt: string;
}
export interface DebtRepaymentView {
  id: string; amount: string; paidOn: string; method: string; reference: string | null; note: string | null;
}
export interface DebtActivity { id: string; kind: string; summary: string; createdAt: string }
export interface DebtReminder {
  id: string; channel: "EMAIL" | "WHATSAPP" | "SMS"; status: "SCHEDULED" | "SENDING" | "SENT" | "FAILED" | "SKIPPED";
  scheduledFor: string; sentAt: string | null; lastError: string | null;
}
export interface DebtPaymentRequest {
  id: string; tokenPrefix: string; createdAt: string; expiresAt: string | null; revokedAt: string | null; viewCount: number; active: boolean;
}
export interface DebtDocument { id: string; filename: string; mime: string; sizeBytes: number; createdAt: string }
export interface DebtDetail extends DebtView {
  repayments: DebtRepaymentView[]; activities: DebtActivity[]; reminders: DebtReminder[];
  paymentRequests: DebtPaymentRequest[]; documents: DebtDocument[];
}
export interface DebtSummary {
  today: string;
  owedToMe: { outstanding: string; recovered: string; count: number };
  iOwe: { outstanding: string; count: number };
  overdue: { amount: string; count: number };
  dueSoon: { amount: string; count: number };
  recoveredThisMonth: string;
}
export interface DebtAgeingBucket { key: string; label: string; amount: string; count: number }
export interface DebtAnalytics {
  today: string; ageing: DebtAgeingBucket[]; outstanding: string; recovered: string;
  collectionRate: number | null; monthlyRecovered: { month: string; amount: string }[]; liveDebtCount: number;
}
export interface UpcomingReminder {
  id: string; debtId: string; debtor: string; channel: "EMAIL" | "WHATSAPP" | "SMS";
  status: string; scheduledFor: string; lastError: string | null;
}
export interface NotificationEntry {
  id: string; channel: string; provider: string; status: "SENT" | "FAILED" | "SKIPPED";
  errorCode: string | null; providerMessageId: string | null; createdAt: string; debtor: string; debtId: string;
}
export interface RecoveryOverview {
  items: NotificationEntry[];
  configured: { email: boolean; whatsapp: boolean; sms: boolean; scheduler: boolean };
}
export interface PublicPaymentRequest {
  reference: string; business: string; currency: string; description: string;
  amountOwed: string; amountPaid: string; balance: string; dueOn: string | null; status: DebtStatus;
  instructions: string; disputeContact: string;
}
export interface MemberView {
  id: string; role: MemberRole; status: "INVITED" | "ACTIVE" | "REMOVED"; email: string | null;
  userId: string | null; joinedAt: string | null;
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

export type RowStatus = "VALID" | "INVALID" | "DUPLICATE" | "UNMATCHED" | "SUGGESTED_MATCH" | "MATCHED";
export interface ColumnMapping { date?: string; description?: string; amount?: string; direction?: string; reference?: string; credit?: string; debit?: string }
export interface PreviewRow { rowNumber: number; date: string | null; description: string | null; amount: string | null; direction: "IN" | "OUT" | null; externalReference: string | null; status: RowStatus; note: string | null }
export interface CsvPreview {
  filename: string; headers: string[]; mapping: ColumnMapping | null; problems: string[]; rowCount: number;
  counts: Record<RowStatus, number>; canSave: boolean; rows: PreviewRow[];
}
export interface ImportSummary { id: string; filename: string; status: "PENDING_REVIEW" | "COMPLETED"; rowCount: number; createdAt: string; counts: Partial<Record<RowStatus, number>> }
export interface InvoiceRef { id: string; invoiceNumber: string; customer: string; balance: string }
export interface ImportRow {
  id: string; rowNumber: number; date: string | null; description: string | null; amount: string | null; direction: "IN" | "OUT" | null;
  externalReference: string | null; status: RowStatus; note: string | null; suggestedInvoice: InvoiceRef | null; matchedInvoice: InvoiceRef | null;
}
export interface ImportDetail {
  id: string; filename: string; status: "PENDING_REVIEW" | "COMPLETED"; rowCount: number; createdAt: string; notice: string; rows: ImportRow[];
  statement: { credits: string; debits: string; net: string; openingBalance: string | null; closingBalance: string | null; reconciles?: boolean | null };
}

export type ReminderChannel = "EMAIL" | "WHATSAPP" | "SMS";

/* ---- Smart Debt Reminders (owner-facing scheduled emails) ---- */
export type ReminderFrequency = "ONCE_DAILY" | "TWICE_DAILY" | "THREE_TIMES_DAILY" | "CUSTOM";
export interface DebtReminderConfig {
  enabled: boolean; paused: boolean; frequency: ReminderFrequency; times: string[];
  timezone: string; nextRunAt: string | null; lastSentAt: string | null; lastError: string | null; email: string;
}
export interface DebtReminderState { debtId: string; balance: string; status: string; reminder: DebtReminderConfig | null }
export interface ReminderDelivery {
  id: string; subject: string; status: "SENT" | "FAILED" | "SKIPPED"; provider: string;
  debtCount: number; totalOutstanding: string; createdAt: string; errorCode: string | null;
}
export interface RemindersOverview {
  email: string | null; schedulerConfigured: boolean; emailConfigured: boolean;
  /** Which provider the reminder emails go through, when the API reports it. */
  emailProvider?: "gmail" | "resend";
  totals: { enabled: number; paused: number; active: number; outstanding: string; nextRunAt: string | null };
  items: Array<{
    debtId: string; name: string; description: string; balance: string; status: string;
    enabled: boolean; paused: boolean; active: boolean; frequency: ReminderFrequency; times: string[];
    timezone: string; nextRunAt: string | null; lastSentAt: string | null; lastError: string | null; email: string;
    /** The debtor's address on the debt: it receives its own copy of the reminder. */
    debtorEmail?: string | null;
  }>;
  history: ReminderDelivery[];
}
