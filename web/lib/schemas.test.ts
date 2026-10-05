import { describe, expect, it } from "vitest";
import { cleanAmount, customerSchema, expenseSchema, invoiceSchema, saleSchema } from "./schemas";

describe("cleanAmount", () => {
  it("cleans commas, naira signs and spaces", () => {
    expect(cleanAmount("2,500")).toBe("2500");
    expect(cleanAmount("₦ 2500.50")).toBe("2500.50");
  });
  it("rejects zero, negatives, junk and too many decimals", () => {
    for (const bad of ["", "0", "-5", "abc", "12.345", "1e5"]) expect(cleanAmount(bad)).toBeNull();
  });
});

describe("saleSchema", () => {
  const base = { amount: "3000", paymentMethod: "CASH" as const, date: "2026-10-04" };
  it("accepts a minimal sale (amount + method only)", () => {
    expect(saleSchema.safeParse(base).success).toBe(true);
  });
  it("requires a customer for a credit sale, and explains why", () => {
    const r = saleSchema.safeParse({ ...base, paymentMethod: "CREDIT" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toMatch(/who owes you/i);
    expect(saleSchema.safeParse({ ...base, paymentMethod: "CREDIT", customerId: "c1" }).success).toBe(true);
  });
  it("rejects a bad amount", () => {
    expect(saleSchema.safeParse({ ...base, amount: "0" }).success).toBe(false);
  });
});

describe("expenseSchema", () => {
  it("needs amount, category and date only", () => {
    expect(expenseSchema.safeParse({ amount: "5000", category: "Stock", date: "2026-10-04" }).success).toBe(true);
    expect(expenseSchema.safeParse({ amount: "5000", category: "", date: "2026-10-04" }).success).toBe(false);
  });
});

describe("customerSchema", () => {
  it("only the name is required; empty email is fine; bad email is not", () => {
    expect(customerSchema.safeParse({ name: "Mama Nkechi" }).success).toBe(true);
    expect(customerSchema.safeParse({ name: "A", email: "" }).success).toBe(true);
    expect(customerSchema.safeParse({ name: "A", email: "nope" }).success).toBe(false);
    expect(customerSchema.safeParse({ name: "  " }).success).toBe(false);
  });
});

describe("invoiceSchema", () => {
  const ok = { customerId: "c", issueDate: "2026-10-01", dueDate: "2026-10-15", items: [{ description: "Rice", quantity: "2", unitPrice: "1,500" }] };
  it("accepts a valid invoice", () => expect(invoiceSchema.safeParse(ok).success).toBe(true));
  it("rejects due before issue, no items, and zero quantity", () => {
    expect(invoiceSchema.safeParse({ ...ok, dueDate: "2026-09-30" }).success).toBe(false);
    expect(invoiceSchema.safeParse({ ...ok, items: [] }).success).toBe(false);
    expect(invoiceSchema.safeParse({ ...ok, items: [{ ...ok.items[0], quantity: "0" }] }).success).toBe(false);
  });
});
