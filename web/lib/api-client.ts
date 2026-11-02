import type {
  DebtReminderState,
  ReminderFrequency,
  RemindersOverview,
  Categories, CustomerDetail, CustomerSummary, Dashboard, InvoiceStatus, InvoiceView, Method, Page, SaleMethod, Series,
  TransactionView, Me, CsvPreview, ColumnMapping, ImportDetail, ImportSummary,
  Performance, PerformancePeriod, ReportSummary, ExportType,
  WorkspaceSummary, WorkspaceKind, MemberView, DebtView, DebtDetail, DebtSummary, DebtAnalytics,
  DebtDocument, DebtStatus, DebtDirection, UpcomingReminder, RecoveryOverview, PublicPaymentRequest, ReminderChannel,
} from "@/types/api";
import { getApiUrl } from "./env";
import { beginLoading, endLoading, isBlockingRequest } from "./loading";
import { supabase } from "./supabase/client";

export class ApiError extends Error {
  constructor(public status: number, message: string, public details?: string[]) {
    super(message);
    this.name = "ApiError";
  }
  get isNotFound() { return this.status === 404; }
}

/**
 * The workspace the UI is currently acting on. It is sent as a header on every request; the API
 * only honours it if the signed-in user is an active member, so it can never widen access.
 */
let activeWorkspaceId: string | null = null;
export function setActiveWorkspace(id: string | null): void {
  activeWorkspaceId = id;
}

export function getActiveWorkspace(): string | null {
  return activeWorkspaceId;
}

/** The signed-in user's Supabase access token, attached as a Bearer header to every API call. */
async function accessToken(): Promise<string | undefined> {
  try {
    const { data } = await supabase().auth.getSession();
    return data.session?.access_token;
  } catch {
    return undefined;
  }
}

/**
 * A request may never hang forever. A sleeping or broken API host would otherwise leave a save
 * button spinning indefinitely, which is exactly what an unreachable server looked like before.
 */
const REQUEST_TIMEOUT_MS = 45_000;

/** One authenticated request. Every caller - JSON, file upload, CSV download - goes through here. */
async function send(
  path: string,
  init?: RequestInit,
  options?: { loading?: boolean },
): Promise<Response> {
  let res: Response;
  const token = await accessToken();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  // Only user-initiated writes block the screen. Background reads stay silent.
  const blocking = options?.loading ?? isBlockingRequest(init?.method);
  if (blocking) beginLoading();
  try {
    res = await fetch(`${getApiUrl()}/api${path}`, {
      ...init,
      signal: init?.signal ?? controller.signal,
      headers: {
        ...(init?.body && !(init.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(activeWorkspaceId ? { "x-workspace-id": activeWorkspaceId } : {}),
        ...init?.headers,
      },
      cache: "no-store",
    });
  } catch {
    throw new ApiError(
      0,
      controller.signal.aborted
        ? "The server is taking too long to answer. It may be starting up - please try again in a moment."
        : "We can't reach the server right now. Check your connection and try again.",
    );
  } finally {
    clearTimeout(timer);
    if (blocking) endLoading();
  }
  if (!res.ok) {
    let message = "Something went wrong. Please try again.";
    let details: string[] | undefined;
    try {
      const body = (await res.json()) as { message?: string; details?: string[] };
      if (body.message) message = body.message;
      details = body.details;
    } catch { /* keep default message */ }
    throw new ApiError(res.status, message, details);
  }
  return res;
}

async function request<T>(
  path: string,
  init?: RequestInit,
  options?: { loading?: boolean },
): Promise<T> {
  const res = await send(path, init, options);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

const json = (method: string, body?: unknown): RequestInit => ({ method, body: body === undefined ? undefined : JSON.stringify(body) });
const qs = (o: Record<string, string | number | boolean | undefined | null>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== null && v !== "") p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : "";
};

export interface InvoiceInput {
  customerId: string; issueDate: string; dueDate: string; invoiceNumber?: string; saveAsDraft?: boolean;
  items: { description: string; quantity: string; unitPrice: string }[];
}

/** The only place the UI talks to the API. */
export const api = {
  me: () => request<Me>("/auth/me"),
  bootstrap: (b: { fullName: string; businessName: string }) => request<Me>("/auth/bootstrap", json("POST", b)),
  updateBusiness: (b: { name: string }) =>
    request<{ business: { id: string; name: string; currency: string } }>("/auth/business", json("PATCH", b)),
  updateProfile: (b: { email?: string; password?: string }) => request<{ email?: string; passwordChanged?: boolean }>("/auth/me", json("PATCH", b)),
  deleteAccount: () => request<void>("/auth/account", { method: "DELETE" }),
  dashboard: () => request<Dashboard>("/dashboard"),
  series: (period: "7d" | "30d" | "90d") => request<Series>(`/reports/timeseries?period=${period}`),
  performance: (period: PerformancePeriod) => request<Performance>(`/reports/performance?period=${period}`),
  reportSummary: (from: string, to: string) => request<ReportSummary>(`/reports/summary?from=${from}&to=${to}`),
  /** CSV downloads need the Bearer token too, so they cannot be a plain <a href>. */
  exportCsv: async (type: ExportType, from: string, to: string): Promise<{ blob: Blob; filename: string }> => {
    // A CSV download is user-initiated and can take a moment, so it blocks on purpose.
    const res = await send(`/reports/export?type=${type}&from=${from}&to=${to}`, undefined, { loading: true });
    const disposition = res.headers.get("Content-Disposition") ?? "";
    const filename = /filename="([^"]+)"/.exec(disposition)?.[1] ?? `${type}.csv`;
    return { blob: await res.blob(), filename };
  },

  recordSale: (b: { amount: string; paymentMethod: SaleMethod; customerId?: string; description?: string; date?: string }) =>
    request<{ kind: "transaction" | "credit_invoice" }>("/sales", json("POST", b)),
  recordExpense: (b: { amount: string; category: string; description?: string; date?: string; paymentMethod?: Method }) =>
    request<TransactionView>("/expenses", json("POST", b)),

  customers: (q: { search?: string; page?: number; pageSize?: number; owingOnly?: boolean; includeArchived?: boolean } = {}) =>
    request<Page<CustomerSummary>>(`/customers${qs(q)}`),
  customer: (id: string) => request<CustomerDetail>(`/customers/${id}`),
  createCustomer: (b: { name: string; phone?: string; email?: string; notes?: string }) => request<CustomerSummary>("/customers", json("POST", b)),
  updateCustomer: (id: string, b: { name?: string; phone?: string; email?: string; notes?: string }) => request<CustomerSummary>(`/customers/${id}`, json("PATCH", b)),
  archiveCustomer: (id: string) => request<CustomerSummary>(`/customers/${id}/archive`, json("POST")),
  restoreCustomer: (id: string) => request<CustomerSummary>(`/customers/${id}/restore`, json("POST")),
  customerPaid: (id: string, b: { amount: string; method: Method; reference?: string }) =>
    request<{ totalApplied: string; applied: { invoiceNumber: string; amount: string }[] }>(`/customers/${id}/payments`, json("POST", b)),

  invoices: (q: { status?: InvoiceStatus | ""; search?: string; customerId?: string; page?: number; pageSize?: number } = {}) =>
    request<Page<InvoiceView>>(`/invoices${qs(q)}`),
  invoice: (id: string) => request<InvoiceView>(`/invoices/${id}`),
  createInvoice: (b: InvoiceInput) => request<InvoiceView>("/invoices", json("POST", b)),
  updateInvoice: (id: string, b: Partial<InvoiceInput>) => request<InvoiceView>(`/invoices/${id}`, json("PATCH", b)),
  issueInvoice: (id: string) => request<InvoiceView>(`/invoices/${id}/issue`, json("POST")),
  voidInvoice: (id: string) => request<InvoiceView>(`/invoices/${id}/void`, json("POST")),
  deleteInvoice: (id: string) => request<void>(`/invoices/${id}`, json("DELETE")),
  recordPayment: (id: string, b: { amount: string; method: Method; paymentDate?: string; reference?: string }) =>
    request<InvoiceView>(`/invoices/${id}/payments`, json("POST", b)),

  transactions: (q: { type?: "INCOME" | "EXPENSE" | ""; search?: string; category?: string; from?: string; to?: string; source?: string; page?: number; pageSize?: number } = {}) =>
    request<Page<TransactionView>>(`/transactions${qs(q)}`),
  categories: () => request<Categories>("/transactions/categories"),
  createTransaction: (b: { type: "INCOME" | "EXPENSE"; amount: string; category: string; description?: string; date?: string; paymentMethod?: Method }) =>
    request<TransactionView>("/transactions", json("POST", b)),
  updateTransaction: (id: string, b: { amount?: string; category?: string; description?: string; date?: string }) =>
    request<TransactionView>(`/transactions/${id}`, json("PATCH", b)),
  deleteTransaction: (id: string) => request<void>(`/transactions/${id}`, json("DELETE")),

  previewCsv: (file: File, mapping?: ColumnMapping) => request<CsvPreview>("/reconciliation/preview", { method: "POST", body: csvForm(file, mapping) }),
  saveCsv: (file: File, mapping?: ColumnMapping) => request<{ id: string; rowCount: number }>("/reconciliation/imports", { method: "POST", body: csvForm(file, mapping) }),
  imports: () => request<{ items: ImportSummary[] }>("/reconciliation/imports"),
  importDetail: (id: string) => request<ImportDetail>(`/reconciliation/imports/${id}`),
  confirmRow: (rowId: string, invoiceId?: string) => request<{ status: string }>(`/reconciliation/rows/${rowId}/confirm`, json("POST", invoiceId ? { invoiceId } : {})),
  rejectRow: (rowId: string) => request<{ status: string }>(`/reconciliation/rows/${rowId}/reject`, json("POST")),
  templateUrl: () => `${getApiUrl()}/api/reconciliation/template`,

  /* ---- workspaces and members ---- */
  workspaces: () => request<{ items: WorkspaceSummary[] }>("/workspaces"),
  createWorkspace: (b: { name: string; kind?: WorkspaceKind }) =>
    request<WorkspaceSummary>("/workspaces", json("POST", b)),
  renameWorkspace: (id: string, b: { name: string }) =>
    request<{ id: string; name: string }>(`/workspaces/${id}`, json("PATCH", b)),
  members: (id: string) => request<{ items: MemberView[] }>(`/workspaces/${id}/members`),
  inviteMember: (id: string, b: { email: string; role: "MANAGER" | "STAFF" }) =>
    request<{ id: string; email: string | null; role: string; status: string }>(`/workspaces/${id}/members`, json("POST", b)),
  changeMemberRole: (id: string, memberId: string, b: { role: "MANAGER" | "STAFF" }) =>
    request<{ id: string; role: string }>(`/workspaces/${id}/members/${memberId}`, json("PATCH", b)),
  removeMember: (id: string, memberId: string) =>
    request<{ status: string }>(`/workspaces/${id}/members/${memberId}`, { method: "DELETE" }),

  /* ---- debts ---- */
  debts: (q: { direction?: DebtDirection | ""; status?: DebtStatus | ""; search?: string; customerId?: string; from?: string; to?: string; page?: number; pageSize?: number } = {}) =>
    request<Page<DebtView>>(`/debts${qs(q)}`),
  debt: (id: string) => request<DebtDetail>(`/debts/${id}`),
  debtSummary: () => request<DebtSummary>("/debts/summary"),
  debtAnalytics: () => request<DebtAnalytics>("/debts/analytics"),
  createDebt: (b: {
    counterpartyName: string; counterpartyPhone?: string; counterpartyEmail?: string;
    direction: DebtDirection; principal: string; description: string; incurredOn: string;
    dueOn?: string; terms?: string; customerId?: string;
  }) => request<DebtView>("/debts", json("POST", b)),
  updateDebt: (id: string, b: Record<string, unknown>) => request<DebtView>(`/debts/${id}`, json("PATCH", b)),
  deleteDebt: (id: string) => request<{ status: string }>(`/debts/${id}`, { method: "DELETE" }),
  recordDebtRepayment: (id: string, b: { amount: string; paidOn?: string; method: Method; reference?: string; note?: string }) =>
    request<{ id: string; amount: string; balance: string; status: string }>(`/debts/${id}/repayments`, json("POST", b)),
  assignDebt: (id: string, userId: string | null) =>
    request<{ id: string; assignedToUserId: string | null }>(`/debts/${id}/assign`, json("PATCH", { userId })),

  /* ---- recovery ---- */
  createPaymentRequest: (debtId: string, days = 30) =>
    request<{ id: string; token: string; path: string; expiresAt: string | null }>(`/debts/${debtId}/payment-requests`, json("POST", { days })),
  revokePaymentRequest: (debtId: string, requestId: string) =>
    request<{ status: string }>(`/debts/${debtId}/payment-requests/${requestId}/revoke`, json("POST")),
  createReminder: (debtId: string, b: { channel: ReminderChannel; scheduledFor?: string; templateKey?: "friendly" | "firm" }) =>
    request<{ id: string; status: string; scheduledFor: string }>(`/debts/${debtId}/reminders`, json("POST", b)),
  sendReminder: (debtId: string, b: { channel: ReminderChannel; templateKey?: "friendly" | "firm" }) =>
    request<{ status: string; reason: string | null; provider: string }>(`/debts/${debtId}/reminders/send`, json("POST", b)),
  sendExistingReminder: (debtId: string, reminderId: string) =>
    request<{ status: string; reason?: string | null }>(`/debts/${debtId}/reminders/${reminderId}/send`, json("POST")),
  cancelReminder: (debtId: string, reminderId: string) =>
    request<{ status: string }>(`/debts/${debtId}/reminders/${reminderId}`, { method: "DELETE" }),

  /* ---- Smart Debt Reminders ---- */
  debtReminder: (debtId: string) => request<DebtReminderState>(`/debts/${debtId}/reminder`),
  saveDebtReminder: (debtId: string, b: { enabled: boolean; frequency: ReminderFrequency; times: string[]; timezone?: string; paused?: boolean }) =>
    request<{ enabled: boolean; paused: boolean; nextRunAt: string | null }>(`/debts/${debtId}/reminder`, json("PUT", b)),
  pauseDebtReminder: (debtId: string, paused: boolean) =>
    request<{ paused: boolean; nextRunAt: string | null }>(`/debts/${debtId}/reminder/pause`, json("POST", { paused })),
  disableDebtReminder: (debtId: string) =>
    request<{ enabled: boolean }>(`/debts/${debtId}/reminder`, { method: "DELETE" }),
  remindersOverview: () => request<RemindersOverview>("/debt-reminders"),
  sendReminderTest: () =>
    request<{ status: string; provider: string; subject: string; to: string; reason: string | null; debtCount: number; preview: string }>(`/debt-reminders/test`, json("POST")),
  upcomingReminders: () => request<{ items: UpcomingReminder[] }>("/recovery/upcoming"),
  notificationLog: () => request<RecoveryOverview>("/recovery/notifications"),
  uploadDocument: (debtId: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<DebtDocument>(`/debts/${debtId}/documents`, { method: "POST", body: form });
  },
  documentLink: (documentId: string) =>
    request<{ url: string; filename: string; expiresIn: number }>(`/documents/${documentId}/link`),
};

/** Public payment-request lookup. No token and no workspace header; the link itself is the grant. */
export async function publicPaymentRequest(token: string): Promise<PublicPaymentRequest> {
  let res: Response;
  try {
    res = await fetch(`${getApiUrl()}/api/public/payment-requests/${encodeURIComponent(token)}`, { cache: "no-store" });
  } catch {
    throw new ApiError(0, "We can't reach the server right now. Check your connection and try again.");
  }
  if (!res.ok) throw new ApiError(res.status, "This payment link is no longer available.");
  return (await res.json()) as PublicPaymentRequest;
}

function csvForm(file: File, mapping?: ColumnMapping): FormData {
  const f = new FormData();
  f.append("file", file);
  if (mapping) f.append("mapping", JSON.stringify(mapping));
  return f;
}
