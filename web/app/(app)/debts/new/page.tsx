import type { Metadata } from "next";
import { DebtForm } from "@/components/forms/debt-form";

export const metadata: Metadata = { title: "Add debt" };
export default function NewDebtPage() { return <DebtForm />; }
