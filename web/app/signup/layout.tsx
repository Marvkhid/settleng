import type { Metadata } from "next";

/** The sign-up page is a client component, so its metadata lives here. */
export const metadata: Metadata = {
  title: "Create a free account",
  description:
    "Create a free SettleNG account and start recording sales, expenses and customer debts in minutes. No card, no bank connection, no subscription.",
  alternates: { canonical: "/signup" },
  openGraph: {
    title: "Create a free SettleNG account",
    description:
      "Keep a proper record of sales, expenses and customer debts. Free for Nigerian traders and small businesses.",
    url: "/signup",
  },
};

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
