import { Suspense } from "react";
import { ReconciliationView } from "@/components/forms/reconciliation-view";

export const metadata = { title: "Match records" };
export default function ReconciliationPage() { return <Suspense><ReconciliationView /></Suspense>; }
