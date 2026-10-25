import type {
  Categories, CustomerDetail, CustomerSummary, Dashboard, InvoiceStatus, InvoiceView, Method, Page, SaleMethod, Series,
  TransactionView, Me, CsvPreview, ColumnMapping, ImportDetail, ImportSummary,
  Performance, PerformancePeriod, ReportSummary, ExportType,
} from "@/types/api";
import { getApiUrl } from "./env";
import { supabase } from "./supabase/client";

export class ApiError extends Error {
  constructor(public status: number, message: string, public details?: string[]) {
    super(message);
    this.name = "ApiError";
  }
  get isNotFound() { return this.status === 404; }
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
async function send(path: string, init?: RequestInit): Promise<Response> {
  let res: Response;
  const token = await accessToken();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    res = await fetch(`${getApiUrl()}/api${path}`, {
      ...init,
      signal: init?.signal ?? controller.signal,
      headers: {
        ...(init?.body && !(init.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await send(path, init);
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
    const res = await send(`/reports/export?type=${type}&from=${from}&to=${to}`);
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
};

function csvForm(file: File, mapping?: ColumnMapping): FormData {
  const f = new FormData();
  f.append("file", file);
  if (mapping) f.append("mapping", JSON.stringify(mapping));
  return f;
}
