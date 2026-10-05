"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/field";
import { refreshAll } from "@/hooks/use-query";
import { useSingleFlight } from "@/hooks/use-single-flight";
import { api, ApiError } from "@/lib/api-client";
import { customerSchema, type CustomerForm } from "@/lib/schemas";
import type { CustomerSummary } from "@/types/api";

function Body({ customer, onDone }: { customer?: CustomerSummary; onDone: (c: CustomerSummary) => void }) {
  const once = useSingleFlight();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<CustomerForm>({
    resolver: zodResolver(customerSchema),
    defaultValues: { name: customer?.name ?? "", phone: customer?.phone ?? "", email: customer?.email ?? "", notes: customer?.notes ?? "" },
  });
  const submit = handleSubmit(async (v) => {
    try {
      const payload = { name: v.name, phone: v.phone || undefined, email: v.email || undefined, notes: v.notes || undefined };
      const saved = customer ? await api.updateCustomer(customer.id, payload) : await api.createCustomer(payload);
      toast.success(customer ? "Customer updated" : "Customer added");
      refreshAll(); onDone(saved);
    } catch (e) { toast.error(e instanceof ApiError ? e.message : "We couldn't save this customer. Please try again."); }
  });
  return (
    <form onSubmit={once(submit)} className="space-y-4" noValidate>
      <Field label="Name" htmlFor="c-name" error={errors.name?.message}><Input id="c-name" autoFocus autoComplete="off" aria-invalid={!!errors.name} {...register("name")} /></Field>
      <Field label="Phone" htmlFor="c-phone" optional error={errors.phone?.message}><Input id="c-phone" type="tel" inputMode="tel" {...register("phone")} /></Field>
      <Field label="Email" htmlFor="c-email" optional error={errors.email?.message}><Input id="c-email" type="email" {...register("email")} /></Field>
      <Field label="Notes" htmlFor="c-notes" optional error={errors.notes?.message}><Textarea id="c-notes" placeholder="For example: pays at month end" {...register("notes")} /></Field>
      <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>{isSubmitting ? "Saving…" : customer ? "Save changes" : "Add customer"}</Button>
    </form>
  );
}

export function CustomerSheet({ open, onOpenChange, customer, onSaved }: {
  open: boolean; onOpenChange: (o: boolean) => void; customer?: CustomerSummary; onSaved?: (c: CustomerSummary) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={customer ? "Edit customer" : "Add a customer"}>
      <Body customer={customer} onDone={(c) => { onOpenChange(false); onSaved?.(c); }} />
    </Sheet>
  );
}
