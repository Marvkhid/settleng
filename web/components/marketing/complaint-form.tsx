"use client";
import { useMemo, useState } from "react";
import { AlertCircle, Check, Copy, Mail, MessageCircle, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { SUPPORT_EMAIL, SUPPORT_WHATSAPP } from "@/components/marketing/site-footer";

const CATEGORIES = [
  "Account access (sign-in, password)",
  "A sale or expense I recorded",
  "Invoice, customer or balance",
  "Something is not working",
  "Privacy or my data",
  "Something else",
];

type Errors = Partial<Record<"name" | "contact" | "category" | "details", string>>;

/**
 * Builds a complaint message and hands it to the user's own email app or WhatsApp. There is no
 * complaint endpoint in this app, so nothing here may pretend a message was delivered: the form
 * composes it, the person sends it, and we say exactly that.
 */
export function ComplaintForm() {
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [details, setDetails] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [ready, setReady] = useState(false);
  const [copied, setCopied] = useState(false);

  const message = useMemo(
    () =>
      [
        `Name: ${name}`,
        `Contact: ${contact}`,
        `About: ${category}`,
        "",
        details,
      ].join("\n"),
    [name, contact, category, details],
  );

  const subject = `SettleNG complaint — ${category}`;
  const mailto = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
  const whatsapp = `${SUPPORT_WHATSAPP}?text=${encodeURIComponent(`${subject}\n\n${message}`)}`;

  function validate(): Errors {
    const next: Errors = {};
    if (!name.trim()) next.name = "Please tell us your name.";
    if (!contact.trim()) next.contact = "Add an email address or phone number we can reply to.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(contact.trim()) && !/^\+?[0-9\s()-]{7,}$/.test(contact.trim()))
      next.contact = "That does not look like an email address or phone number.";
    if (!details.trim()) next.details = "Please describe what happened.";
    else if (details.trim().length < 20) next.details = "A little more detail helps us find the problem.";
    return next;
  }

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const next = validate();
        setErrors(next);
        if (Object.keys(next).length) {
          setReady(false);
          return;
        }
        setCopied(false);
        setReady(true);
      }}
      className="space-y-4"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Your name" htmlFor="c-name" error={errors.name}>
          <Input id="c-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        </Field>
        <Field
          label="Email or phone"
          htmlFor="c-contact"
          error={errors.contact}
          hint="So we can reply to you directly."
        >
          <Input
            id="c-contact"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            autoComplete="email"
            inputMode="email"
          />
        </Field>
      </div>

      <Field label="What is this about?" htmlFor="c-category">
        <Select id="c-category" value={category} onChange={(e) => setCategory(e.target.value)}>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      </Field>

      <Field
        label="What happened?"
        htmlFor="c-details"
        error={errors.details}
        hint="Dates and amounts help. Please do not include passwords or full card or bank details."
      >
        <Textarea
          id="c-details"
          rows={5}
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          placeholder="Tell us what went wrong, and what you expected to happen."
        />
      </Field>

      <Button type="submit" size="lg" className="w-full sm:w-auto">
        <Send className="size-4" aria-hidden /> Prepare my complaint
      </Button>

      {ready && (
        <div
          role="status"
          className="space-y-3 rounded-2xl border border-emerald/30 bg-emerald-wash p-4 text-ink"
        >
          <p className="flex items-start gap-2 font-semibold text-emerald-ink">
            <Check className="mt-0.5 size-5 shrink-0" aria-hidden />
            Your message is ready — send it with one of the options below.
          </p>
          <p className="text-sm text-ink-soft">
            This form does not submit anything by itself. Choose email or WhatsApp; your message will
            already be written. Nothing is sent until you press send there.
          </p>
          <div className="flex flex-wrap gap-2">
            <a
              href={mailto}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-ink px-4 font-semibold text-white hover:bg-emerald-deep"
            >
              <Mail className="size-4" aria-hidden /> Open in email
            </a>
            <a
              href={whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line bg-surface px-4 font-semibold hover:bg-sunken"
            >
              <MessageCircle className="size-4" aria-hidden /> Open in WhatsApp
            </a>
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(`To: ${SUPPORT_EMAIL}\nSubject: ${subject}\n\n${message}`);
                  setCopied(true);
                } catch {
                  setCopied(false);
                }
              }}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line bg-surface px-4 font-semibold hover:bg-sunken"
            >
              <Copy className="size-4" aria-hidden /> {copied ? "Copied" : "Copy message"}
            </button>
          </div>
          <p className="flex items-start gap-2 text-sm text-slate">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            If nothing opens, email {SUPPORT_EMAIL} directly or call 0810 738 7326.
          </p>
        </div>
      )}
    </form>
  );
}
