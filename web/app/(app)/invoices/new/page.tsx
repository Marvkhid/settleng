import { Suspense } from "react";
import { InvoiceFormView } from "@/components/forms/invoice-form";

export const metadata = { title: "New invoice" };
export default function NewInvoicePage() {
  return (<><h1 className="mb-6 text-3xl font-extrabold md:text-4xl">New invoice</h1><Suspense><InvoiceFormView /></Suspense></>);
}
