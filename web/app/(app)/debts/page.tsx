import type { Metadata } from "next";
import { DebtsView } from "@/components/forms/debts-view";

export const metadata: Metadata = { title: "Debts" };
export default function DebtsPage() { return <DebtsView />; }
