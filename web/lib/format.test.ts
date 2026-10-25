import { describe, expect, it } from "vitest";
import { addDays, formatNaira, friendlyDate, greeting, greetingFor, hourInZone, monthShort, todayIso } from "./format";

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

  it("greets by Lagos time even when the device is in another timezone", () => {
    // 04:00 and 20:00 UTC are 05:00 and 21:00 in Lagos (UTC+1, no daylight saving).
    expect(hourInZone(new Date("2026-10-04T04:00:00Z"))).toBe(5);
    expect(hourInZone(new Date("2026-10-04T20:00:00Z"))).toBe(21);
    expect(hourInZone(new Date("2026-10-04T23:30:00Z"))).toBe(0); // midnight, not 24
  });

  it("changes greeting exactly at the boundaries", () => {
    const at = (lagosHour: number, lagosMinute = 0) =>
      new Date(Date.UTC(2026, 9, 5, lagosHour - 1, lagosMinute));
    expect(greeting(at(4, 59))).toBe("Good evening"); // 04:59 overnight
    expect(greeting(at(5, 0))).toBe("Good morning"); // 05:00
    expect(greeting(at(11, 59))).toBe("Good morning");
    expect(greeting(at(12, 0))).toBe("Good afternoon");
    expect(greeting(at(16, 59))).toBe("Good afternoon");
    expect(greeting(at(17, 0))).toBe("Good evening");
    expect(greeting(at(23, 59))).toBe("Good evening");
  });

  it("uses the saved first name, and stays neutral without one", () => {
    const morning = new Date("2026-10-04T07:00:00Z"); // 08:00 Lagos
    expect(greetingFor("Marvel", morning)).toBe("Good morning, Marvel");
    expect(greetingFor(null, morning)).toBe("Good morning");
    expect(greetingFor("   ", morning)).toBe("Good morning"); // a blank name is no name
    expect(greetingFor(undefined, morning)).toBe("Good morning");
  });

  it("formats short month labels for the monthly chart buckets", () => {
    expect(monthShort("2026-01-01")).toBe("Jan");
    expect(monthShort("2026-10-01")).toBe("Oct");
  });
});
