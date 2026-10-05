import { Suspense } from "react";
import { CustomersView } from "@/components/forms/customers-view";

export const metadata = { title: "Customers" };
export default function CustomersPage() { return <Suspense><CustomersView /></Suspense>; }
