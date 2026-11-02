"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { publicPaymentRequest } from "@/lib/api-client";
import { formatNaira } from "@/lib/format";
import type { PublicPaymentRequest } from "@/types/api";

/** The public page behind a payment link. Read-only, and it never shows third-party details. */
export function PaymentRequestView({ token }: { token: string }) {
  const [state, setState] = useState<{ loading: boolean; data?: PublicPaymentRequest; error?: string }>({ loading: true });

  useEffect(() => {
    let cancelled = false;
    publicPaymentRequest(token)
      .then((data) => { if (!cancelled) setState({ loading: false, data }); })
      .catch((err: Error) => { if (!cancelled) setState({ loading: false, error: err.message }); });
    return () => { cancelled = true; };
  }, [token]);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center px-4 py-10">
      {state.loading ? (
        <div className="animate-pulse space-y-3">
          <div className="h-8 w-40 rounded-lg bg-sunken" />
          <div className="h-40 rounded-2xl bg-sunken" />
        </div>
      ) : state.error || !state.data ? (
        <div className="rounded-2xl border border-line bg-surface p-6 text-center">
          <h1 className="text-xl font-extrabold">This link is not available</h1>
          <p className="mt-2 text-slate">{state.error ?? "Ask the business to send a new payment link."}</p>
          <Link href="/" className="mt-4 inline-block font-semibold text-emerald-ink underline">Go to SettleNG</Link>
        </div>
      ) : (
        <>
          <p className="text-sm font-semibold uppercase tracking-wide text-slate">{state.data.business}</p>
          <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight">Payment request</h1>
          <p className="mt-1 text-slate">{state.data.description}</p>

          <div className="mt-6 rounded-2xl border border-line bg-surface p-6">
            <p className="text-sm font-semibold text-slate">Amount outstanding</p>
            <p className="figure tnum mt-1 text-4xl font-extrabold">{formatNaira(state.data.balance)}</p>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between gap-4"><dt className="text-slate">Original amount</dt><dd>{formatNaira(state.data.amountOwed)}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-slate">Already paid</dt><dd>{formatNaira(state.data.amountPaid)}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-slate">Due</dt><dd>{state.data.dueOn ?? "No date agreed"}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-slate">Reference</dt><dd className="figure">{state.data.reference}</dd></div>
            </dl>
          </div>

          <p className="mt-4 rounded-2xl bg-sunken p-4 text-sm text-ink-soft">{state.data.instructions}</p>
          <p className="mt-2 text-sm text-slate">{state.data.disputeContact}</p>
        </>
      )}
    </main>
  );
}
