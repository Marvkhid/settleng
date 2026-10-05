"use client";
import { Button } from "@/components/ui/button";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-start justify-center gap-4 px-6 py-20">
      <h1 className="text-3xl font-extrabold">Something went wrong</h1>
      <p className="text-slate">This page hit a problem. Your records are safe. Try again.</p>
      <Button onClick={reset}>Try again</Button>
    </main>
  );
}
