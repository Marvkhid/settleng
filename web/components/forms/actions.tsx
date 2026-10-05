"use client";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChoiceGroup } from "@/components/ui/choice";
import { Sheet } from "@/components/ui/dialog";
import { Field, Input, MoneyInput, Select } from "@/components/ui/field";
import { useQuery, refreshAll } from "@/hooks/use-query";
import { api, ApiError } from "@/lib/api-client";
import { formatNaira, todayIso } from "@/lib/format";
import {
  cleanAmount, customerPaidSchema, expenseSchema, saleSchema,
  type CustomerPaidForm, type ExpenseForm, type SaleForm,
} from "@/lib/schemas";

type Which = "sale" | "expense" | "paid" | "menu" | null;
interface Actions { openSale: () => void; openExpense: () => void; openCustomerPaid: () => void; openMenu: () => void }
const Ctx = createContext<Actions | null>(null);
export const useActions = (): Actions => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useActions must be used inside <ActionsProvider>");
  return c;
};

export function ActionsProvider({ children }: { children: React.ReactNode }) {
  const [which, setWhich] = useState<Which>(null);
  const close = useCallback(() => setWhich(null), []);
  const value = useMemo<Actions>(() => ({
    openSale: () => setWhich("sale"), openExpense: () => setWhich("expense"),
    openCustomerPaid: () => setWhich("paid"), openMenu: () => setWhich("menu"),
  }), []);
  return (
    <Ctx.Provider value={value}>
      {children}
      <Sheet open={which === "sale"} onOpenChange={(o) => !o && close()} title="Record a sale" description="Money from a customer. No invoice needed.">
        <SaleFormBody onDone={close} />
      </Sheet>
      <Sheet open={which === "expense"} onOpenChange={(o) => !o && close()} title="Record an expense" description="Money you spent on the business.">
        <ExpenseFormBody onDone={close} />
      </Sheet>
      <Sheet open={which === "paid"} onOpenChange={(o) => !o && close()} title="Customer paid me" description="Record money a customer paid towards what they owe.">
        <CustomerPaidBody onDone={close} />
      </Sheet>
      <Sheet open={which === "menu"} onOpenChange={(o) => !o && close()} title="What happened?">
        <div className="grid gap-3">
          <Button size="lg" onClick={() => setWhich("sale")}>Record a sale</Button>
          <Button size="lg" variant="dark" onClick={() => setWhich("expense")}>Record an expense</Button>
          <Button size="lg" variant="outline" onClick={() => setWhich("paid")}>Customer paid me</Button>
        </div>
      </Sheet>
    </Ctx.Provider>
  );
}

function submitError(e: unknown, fallback: string) {
  const msg = e instanceof ApiError ? e.message : fallback;
  toast.error(msg);
  return msg;
}

function SaleFormBody({ onDone }: { onDone: () => void }) {
  const customers = useQuery(() => api.customers({ pageSize: 100 }), []);
  const { register, control, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<SaleForm>({
    resolver: zodResolver(saleSchema), defaultValues: { amount: "", paymentMethod: "CASH", customerId: "", description: "", date: todayIso() },
  });
  const method = watch("paymentMethod");
  const [more, setMore] = useState(false);

  const onSubmit = handleSubmit(async (v) => {
    try {
      const res = await api.recordSale({
        amount: cleanAmount(v.amount)!, paymentMethod: v.paymentMethod, customerId: v.customerId || undefined,
        description: v.description || undefined, date: v.date,
      });
      toast.success(res.kind === "credit_invoice" ? "Sale recorded. The customer now owes you." : "Sale recorded");
      refreshAll(); onDone();
    } catch (e) { submitError(e, "We couldn't save this sale. Please try again."); }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <Field label="How much did you sell?" htmlFor="sale-amount" error={errors.amount?.message}>
        <MoneyInput id="sale-amount" autoFocus aria-invalid={!!errors.amount} aria-describedby={errors.amount ? "sale-amount-error" : undefined} {...register("amount")} />
      </Field>
      <Controller control={control} name="paymentMethod" render={({ field }) => (
        <ChoiceGroup legend="How were you paid?" name="sale-method" value={field.value} onChange={field.onChange} options={[
          { value: "CASH", label: "Cash" }, { value: "BANK_TRANSFER", label: "Bank transfer" }, { value: "POS", label: "POS" },
          { value: "CREDIT", label: "Credit", hint: "Customer owes" },
        ]} />
      )} />
      {(method === "CREDIT" || more) && (
        <Field label="Customer" htmlFor="sale-customer" optional={method !== "CREDIT"} error={errors.customerId?.message}>
          <Select id="sale-customer" aria-invalid={!!errors.customerId} {...register("customerId")}>
            <option value="">{customers.loading ? "Loading customers…" : "Choose a customer"}</option>
            {customers.data?.items.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          {customers.error && <p className="text-sm text-red">Couldn&apos;t load customers. <button type="button" className="underline" onClick={customers.refetch}>Try again</button></p>}
        </Field>
      )}
      <button type="button" onClick={() => setMore(!more)} aria-expanded={more} className="flex items-center gap-1 text-sm font-semibold text-emerald-ink">
        <ChevronDown className={`size-4 transition-transform ${more ? "rotate-180" : ""}`} aria-hidden /> {more ? "Fewer details" : "Add details (what, date)"}
      </button>
      {more && (
        <div className="space-y-4">
          <Field label="What did you sell?" htmlFor="sale-desc" optional error={errors.description?.message}><Input id="sale-desc" placeholder="Sold goods" {...register("description")} /></Field>
          <Field label="Date" htmlFor="sale-date" error={errors.date?.message}><Input id="sale-date" type="date" max={todayIso()} {...register("date")} /></Field>
        </div>
      )}
      <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>{isSubmitting ? "Saving…" : "Save sale"}</Button>
    </form>
  );
}

const PRESET_CATEGORIES = ["Stock", "Transport", "Utilities", "Wages", "Rent", "Other"];

function ExpenseFormBody({ onDone }: { onDone: () => void }) {
  const { register, control, handleSubmit, formState: { errors, isSubmitting } } = useForm<ExpenseForm>({
    resolver: zodResolver(expenseSchema), defaultValues: { amount: "", category: "Stock", description: "", date: todayIso(), paymentMethod: "" },
  });
  const [more, setMore] = useState(false);
  const onSubmit = handleSubmit(async (v) => {
    try {
      await api.recordExpense({
        amount: cleanAmount(v.amount)!, category: v.category, description: v.description || undefined, date: v.date,
        paymentMethod: v.paymentMethod ? v.paymentMethod : undefined,
      });
      toast.success("Expense saved"); refreshAll(); onDone();
    } catch (e) { submitError(e, "We couldn't save this expense. Please try again."); }
  });
  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <Field label="How much did you spend?" htmlFor="exp-amount" error={errors.amount?.message}>
        <MoneyInput id="exp-amount" autoFocus aria-invalid={!!errors.amount} {...register("amount")} />
      </Field>
      <Controller control={control} name="category" render={({ field }) => (
        <ChoiceGroup legend="What was it for?" name="exp-category" columns={3} value={field.value} onChange={field.onChange}
          options={PRESET_CATEGORIES.map((c) => ({ value: c, label: c }))} />
      )} />
      {errors.category && <p role="alert" className="text-sm font-medium text-red">{errors.category.message}</p>}
      <Field label="Note" htmlFor="exp-desc" optional error={errors.description?.message}><Input id="exp-desc" placeholder="Bought stock" {...register("description")} /></Field>
      <button type="button" onClick={() => setMore(!more)} aria-expanded={more} className="flex items-center gap-1 text-sm font-semibold text-emerald-ink">
        <ChevronDown className={`size-4 transition-transform ${more ? "rotate-180" : ""}`} aria-hidden /> {more ? "Fewer details" : "Add details (date, how you paid)"}
      </button>
      {more && (
        <div className="space-y-4">
          <Field label="Date" htmlFor="exp-date" error={errors.date?.message}><Input id="exp-date" type="date" max={todayIso()} {...register("date")} /></Field>
          <Field label="How did you pay?" htmlFor="exp-method" optional>
            <Select id="exp-method" {...register("paymentMethod")}>
              <option value="">Not sure</option><option value="CASH">Cash</option><option value="BANK_TRANSFER">Bank transfer</option><option value="POS">POS</option>
            </Select>
          </Field>
        </div>
      )}
      <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>{isSubmitting ? "Saving…" : "Save expense"}</Button>
    </form>
  );
}

export function CustomerPaidBody({ onDone, customerId }: { onDone: () => void; customerId?: string }) {
  const owing = useQuery(() => api.customers({ owingOnly: true, pageSize: 100 }), []);
  const { register, control, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm<CustomerPaidForm>({
    resolver: zodResolver(customerPaidSchema), defaultValues: { customerId: customerId ?? "", amount: "", method: "CASH", reference: "" },
  });
  const chosen = owing.data?.items.find((c) => c.id === watch("customerId"));
  const onSubmit = handleSubmit(async (v) => {
    try {
      const res = await api.customerPaid(v.customerId, { amount: cleanAmount(v.amount)!, method: v.method, reference: v.reference || undefined });
      toast.success(`Payment recorded: ${formatNaira(res.totalApplied)}`); refreshAll(); onDone();
    } catch (e) { submitError(e, "We couldn't save this payment. Please try again."); }
  });
  if (owing.error) return <div className="space-y-3"><p className="text-red">{owing.error.message}</p><Button variant="outline" onClick={owing.refetch}>Try again</Button></div>;
  if (!owing.loading && owing.data?.items.length === 0) return <p className="py-6 text-center text-slate">Nobody owes you right now. When you record a sale on credit, they will show up here.</p>;
  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      {customerId ? <input type="hidden" {...register("customerId")} /> : (
        <Field label="Who paid?" htmlFor="paid-customer" error={errors.customerId?.message}>
          <Select id="paid-customer" aria-invalid={!!errors.customerId} {...register("customerId")}>
            <option value="">{owing.loading ? "Loading…" : "Choose a customer"}</option>
            {owing.data?.items.map((c) => <option key={c.id} value={c.id}>{c.name} owes {formatNaira(c.amountOwing)}</option>)}
          </Select>
        </Field>
      )}
      <Field label="How much did they pay?" htmlFor="paid-amount" error={errors.amount?.message}>
        <MoneyInput id="paid-amount" aria-invalid={!!errors.amount} {...register("amount")} />
        {chosen && <button type="button" className="mt-1 text-sm font-semibold text-emerald-ink underline" onClick={() => setValue("amount", chosen.amountOwing, { shouldValidate: true })}>They paid everything: {formatNaira(chosen.amountOwing)}</button>}
      </Field>
      <Controller control={control} name="method" render={({ field }) => (
        <ChoiceGroup legend="How did they pay?" name="paid-method" columns={3} value={field.value} onChange={field.onChange}
          options={[{ value: "CASH", label: "Cash" }, { value: "BANK_TRANSFER", label: "Transfer" }, { value: "POS", label: "POS" }]} />
      )} />
      <Field label="Reference" htmlFor="paid-ref" optional hint="For example a transfer reference"><Input id="paid-ref" {...register("reference")} /></Field>
      <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>{isSubmitting ? "Saving…" : "Save payment"}</Button>
    </form>
  );
}
