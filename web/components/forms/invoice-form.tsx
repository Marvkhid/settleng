"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { ErrorState, Skeleton } from "@/components/ui/states";
import { refreshAll, useQuery } from "@/hooks/use-query";
import { api, ApiError } from "@/lib/api-client";
import { addDays, formatNaira, todayIso } from "@/lib/format";
import { invoiceSchema, type InvoiceForm } from "@/lib/schemas";
import type { InvoiceView } from "@/types/api";

const clean = (v: string) => v.replace(/[₦,\s]/g, "");

export function InvoiceFormView({ invoice }: { invoice?: InvoiceView }) {
  const router = useRouter();
  const preselected = useSearchParams().get("customerId") ?? "";
  const customers = useQuery(() => api.customers({ pageSize: 100 }), []);
  const hasPayments = (invoice?.payments.length ?? 0) > 0;
  const { register, control, handleSubmit, formState: { errors, isSubmitting } } = useForm<InvoiceForm>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: invoice ? {
      customerId: invoice.customer.id, invoiceNumber: invoice.invoiceNumber, issueDate: invoice.issueDate, dueDate: invoice.dueDate,
      items: invoice.items.map((i) => ({ description: i.description, quantity: i.quantity, unitPrice: i.unitPrice })),
    } : {
      customerId: preselected, invoiceNumber: "", issueDate: todayIso(), dueDate: addDays(todayIso(), 14),
      items: [{ description: "", quantity: "1", unitPrice: "" }],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const items = useWatch({ control, name: "items" });
  // Display-only estimate; the server calculates the real total when you save.
  const estimate = (items ?? []).reduce((s, i) => s + (Number(i?.quantity) || 0) * (Number(clean(i?.unitPrice ?? "")) || 0), 0);

  const save = (draft: boolean) => handleSubmit(async (v) => {
    const payload = {
      customerId: v.customerId, issueDate: v.issueDate, dueDate: v.dueDate, invoiceNumber: v.invoiceNumber || undefined,
      items: v.items.map((i) => ({ description: i.description, quantity: i.quantity.trim(), unitPrice: clean(i.unitPrice) })),
    };
    try {
      const saved = invoice ? await api.updateInvoice(invoice.id, payload) : await api.createInvoice({ ...payload, saveAsDraft: draft });
      toast.success(invoice ? "Invoice updated" : draft ? "Draft saved" : "Invoice created");
      refreshAll(); router.push(`/invoices/${saved.id}`);
    } catch (e) { toast.error(e instanceof ApiError ? e.message : "We couldn't save this invoice. Please try again."); }
  });

  // Wait for the customer list so the pre-selected customer shows correctly.
  if (customers.error) return <ErrorState error={customers.error} onRetry={customers.refetch} title="We couldn't load your customers" />;
  if (!customers.data) return <div className="space-y-4"><Skeleton className="h-24" /><Skeleton className="h-48" /></div>;
  const options = customers.data.items;
  const extra = invoice && !options.some((c) => c.id === invoice.customer.id) ? [{ id: invoice.customer.id, name: invoice.customer.name }] : [];

  return (
    <form onSubmit={save(false)} className="space-y-6" noValidate>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Customer" htmlFor="i-customer" error={errors.customerId?.message} hint={hasPayments ? "The customer can't change once a payment is recorded." : undefined}>
          <Select id="i-customer" disabled={hasPayments} aria-invalid={!!errors.customerId} {...register("customerId")}>
            <option value="">Choose a customer</option>
            {[...extra, ...options].map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        <Field label="Invoice number" htmlFor="i-number" optional hint="Leave empty and we'll number it for you."><Input id="i-number" {...register("invoiceNumber")} /></Field>
        <Field label="Issue date" htmlFor="i-issue" error={errors.issueDate?.message}><Input id="i-issue" type="date" {...register("issueDate")} /></Field>
        <Field label="Due date" htmlFor="i-due" error={errors.dueDate?.message}><Input id="i-due" type="date" aria-invalid={!!errors.dueDate} {...register("dueDate")} /></Field>
      </div>

      <fieldset>
        <legend className="mb-2 text-lg font-bold">Items</legend>
        <ul className="space-y-3">
          {fields.map((f, idx) => (
            <li key={f.id} className="rounded-2xl border border-line bg-surface p-3">
              <div className="grid grid-cols-6 gap-3">
                <Field className="col-span-6 md:col-span-3" label="What did you sell?" htmlFor={`item-${idx}-d`} error={errors.items?.[idx]?.description?.message}>
                  <Input id={`item-${idx}-d`} {...register(`items.${idx}.description`)} />
                </Field>
                <Field className="col-span-2 md:col-span-1" label="Qty" htmlFor={`item-${idx}-q`} error={errors.items?.[idx]?.quantity?.message}>
                  <Input id={`item-${idx}-q`} inputMode="decimal" {...register(`items.${idx}.quantity`)} />
                </Field>
                <Field className="col-span-4 md:col-span-2" label="Price each (₦)" htmlFor={`item-${idx}-p`} error={errors.items?.[idx]?.unitPrice?.message}>
                  <Input id={`item-${idx}-p`} inputMode="decimal" placeholder="1500" {...register(`items.${idx}.unitPrice`)} />
                </Field>
              </div>
              {fields.length > 1 && <Button variant="ghost" size="sm" className="mt-2 text-red" onClick={() => remove(idx)} aria-label={`Remove item ${idx + 1}`}><Trash2 className="size-4" aria-hidden /> Remove</Button>}
            </li>
          ))}
        </ul>
        {errors.items?.root?.message && <p role="alert" className="mt-2 text-sm font-medium text-red">{errors.items.root.message}</p>}
        <Button variant="outline" size="sm" className="mt-3" onClick={() => append({ description: "", quantity: "1", unitPrice: "" })}><Plus className="size-4" aria-hidden /> Add another item</Button>
      </fieldset>

      <div className="rounded-2xl bg-sunken p-4">
        <p className="text-slate">Total (estimate)</p>
        <p className="figure text-3xl font-extrabold">{formatNaira(estimate)}</p>
        <p className="text-sm text-slate">The final total is worked out when you save.</p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button type="submit" size="lg" loading={isSubmitting}>{isSubmitting ? "Saving…" : invoice ? "Save changes" : "Create invoice"}</Button>
        {!invoice && <Button type="button" variant="outline" size="lg" disabled={isSubmitting} onClick={() => void save(true)()}>Save as draft</Button>}
        <Button type="button" variant="ghost" size="lg" onClick={() => router.back()}>Cancel</Button>
      </div>
    </form>
  );
}
