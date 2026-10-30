import type { Metadata } from "next";
import { LegalPage, type LegalSection } from "@/components/marketing/legal-page";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "The terms for using SettleNG: what the service is, what it is not, and what we each agree to.",
  alternates: { canonical: "/terms" },
};

const SECTIONS: LegalSection[] = [
  {
    id: "agreement",
    heading: "These terms",
    body: "By creating an account or using SettleNG, you agree to these terms. If you do not agree with them, please do not use the service.",
  },
  {
    id: "service",
    heading: "What SettleNG is",
    body: "SettleNG is a free record-keeping tool for small businesses. It lets you write down sales and expenses, keep customer balances, create invoices, review summaries and charts, and download reports. Everything shown in the app is calculated from records you entered yourself.",
  },
  {
    id: "not-financial-advice",
    heading: "What SettleNG is not",
    bullets: [
      "It is not a bank, payment provider or financial institution. It cannot receive, hold, transfer or process money.",
      "It is not connected to your bank account, and it never asks for bank credentials, card numbers or your BVN.",
      "It does not provide financial, tax, investment or legal advice. Figures and summaries help you see your own records — decisions remain yours.",
      "It does not guarantee that a business will grow, become more profitable, or avoid losses.",
      "Recorded income is not the same as profit. Where the app shows profit, it subtracts recorded expenses from recorded sales, nothing more.",
    ],
  },
  {
    id: "free",
    heading: "Free to use",
    body: "The core features are provided at no cost. There is no subscription, trial period, paywall or premium tier, and you are never asked for payment details. If a paid feature is ever introduced, it will be optional, clearly described, and these terms will be updated first.",
  },
  {
    id: "account",
    heading: "Your account",
    bullets: [
      "You need a working email address to sign up, and you are responsible for keeping your password private.",
      "Provide accurate information and use the service for your own business. One person should not use another person's account.",
      "Tell us promptly if you believe someone else has access to your account.",
    ],
  },
  {
    id: "your-content",
    heading: "Your records remain yours",
    body: "You keep ownership of the information you enter. You allow us to store, process and display it only so the service can work for you — for example, to show your dashboard, generate a report, or match an imported CSV row to an invoice. We do not sell your records or publish them.",
  },
  {
    id: "acceptable-use",
    heading: "Acceptable use",
    bullets: [
      "Do not use SettleNG for unlawful activity, or to record information you have no right to hold.",
      "Do not attempt to access another person's records, break the service's security, or interfere with its normal operation.",
      "Do not upload files containing malware, or content that is not yours to upload.",
    ],
  },
  {
    id: "accuracy",
    heading: "Accuracy of what you see",
    body: "The application calculates from the entries you make. A wrong amount, date or category will produce a wrong total, and no tool can catch every mistake. Check your records before relying on a report, and keep your own copies of anything important.",
  },
  {
    id: "availability",
    heading: "Availability and changes",
    body: "We work to keep SettleNG running, but the service is provided as it is. It may occasionally be unavailable for maintenance, or because a hosting provider has a problem. Features may be added, changed or removed as the product develops. Where a change significantly affects your records, we will try to give notice in the app.",
  },
  {
    id: "liability",
    heading: "Limitation of liability",
    body: "To the extent permitted by law, SettleNG and its owner are not liable for indirect or consequential losses arising from use of the service, including lost profits or business decisions made using the app. Nothing in these terms excludes liability that cannot lawfully be excluded.",
  },
  {
    id: "ending",
    heading: "Ending your use",
    body: "You may stop using SettleNG at any time, and may ask us to close your account and delete your records. We may suspend an account that is used to attack the service, break these terms, or harm other users.",
  },
  {
    id: "law",
    heading: "Governing law",
    body: "These terms are governed by the laws of the Federal Republic of Nigeria, and disputes are subject to the jurisdiction of Nigerian courts.",
  },
  {
    id: "contact",
    heading: "Contact",
    body: "Questions about these terms: email adeniyimarv@gmail.com or call 0810 738 7326. Complaints and feedback can also be raised from the support page.",
  },
];

const TO_CONFIRM = [
  "The registered business name and address to be named as the service provider.",
  "A stated notice period for material changes to these terms.",
  "Whether a formal complaints or escalation procedure (with response times) should be published.",
];

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Terms of Service"
      updated="29 October 2026"
      intro="Plain terms for using SettleNG: what the tool does, what it deliberately does not do, and what we each agree to."
      sections={SECTIONS}
      toConfirm={TO_CONFIRM}
    />
  );
}
