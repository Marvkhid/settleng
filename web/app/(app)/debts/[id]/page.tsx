import type { Metadata } from "next";
import { DebtDetailView } from "@/components/forms/debt-detail";

export const metadata: Metadata = { title: "Debt" };
export default async function DebtPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DebtDetailView id={id} />;
}
