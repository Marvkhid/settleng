import type {
  Categories, CustomerDetail, CustomerSummary, Dashboard, InvoiceStatus, InvoiceView, Method, Page, SaleMethod, Series,
  TransactionView, Workspace,
} from "@/types/api";
import { getApiUrl } from "./env";

export class ApiError extends Error {
  constructor(public status: number, message: string, public details?: string[]) {
    super(message);
    this.name = "ApiError";
  }
  get isNotFound() { return this.status === 404; }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${getApiUrl()}/api${path}`, {
      ...init,
      headers: { ...(init?.body && !(init.body instanceof FormData) ? { "Content-Type": "application/json" } : {}), ...init?.headers },
      cache: "no-store",
    });
  } catch {
    throw new ApiError(0, "We can't reach the server right now. Check your connection and try again.");
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
  workspace: () => request<Workspace>("/demo/workspace"),
  resetDemo: () => request<{ status: string }>("/demo/reset", json("POST")),
  dashboard: () => request<Dashboard>("/dashboard"),
  series: (period: "7d" | "30d" | "90d") => request<Series>(`/reports/timeseries?period=${period}`),

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
};
