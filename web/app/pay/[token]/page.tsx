import type { Metadata } from "next";
import { PaymentRequestView } from "@/components/public/payment-request-view";

export const metadata: Metadata = {
  title: "Payment request",
  robots: { index: false, follow: false },
};

export default async function PayPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <PaymentRequestView token={token} />;
}
