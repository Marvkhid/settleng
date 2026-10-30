import type { Metadata } from "next";
import { LegalPage, type LegalSection } from "@/components/marketing/legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "What SettleNG collects, where it is stored, which cookies it uses, and how to ask for your data.",
  alternates: { canonical: "/privacy" },
};

const SECTIONS: LegalSection[] = [
  {
    id: "scope",
    heading: "What this policy covers",
    body: "This policy explains what happens to information you give SettleNG when you create an account and record business activity. It describes what the application actually does today. If a feature is added later that changes this, this page will be updated.",
  },
  {
    id: "what-we-collect",
    heading: "Information we hold",
    body: "SettleNG only holds what is needed to run a record-keeping account:",
    bullets: [
      "Account details: your email address and password (stored and hashed by Supabase Auth — we never see your password in readable form), plus your name if you provide it.",
      "Business details: the business name you enter, and your currency and time-zone settings.",
      "Records you create: sales, expenses, categories, customers, invoices and invoice items, payments, and the notes or descriptions you type.",
      "Files you choose to upload: when you import a bank statement CSV for record matching, the file is read and its rows are stored so you can review and match them.",
      "Audit entries: a log of changes to records in your business, kept so the history of a record is traceable.",
      "Basic technical data needed to serve the site and keep it secure (for example error and request information handled by our hosting providers).",
    ],
  },
  {
    id: "not-collected",
    heading: "What we do not collect",
    bullets: [
      "No bank login, card number, BVN or account credentials. SettleNG is not connected to any bank and cannot move money.",
      "No advertising or cross-site tracking identifiers, and no third-party marketing pixels.",
      "No contact list, location history, camera or microphone access.",
      "No payment information, because the service is free and takes no payments.",
    ],
  },
  {
    id: "why",
    heading: "Why we use it",
    body: "Your information is used to sign you in, store and display the records you enter, produce your summaries, charts and CSV exports, keep the service secure, and respond when you contact support. We do not sell your information, and we do not use your business records to advertise to you.",
  },
  {
    id: "storage",
    heading: "Where it is stored and who processes it",
    body: "SettleNG is a small application built on established providers, each of which processes data only to provide that part of the service:",
    bullets: [
      "Supabase — authentication (accounts, sign-in, password reset emails) and the PostgreSQL database that stores your records.",
      "Render — runs the application's API, which reads and writes those records.",
      "Vercel — serves the website you are looking at.",
      "Supabase's email service, or a dedicated email provider (Resend) if one is configured — sends account confirmation and password-reset messages. Those messages only contain the link needed to confirm or reset; never your records.",
    ],
  },
  {
    id: "security",
    heading: "How it is protected",
    bullets: [
      "Traffic between your browser, the website and the API is encrypted with HTTPS.",
      "Sign-in is handled by Supabase Auth; the API verifies the signed token on every private request rather than trusting the browser.",
      "Every request for your records is scoped to your own account, and the API refuses requests without a valid signed-in token.",
      "Administrative access to the database is limited to the service itself and its owner.",
    ],
  },
  {
    id: "cookies",
    heading: "Cookies and local storage",
    body: "SettleNG uses only what is needed to work. There is no advertising network and no cross-site tracking, and no consent banner, because nothing optional is switched on by default.",
    bullets: [
      "Essential cookies: set by Supabase Auth after you sign in, so the site knows who you are and keeps you signed in. Without them you cannot use your account.",
      "Local storage: a single value records whether you prefer light or dark appearance. It never leaves your device.",
      "No advertising or cross-site tracking cookies are set by SettleNG.",
      "Optional measurement: if the owner has enabled Google Analytics (it is off unless an analytics ID is configured), only the page path is recorded. Advertising signals and personalised ads are disabled, and the browser's Do Not Track / Global Privacy Control signal stops it loading altogether. Your records, amounts and sign-in details are never sent to it.",
    ],
  },
  {
    id: "retention",
    heading: "How long it is kept",
    body: "Records stay in your account until you remove them or close the account, so that your history remains available to you. Some items may remain briefly in encrypted backups after deletion. Deletion of an account removes your business records and the sign-in account; it cannot be undone.",
  },
  {
    id: "rights",
    heading: "Your choices and rights",
    body: "You can review and correct your records inside the app at any time, and download reports as CSV. You can also ask us to explain what we hold about you, correct it, export it, or delete your account. Write to the contact below from the email address you signed up with, so we can confirm it is you.",
  },
  {
    id: "children",
    heading: "Who the service is for",
    body: "SettleNG is intended for people running a business, and is not directed at children. If you believe an account has been created for a child, contact us and we will remove it.",
  },
  {
    id: "changes",
    heading: "Changes to this policy",
    body: "If how the application handles information changes, this page will be updated and the date at the top changed. Significant changes that affect your records will be highlighted in the app.",
  },
  {
    id: "contact",
    heading: "Contact",
    body: "For any privacy question or request, email adeniyimarv@gmail.com or call 0810 738 7326. The support page has WhatsApp and more detail.",
  },
];

const TO_CONFIRM = [
  "The legal name, address and registration details of the entity operating SettleNG, and whether registration with the Nigeria Data Protection Commission is required.",
  "Specific retention periods for closed accounts and backups, and the backup schedule.",
  "The confirmed hosting region for the database (Supabase reports eu-west-1) if a region commitment is to be stated publicly.",
];

export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Privacy Policy"
      updated="29 October 2026"
      intro="SettleNG keeps business records for you. This page explains, in plain language, what we hold, where it lives, and what you can ask us to do with it."
      sections={SECTIONS}
      toConfirm={TO_CONFIRM}
    />
  );
}
