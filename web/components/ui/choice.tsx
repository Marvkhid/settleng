import { cn } from "@/lib/utils";

export interface ChoiceOption<T extends string> { value: T; label: string; hint?: string }

/** Big tappable radio buttons: a native radio group, so keyboard and screen readers just work. */
export function ChoiceGroup<T extends string>({ legend, name, value, onChange, options, columns = 2 }: {
  legend: string; name: string; value: T | undefined; onChange: (v: T) => void; options: ChoiceOption<T>[]; columns?: 2 | 3;
}) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-semibold">{legend}</legend>
      <div className={cn("grid gap-2", columns === 3 ? "grid-cols-3" : "grid-cols-2")}>
        {options.map((o) => (
          <label key={o.value} className={cn(
            "flex min-h-12 cursor-pointer flex-col justify-center rounded-xl border px-3 py-2 text-center text-base font-semibold transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-emerald",
            value === o.value ? "border-emerald bg-emerald-wash text-emerald-ink" : "border-line bg-surface hover:bg-sunken",
          )}>
            <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} className="sr-only" />
            {o.label}
            {o.hint && <span className="text-xs font-normal text-slate">{o.hint}</span>}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
