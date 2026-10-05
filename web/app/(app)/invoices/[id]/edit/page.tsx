import { Suspense } from "react";
import { InvoiceDetailView } from "@/components/forms/invoice-detail";

export const metadata = { title: "Edit invoice" };
export default function EditInvoicePage() { return <Suspense><InvoiceDetailView edit /></Suspense>; }
