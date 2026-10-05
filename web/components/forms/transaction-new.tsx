"use client";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ChoiceGroup } from "@/components/ui/choice";
import { Field, Input, MoneyInput } from "@/components/ui/field";
import { refreshAll, useQuery } from "@/hooks/use-query";
import { useSingleFlight } from "@/hooks/use-single-flight";
import { api, ApiError } from "@/lib/api-client";
import { todayIso } from "@/lib/format";
import { cleanAmount, transactionSchema, type TransactionForm } from "@/lib/schemas";

export function TransactionNewForm() {
  const once = useSingleFlight();
  const router = useRouter();
  const cats = useQuery(() => api.categories(), []);
  const { register, control, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<TransactionForm>({
    resolver: zodResolver(transactionSchema), defaultValues: { type: "EXPENSE", amount: "", category: "", description: "", date: todayIso() },
  });
  const type = watch("type");
  const list = (type === "INCOME" ? cats.data?.income : cats.data?.expense) ?? [];
  const submit = handleSubmit(async (v) => {
    try {
      await api.createTransaction({ type: v.type, amount: cleanAmount(v.amount)!, category: v.category, description: v.description || undefined, date: v.date });
      toast.success(v.type === "INCOME" ? "Money in saved" : "Expense saved"); refreshAll(); router.push(`/transactions?type=${v.type}`);
    } catch (e) { toast.error(e instanceof ApiError ? e.message : "We couldn't save this record. Please try again."); }
  });
  return (
    <form onSubmit={once(submit)} className="max-w-xl space-y-5" noValidate>
      <Controller control={control} name="type" render={({ field }) => (
        <ChoiceGroup legend="What kind of record is it?" name="t-type" value={field.value} onChange={field.onChange}
          options={[{ value: "INCOME", label: "Money in" }, { value: "EXPENSE", label: "Money out" }]} />
      )} />
      <Field label="Amount" htmlFor="t-amount" error={errors.amount?.message}><MoneyInput id="t-amount" autoFocus {...register("amount")} /></Field>
      <Field label="Category" htmlFor="t-cat" error={errors.category?.message} hint="Pick one or type your own.">
        <Input id="t-cat" list="t-cats" autoComplete="off" aria-invalid={!!errors.category} {...register("category")} /><datalist id="t-cats">{list.map((c) => <option key={c} value={c} />)}</datalist>
      </Field>
      <Field label="Note" htmlFor="t-desc" optional error={errors.description?.message}><Input id="t-desc" {...register("description")} /></Field>
      <Field label="Date" htmlFor="t-date" error={errors.date?.message}><Input id="t-date" type="date" max={todayIso()} {...register("date")} /></Field>
      <div className="flex gap-3">
        <Button type="submit" size="lg" loading={isSubmitting}>{isSubmitting ? "Saving…" : "Save record"}</Button>
        <Button type="button" variant="ghost" size="lg" onClick={() => router.back()}>Cancel</Button>
      </div>
    </form>
  );
}
