import { Suspense } from "react";
import { TransactionsView } from "@/components/forms/transactions-view";

export const metadata = { title: "Records" };
export default function TransactionsPage() { return <Suspense><TransactionsView /></Suspense>; }
