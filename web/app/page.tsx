import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-6 px-6 py-16">
      <p className="text-sm font-medium text-muted-foreground">Demo mode · Sample business</p>
      <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
        Know where your business money is going.
      </h1>
      <p className="text-lg text-muted-foreground">
        Track sales, expenses, customer debts and payments in one simple place.
      </p>
      <div>
        <Link href="/dashboard" className={cn(buttonVariants())}>
          Explore Demo
        </Link>
      </div>
      <p className="text-sm text-muted-foreground">
        Foundation placeholder. The full landing page and dashboard arrive in Phase 4.
      </p>
    </main>
  );
}
