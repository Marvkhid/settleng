import { describe, expect, it } from "vitest";
import { addDays, formatNaira, friendlyDate, greeting, todayIso } from "./format";

describe("formatNaira", () => {
  it("formats whole amounts without decimals and groups thousands", () => {
    expect(formatNaira("25000.00")).toBe("₦25,000");
    expect(formatNaira("1250000.00")).toBe("₦1,250,000");
    expect(formatNaira(150000)).toBe("₦150,000");
  });
  it("keeps kobo when present and never shows long decimals", () => {
    expect(formatNaira("2500.50")).toBe("₦2,500.50");
    expect(formatNaira("25000.000000")).toBe("₦25,000");
  });
  it("supports explicit +/- for money in and out", () => {
    expect(formatNaira("5000.00", { signed: "+" })).toBe("+₦5,000");
    expect(formatNaira("8000.00", { signed: "-" })).toBe("-₦8,000");
  });
  it("handles empty values", () => {
    expect(formatNaira(null)).toBe("₦0");
    expect(formatNaira(undefined)).toBe("₦0");
  });
});

describe("dates", () => {
  it("says Today / Yesterday, then a short date", () => {
    expect(friendlyDate("2026-10-04", "2026-10-04")).toBe("Today");
    expect(friendlyDate("2026-10-03", "2026-10-04")).toBe("Yesterday");
    expect(friendlyDate("2026-09-21", "2026-10-04")).toBe("21 Sep");
    expect(friendlyDate("2025-12-30", "2026-10-04")).toBe("30 Dec 2025");
  });
  it("adds days across month ends", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
  it("uses Lagos time for 'today' and the greeting", () => {
    expect(todayIso(new Date("2026-10-04T23:30:00Z"))).toBe("2026-10-05"); // 00:30 in Lagos
    expect(greeting(new Date("2026-10-04T07:00:00Z"))).toBe("Good morning"); // 08:00 Lagos
    expect(greeting(new Date("2026-10-04T13:00:00Z"))).toBe("Good afternoon");
    expect(greeting(new Date("2026-10-04T19:00:00Z"))).toBe("Good evening");
  });
});
