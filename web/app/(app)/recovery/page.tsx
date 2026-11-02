import type { Metadata } from "next";
import { RecoveryView } from "@/components/forms/recovery-view";

export const metadata: Metadata = { title: "Recovery" };
export default function RecoveryPage() { return <RecoveryView />; }
