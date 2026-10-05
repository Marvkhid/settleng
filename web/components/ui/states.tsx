import * as React from "react";
import { AlertTriangle, SearchX } from "lucide-react";
import { Button } from "./button";
import { cn } from "@/lib/utils";
import type { ApiError } from "@/lib/api-client";

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-lg bg-sunken", className)} />;
}

export function ErrorState({ error, onRetry, title = "We couldn't load this" }: { error?: ApiError | Error; onRetry?: () => void; title?: string }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3 rounded-2xl border border-red/30 bg-red-wash p-5">
      <div className="flex items-center gap-2 font-semibold text-red"><AlertTriangle className="size-5" aria-hidden /> {title}</div>
      <p className="text-ink-soft">{error?.message ?? "Something went wrong. Please try again."}</p>
      {onRetry && <Button variant="outline" size="sm" onClick={onRetry}>Try again</Button>}
    </div>
  );
}

export function EmptyState({ icon, title, body, action, asH1 }: { icon?: React.ReactNode; title: string; body: string; action?: React.ReactNode; asH1?: boolean }) {
  const Heading = asH1 ? "h1" : "h3";
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line px-6 py-12 text-center">
      <div className="text-slate" aria-hidden>{icon ?? <SearchX className="size-9" />}</div>
      <Heading className="text-xl font-bold">{title}</Heading>
      <p className="max-w-sm text-slate">{body}</p>
      {action}
    </div>
  );
}

export function NotFoundState({ what }: { what: string }) {
  return <EmptyState asH1 title={`We couldn't find that ${what}`} body={`It may have been removed, or the link is wrong. Go back and pick it from the list.`} />;
}
