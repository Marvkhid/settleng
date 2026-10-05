import * as React from "react";
import { cn } from "@/lib/utils";

const control = "w-full rounded-xl border border-line bg-surface px-4 text-base text-ink placeholder:text-slate/70 focus-visible:border-emerald focus-visible:outline-2 focus-visible:outline-emerald disabled:opacity-60 aria-[invalid=true]:border-red";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...p }, ref) {
  return <input ref={ref} className={cn(control, "h-12", className)} {...p} />;
});
export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...p }, ref) {
  return <textarea ref={ref} className={cn(control, "min-h-24 py-3", className)} {...p} />;
});
export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...p }, ref) {
  return <select ref={ref} className={cn(control, "h-12 appearance-none bg-[length:1rem] bg-[right_1rem_center] bg-no-repeat pr-10", className)}
    style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%235b6578' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }} {...p}>{children}</select>;
});

/** Label + control + hint + accessible error text. */
export function Field({ label, htmlFor, error, hint, optional, children, className }: {
  label: string; htmlFor: string; error?: string; hint?: string; optional?: boolean; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="block text-sm font-semibold text-ink">
        {label}{optional && <span className="ml-1 font-normal text-slate">(optional)</span>}
      </label>
      {children}
      {hint && !error && <p className="text-sm text-slate">{hint}</p>}
      {error && <p id={`${htmlFor}-error`} role="alert" className="text-sm font-medium text-red">{error}</p>}
    </div>
  );
}

/** Naira amount field: big, numeric keypad on phones, ₦ prefix. */
export const MoneyInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function MoneyInput({ className, ...p }, ref) {
  return (
    <div className="relative">
      <span aria-hidden className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-display text-xl font-semibold text-slate">₦</span>
      <input ref={ref} inputMode="decimal" autoComplete="off" placeholder="0" className={cn(control, "figure h-14 pl-10 text-2xl font-semibold", className)} {...p} />
    </div>
  );
});
