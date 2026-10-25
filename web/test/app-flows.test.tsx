import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, within, act, renderHook } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Toaster, toast } from "sonner";

import { ActionsProvider, useActions } from "@/components/forms/actions";
import { CustomerSheet } from "@/components/forms/customer-form";
import { SettingsForm } from "@/components/forms/settings-form";
import { AuthProvider } from "@/components/auth/auth-provider";
import { PerformanceChart } from "@/components/dashboard/performance-chart";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { ReportsView } from "@/components/forms/reports-view";
import { useGreeting } from "@/hooks/use-greeting";
import { ApiError } from "@/lib/api-client";
import type { CustomerSummary, Performance, ReportSummary } from "@/types/api";

/* ------------------------------------------------------------------ *
 * Mock registry, kept on globalThis so the hoisted vi.mock factories
 * never close over module-scope bindings (see auth-pages.test.tsx).
 * ------------------------------------------------------------------ */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function flowApi(): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g = globalThis as any;
  if (!g.__flowApi) {
    g.__flowApi = {
      me: vi.fn(),
      dashboard: vi.fn(),
      recordExpense: vi.fn(),
      createCustomer: vi.fn(),
      updateCustomer: vi.fn(),
      updateBusiness: vi.fn(),
      performance: vi.fn(),
      reportSummary: vi.fn(),
      exportCsv: vi.fn(),
      deleteAccount: vi.fn(),
    };
  }
  return g.__flowApi;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function flowSupabase(): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g = globalThis as any;
  if (!g.__flowSupabase) {
    g.__flowSupabase = {
      auth: {
        getUser: vi.fn(async () => ({ data: { user: { id: "u1", email: "owner@example.com" } }, error: null })),
        getSession: vi.fn(async () => ({ data: { session: { access_token: "tok", user: { id: "u1" } } }, error: null })),
        updateUser: vi.fn(async () => ({ error: null })),
        signOut: vi.fn(async () => ({ error: null })),
      },
    };
  }
  return g.__flowSupabase;
}

vi.mock("@/lib/supabase/client", () => ({
  supabase: () => flowSupabase(),
}));

vi.mock("@/lib/api-client", () => ({
  api: flowApi(),
  ApiError: class ApiError extends Error {
    status: number;
    details?: string[];
    constructor(status: number, message: string, details?: string[]) {
      super(message);
      this.status = status;
      this.name = "ApiError";
      this.details = details;
    }
    get isNotFound() {
      return this.status === 404;
    }
  },
}));

const ME = {
  userId: "u1",
  fullName: "Marvel Okafor",
  business: { id: "b1", name: "Marvel Stores", currency: "NGN" },
};

const CUSTOMER: CustomerSummary = {
  id: "c1",
  name: "Ada Obi",
  email: null,
  phone: "0803 123 4567",
  notes: null,
  archived: false,
  totalBought: "0.00",
  totalPaid: "0.00",
  amountOwing: "0.00",
};

function performance(over: Partial<Performance> = {}): Performance {
  return {
    period: "30d",
    granularity: "day",
    currency: "NGN",
    from: "2026-09-26",
    to: "2026-10-25",
    previousFrom: "2026-08-27",
    previousTo: "2026-09-25",
    previousLabel: "the previous 30 days",
    points: [
      { start: "2026-09-26", end: "2026-09-26", sales: "1000.00", expenses: "200.00", profit: "800.00" },
      { start: "2026-10-25", end: "2026-10-25", sales: "1500.00", expenses: "300.00", profit: "1200.00" },
    ],
    totals: { sales: "2500.00", expenses: "500.00", profit: "2000.00" },
    comparison: {
      sales: { current: "2500.00", previous: "2000.00", changePct: 25, direction: "UP" },
      expenses: { current: "500.00", previous: "400.00", changePct: 25, direction: "UP" },
      profit: { current: "2000.00", previous: "1600.00", changePct: 25, direction: "UP" },
    },
    trend: "IMPROVING",
    hasData: true,
    enoughHistory: true,
    insights: [
      "Sales increased by 25.0% compared with the previous 30 days.",
      "Profit rose by 25.0% compared with the previous 30 days, to ₦2,000.00.",
    ],
    ...over,
  };
}

const SUMMARY: ReportSummary = {
  range: { from: "2026-09-26", to: "2026-10-25" },
  sales: { total: "2500.00", recorded: "2000.00", onInvoices: "500.00" },
  expenses: { total: "500.00" },
  moneyIn: "2500.00",
  moneyOut: "500.00",
  netRecordedMovement: "2000.00",
  customersOwing: { total: "0.00", customerCount: 0, invoiceCount: 0 },
  overdueInvoices: { count: 0, total: "0.00" },
  expensesByCategory: [{ category: "Stock", total: "500.00", count: 1 }],
  incomeByCategory: [{ category: "Sales", total: "2500.00", count: 1 }],
};

beforeEach(() => {
  toast.dismiss();
  for (const fn of Object.values(flowApi())) (fn as ReturnType<typeof vi.fn>).mockReset();
});

/* ------------------------------------------------------------------ *
 * Quick action: record an expense
 * ------------------------------------------------------------------ */

function ExpenseButton() {
  const { openExpense } = useActions();
  return (
    <button type="button" onClick={openExpense}>
      Open expense sheet
    </button>
  );
}

function renderExpenseSheet() {
  render(
    <>
      <Toaster richColors />
      <ActionsProvider>
        <ExpenseButton />
      </ActionsProvider>
    </>,
  );
}

describe("recording an expense", () => {
  const user = userEvent.setup();

  it("saves the real payload, shows progress and closes on success", async () => {
    const api = flowApi();
    let resolve!: (v: unknown) => void;
    api.recordExpense.mockReturnValue(new Promise((r) => { resolve = r; }));

    renderExpenseSheet();
    await user.click(screen.getByRole("button", { name: "Open expense sheet" }));
    const dialog = await screen.findByRole("dialog");

    await user.type(within(dialog).getByLabelText(/how much did you spend/i), "2,500.50");
    await user.click(within(dialog).getByRole("button", { name: /save expense/i }));

    await waitFor(() => expect(api.recordExpense).toHaveBeenCalledTimes(1));
    expect(api.recordExpense.mock.calls[0][0]).toMatchObject({
      amount: "2500.50",
      category: "Stock",
    });
    // While the request is in flight the button is disabled and says so.
    const saving = within(dialog).getByRole("button", { name: /saving/i });
    expect(saving).toBeDisabled();

    await act(async () => { resolve({ id: "t1" }); });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(await screen.findByText("Expense saved")).toBeInTheDocument();
  });

  it("does not stay stuck when the server rejects the expense", async () => {
    const api = flowApi();
    api.recordExpense.mockRejectedValue(new ApiError(400, "The amount must be more than zero."));

    renderExpenseSheet();
    await user.click(screen.getByRole("button", { name: "Open expense sheet" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText(/how much did you spend/i), "500");
    await user.click(within(dialog).getByRole("button", { name: /save expense/i }));

    await waitFor(() => expect(api.recordExpense).toHaveBeenCalled());
    // The error is visible, the sheet stays open and the button is usable again.
    expect(await screen.findByText("The amount must be more than zero.")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    const save = within(screen.getByRole("dialog")).getByRole("button", { name: /save expense/i });
    expect(save).not.toBeDisabled();
  });

  it("validates before calling the API", async () => {
    const api = flowApi();
    renderExpenseSheet();
    await user.click(screen.getByRole("button", { name: "Open expense sheet" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: /save expense/i }));
    await waitFor(() => expect(within(dialog).getByRole("alert")).toBeInTheDocument());
    expect(api.recordExpense).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});

/* ------------------------------------------------------------------ *
 * Customers
 * ------------------------------------------------------------------ */

describe("adding a customer", () => {
  const user = userEvent.setup();

  it("saves the customer and hands the saved record back", async () => {
    const api = flowApi();
    api.createCustomer.mockResolvedValue(CUSTOMER);
    const onSaved = vi.fn();
    render(
      <>
        <Toaster richColors />
        <CustomerSheet open onOpenChange={() => {}} onSaved={onSaved} />
      </>,
    );
    await user.type(await screen.findByLabelText("Name"), "Ada Obi");
    await user.type(screen.getByLabelText(/phone/i), "0803 123 4567");
    await user.click(screen.getByRole("button", { name: /add customer/i }));

    await waitFor(() => expect(api.createCustomer).toHaveBeenCalledTimes(1));
    expect(api.createCustomer).toHaveBeenCalledWith({
      name: "Ada Obi",
      phone: "0803 123 4567",
      email: undefined,
      notes: undefined,
    });
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(CUSTOMER));
    expect(await screen.findByText("Customer added")).toBeInTheDocument();
  });

  it("shows the server's message and stays open when saving fails", async () => {
    const api = flowApi();
    api.createCustomer.mockRejectedValue(new ApiError(400, "That email does not look right."));
    const onSaved = vi.fn();
    render(
      <>
        <Toaster richColors />
        <CustomerSheet open onOpenChange={() => {}} onSaved={onSaved} />
      </>,
    );
    await user.type(await screen.findByLabelText("Name"), "Ada Obi");
    await user.type(screen.getByLabelText(/email/i), "ada@example.com");
    await user.click(screen.getByRole("button", { name: /add customer/i }));

    expect(await screen.findByText("That email does not look right.")).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add customer/i })).not.toBeDisabled();
  });
});

/* ------------------------------------------------------------------ *
 * Settings: business name
 * ------------------------------------------------------------------ */

function renderSettings() {
  return render(
    <>
      <Toaster richColors />
      <AuthProvider>
        <SettingsForm />
      </AuthProvider>
    </>,
  );
}

describe("business name in settings", () => {
  const user = userEvent.setup();

  beforeEach(() => {
    flowApi().me.mockResolvedValue(ME);
  });

  it("loads the saved name, saves the trimmed new one and refreshes the profile", async () => {
    const api = flowApi();
    api.updateBusiness.mockResolvedValue({
      business: { id: "b1", name: "Marvel Fabrics", currency: "NGN" },
    });
    renderSettings();

    const input = await screen.findByLabelText("Business name");
    await waitFor(() => expect(input).toHaveValue("Marvel Stores"));

    await user.clear(input);
    await user.type(input, "  Marvel Fabrics  ");
    await user.click(screen.getByRole("button", { name: /save business name/i }));

    await waitFor(() => expect(api.updateBusiness).toHaveBeenCalledWith({ name: "Marvel Fabrics" }));
    expect(await screen.findByText("Business name updated")).toBeInTheDocument();
    await waitFor(() => expect(input).toHaveValue("Marvel Fabrics"));
    // The refreshed profile is what makes the sidebar/dashboard show the new name.
    await waitFor(() => expect(api.me).toHaveBeenCalledTimes(2));
  });

  it("rejects an empty name without calling the API", async () => {
    const api = flowApi();
    renderSettings();
    const input = await screen.findByLabelText("Business name");
    await waitFor(() => expect(input).toHaveValue("Marvel Stores"));
    await user.clear(input);
    await user.click(screen.getByRole("button", { name: /save business name/i }));
    expect(await screen.findByText("Enter your business name.")).toBeInTheDocument();
    expect(api.updateBusiness).not.toHaveBeenCalled();
  });

  it("shows a server error and re-enables the button", async () => {
    const api = flowApi();
    api.updateBusiness.mockRejectedValue(new ApiError(500, "We couldn't save that. Please try again."));
    renderSettings();
    const input = await screen.findByLabelText("Business name");
    await waitFor(() => expect(input).toHaveValue("Marvel Stores"));
    await user.clear(input);
    await user.type(input, "Another Name");
    await user.click(screen.getByRole("button", { name: /save business name/i }));

    // The message appears inline and as a toast.
    expect(await screen.findAllByText("We couldn't save that. Please try again.")).not.toHaveLength(0);
    expect(screen.getByRole("button", { name: /save business name/i })).not.toBeDisabled();
  });
});

/* ------------------------------------------------------------------ *
 * Dashboard greeting
 * ------------------------------------------------------------------ */

describe("dashboard greeting", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses the saved first name and changes as the business day moves on", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-05T10:59:00Z")); // 11:59 in Lagos
    const { result } = renderHook(() => useGreeting("Marvel"));
    expect(result.current).toBe("Good morning, Marvel");

    act(() => {
      vi.setSystemTime(new Date("2026-10-05T11:01:00Z")); // 12:01 in Lagos
      vi.advanceTimersByTime(60_000);
    });
    expect(result.current).toBe("Good afternoon, Marvel");
  });

  it("stays neutral while the name is unknown", () => {
    expect(renderHook(() => useGreeting(null)).result.current).toMatch(/^Good (morning|afternoon|evening)$/);
  });
});

/* ------------------------------------------------------------------ *
 * Home dashboard
 * ------------------------------------------------------------------ */

describe("home dashboard", () => {
  it("greets the owner by their saved name and shows their business and figures", async () => {
    const api = flowApi();
    api.me.mockResolvedValue(ME);
    api.dashboard.mockResolvedValue({
      today: "2026-10-25",
      salesToday: "12000.00",
      expensesToday: "3000.00",
      moneyIn: "12000.00",
      moneyOut: "3000.00",
      customersOwing: { total: "0.00", customerCount: 0, invoiceCount: 0 },
      overdueInvoices: { count: 0, total: "0.00" },
      topDebtors: [],
      recentActivity: [],
    });
    api.performance.mockResolvedValue(performance());

    render(
      <>
        <Toaster richColors />
        <AuthProvider>
          <ActionsProvider>
            <DashboardView />
          </ActionsProvider>
        </AuthProvider>
      </>,
    );

    const heading = await screen.findByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent(/Good (morning|afternoon|evening), Marvel/);
    expect(screen.getByText("Marvel Stores")).toBeInTheDocument();
    expect(screen.getAllByText("₦12,000").length).toBeGreaterThan(0);
    // The performance chart is part of Home and loads its own data.
    expect(await screen.findByText("Business performance")).toBeInTheDocument();
    expect(await screen.findByText("₦2,500")).toBeInTheDocument();
  });
});

/* ------------------------------------------------------------------ *
 * Performance chart
 * ------------------------------------------------------------------ */

describe("business performance chart", () => {
  const user = userEvent.setup();

  it("shows the server's totals, comparison and insights for 30 days", async () => {
    const api = flowApi();
    api.performance.mockResolvedValue(performance());
    render(<PerformanceChart />);

    expect(await screen.findByText("₦2,500")).toBeInTheDocument(); // revenue
    expect(screen.getByText("₦500")).toBeInTheDocument(); // expenses
    expect(screen.getByText("₦2,000")).toBeInTheDocument(); // profit
    expect(screen.getByText("Improving")).toBeInTheDocument();
    expect(screen.getByText(/Sales increased by 25\.0%/)).toBeInTheDocument();
    expect(api.performance).toHaveBeenCalledWith("30d");
  });

  it("asks for a new period only when the owner picks one", async () => {
    const api = flowApi();
    api.performance.mockResolvedValue(performance());
    render(<PerformanceChart />);
    await screen.findByText("₦2,500");
    expect(api.performance).toHaveBeenCalledTimes(1);

    api.performance.mockResolvedValue(performance({ period: "7d", granularity: "day", points: [] }));
    await user.click(screen.getByRole("button", { name: "7 days" }));
    await waitFor(() => expect(api.performance).toHaveBeenCalledWith("7d"));
    expect(api.performance).toHaveBeenCalledTimes(2);
  });

  it("switches what is charted", async () => {
    const api = flowApi();
    api.performance.mockResolvedValue(performance());
    render(<PerformanceChart />);
    await screen.findByText("₦2,500");
    await user.click(screen.getByRole("button", { name: "Profit" }));
    expect(screen.getByRole("img", { name: /profit/i })).toBeInTheDocument();
  });

  it("explains an empty business instead of drawing invented numbers", async () => {
    const api = flowApi();
    api.performance.mockResolvedValue(
      performance({
        totals: { sales: "0.00", expenses: "0.00", profit: "0.00" },
        comparison: {
          sales: { current: "0.00", previous: "0.00", changePct: null, direction: "FLAT" },
          expenses: { current: "0.00", previous: "0.00", changePct: null, direction: "FLAT" },
          profit: { current: "0.00", previous: "0.00", changePct: null, direction: "FLAT" },
        },
        points: [],
        trend: "UNKNOWN",
        hasData: false,
        enoughHistory: false,
        insights: ["No sales or expenses recorded in this period yet. Record a sale or an expense and the chart will fill in."],
      }),
    );
    render(<PerformanceChart />);
    expect(await screen.findByText("Nothing to chart yet")).toBeInTheDocument();
    expect(screen.getByText("Not enough history")).toBeInTheDocument();
  });

  it("shows an error with a working retry", async () => {
    const api = flowApi();
    api.performance.mockRejectedValueOnce(new ApiError(0, "We can't reach the server right now."));
    api.performance.mockResolvedValue(performance());
    render(<PerformanceChart />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/can't reach the server/i);
    await user.click(screen.getByRole("button", { name: /try again/i }));
    expect(await screen.findByText("₦2,500")).toBeInTheDocument();
  });
});

/* ------------------------------------------------------------------ *
 * Reports
 * ------------------------------------------------------------------ */

describe("reports page", () => {
  const user = userEvent.setup();

  it("loads the summary through the authenticated client and downloads the CSV", async () => {
    const api = flowApi();
    api.reportSummary.mockResolvedValue(SUMMARY);
    api.exportCsv.mockResolvedValue({ blob: new Blob(["a,b"]), filename: "transactions.csv" });
    const createObjectURL = vi.fn(() => "blob:report");
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    render(
      <>
        <Toaster richColors />
        <ReportsView />
      </>,
    );

    expect(await screen.findAllByText("₦2,500")).not.toHaveLength(0);
    expect(api.reportSummary).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: /all records \(csv\)/i }));
    await waitFor(() => expect(api.exportCsv).toHaveBeenCalledTimes(1));
    expect(api.exportCsv.mock.calls[0][0]).toBe("transactions");
    expect(createObjectURL).toHaveBeenCalled();

    click.mockRestore();
  });
});
