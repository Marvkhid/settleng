import { AlertCircle, Ban, CheckCircle2, CircleDashed, Clock, PencilLine } from "lucide-react";
import type { InvoiceStatus } from "@/types/api";
import { cn } from "@/lib/utils";

const MAP: Record<InvoiceStatus, { label: string; cls: string; Icon: typeof Clock }> = {
  PAID: { label: "Paid", cls: "bg-emerald-wash text-emerald-ink", Icon: CheckCircle2 },
  PARTIALLY_PAID: { label: "Part paid", cls: "bg-amber-wash text-amber", Icon: Clock },
  UNPAID: { label: "Unpaid", cls: "bg-sunken text-ink-soft", Icon: CircleDashed },
  OVERDUE: { label: "Overdue", cls: "bg-red-wash text-red", Icon: AlertCircle },
  DRAFT: { label: "Draft", cls: "bg-sunken text-slate", Icon: PencilLine },
  VOID: { label: "Void", cls: "bg-sunken text-slate line-through", Icon: Ban },
};

/** Icon + text + colour, so meaning never depends on colour alone. */
export function StatusBadge({ status, className }: { status: InvoiceStatus; className?: string }) {
  const { label, cls, Icon } = MAP[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-semibold", cls, className)}>
      <Icon className="size-4" aria-hidden /> {label}
    </span>
  );
}
