import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-start justify-center gap-4 px-6 py-20">
      <p className="figure text-7xl font-extrabold text-emerald">404</p>
      <h1 className="text-3xl font-extrabold">We couldn&apos;t find that page</h1>
      <p className="text-slate">The link may be wrong or the page may have moved.</p>
      <Link href="/" className={buttonVariants()}>Go to home</Link>
    </main>
  );
}
