import { cn } from "@/lib/utils";
import type { DebtStatus } from "@/types/api";

const STYLES: Record<DebtStatus, string> = {
  PENDING: "bg-sunken text-ink-soft",
  PARTIAL: "bg-amber-wash text-amber-ink",
  OVERDUE: "bg-red-wash text-red",
  PAID: "bg-emerald-wash text-emerald-ink",
  DISPUTED: "bg-amber-wash text-amber-ink",
  WRITTEN_OFF: "bg-sunken text-slate",
  CANCELLED: "bg-sunken text-slate",
};

const LABELS: Record<DebtStatus, string> = {
  PENDING: "Unpaid",
  PARTIAL: "Partly paid",
  OVERDUE: "Overdue",
  PAID: "Paid",
  DISPUTED: "Disputed",
  WRITTEN_OFF: "Written off",
  CANCELLED: "Cancelled",
};

export function DebtPill({ status, daysOverdue }: { status: DebtStatus; daysOverdue?: number }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold", STYLES[status] ?? STYLES.PENDING)}>
      {LABELS[status] ?? status}
      {status === "OVERDUE" && daysOverdue ? ` · ${daysOverdue}d` : ""}
    </span>
  );
}
