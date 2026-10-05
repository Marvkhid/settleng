import { z } from "zod";

/** Accepts "2,500", "₦2500.50", " 2500 ". Returns a clean "2500.50" or null if it isn't a valid amount. */
export function cleanAmount(raw: string): string | null {
  const s = raw.replace(/[₦,\s]/g, "");
  return /^\d{1,12}(\.\d{1,2})?$/.test(s) && Number(s) > 0 ? s : null;
}

const amount = z.string().refine((v) => cleanAmount(v) !== null, { message: "Enter an amount above zero, for example 2500" });
const optionalText = (max: number) => z.string().max(max, `Keep this under ${max} characters`).optional();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date");

export const saleSchema = z
  .object({
    amount,
    paymentMethod: z.enum(["CASH", "BANK_TRANSFER", "POS", "CREDIT"]),
    customerId: z.string().optional(),
    description: optionalText(200),
    date: isoDate,
  })
  .refine((v) => v.paymentMethod !== "CREDIT" || !!v.customerId, { path: ["customerId"], message: "Choose who owes you for this sale" });
export type SaleForm = z.infer<typeof saleSchema>;

export const expenseSchema = z.object({
  amount,
  category: z.string().trim().min(1, "Choose what you spent it on").max(60),
  description: optionalText(200),
  date: isoDate,
  paymentMethod: z.enum(["", "CASH", "BANK_TRANSFER", "POS"]).optional(),
});
export type ExpenseForm = z.infer<typeof expenseSchema>;

export const customerPaidSchema = z.object({
  customerId: z.string().min(1, "Choose the customer"),
  amount,
  method: z.enum(["CASH", "BANK_TRANSFER", "POS"]),
  reference: optionalText(80),
});
export type CustomerPaidForm = z.infer<typeof customerPaidSchema>;

export const paymentSchema = z.object({
  amount,
  method: z.enum(["CASH", "BANK_TRANSFER", "POS"]),
  paymentDate: isoDate,
  reference: optionalText(80),
});
export type PaymentForm = z.infer<typeof paymentSchema>;

export const customerSchema = z.object({
  name: z.string().trim().min(1, "Enter the customer's name").max(120),
  phone: optionalText(30),
  email: z.union([z.literal(""), z.string().email("That email doesn't look right")]).optional(),
  notes: optionalText(500),
});
export type CustomerForm = z.infer<typeof customerSchema>;

export const invoiceSchema = z
  .object({
    customerId: z.string().min(1, "Choose the customer"),
    invoiceNumber: optionalText(40),
    issueDate: isoDate,
    dueDate: isoDate,
    items: z
      .array(
        z.object({
          description: z.string().trim().min(1, "Describe the item").max(200),
          quantity: z.string().refine((v) => /^\d{1,8}(\.\d{1,2})?$/.test(v.trim()) && Number(v) > 0, "Enter a quantity above zero"),
          unitPrice: z.string().refine((v) => /^\d{1,12}(\.\d{1,2})?$/.test(v.replace(/[₦,\s]/g, "")), "Enter a price, for example 1500"),
        }),
      )
      .min(1, "Add at least one item"),
  })
  .refine((v) => v.dueDate >= v.issueDate, { path: ["dueDate"], message: "The due date can't be before the issue date" });
export type InvoiceForm = z.infer<typeof invoiceSchema>;

export const transactionSchema = z.object({
  type: z.enum(["INCOME", "EXPENSE"]),
  amount,
  category: z.string().trim().min(1, "Choose or type a category").max(60),
  description: optionalText(200),
  date: isoDate,
});
export type TransactionForm = z.infer<typeof transactionSchema>;
