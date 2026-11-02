import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  beginLoading,
  endLoading,
  finishNavigation,
  getLoadingSnapshot,
  isBlockingRequest,
  resetLoadingForTests,
  startNavigation,
  subscribeLoading,
} from "@/lib/loading";

describe("global loading signal", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetLoadingForTests();
  });
  afterEach(() => {
    resetLoadingForTests();
    vi.useRealTimers();
  });

  it("stays hidden for operations that finish quickly", () => {
    beginLoading();
    vi.advanceTimersByTime(50);
    endLoading();
    vi.advanceTimersByTime(1_000);
    expect(getLoadingSnapshot()).toBe(false);
  });

  it("shows once a request takes longer than the delay", () => {
    beginLoading();
    vi.advanceTimersByTime(200);
    expect(getLoadingSnapshot()).toBe(true);
    endLoading();
    vi.advanceTimersByTime(400);
    expect(getLoadingSnapshot()).toBe(false);
  });

  it("never hides while another request is still running", () => {
    beginLoading();
    beginLoading();
    vi.advanceTimersByTime(200);
    expect(getLoadingSnapshot()).toBe(true);
    endLoading();
    vi.advanceTimersByTime(1_000);
    expect(getLoadingSnapshot()).toBe(true);
    endLoading();
    vi.advanceTimersByTime(400);
    expect(getLoadingSnapshot()).toBe(false);
  });

  it("keeps the overlay up long enough to be readable", () => {
    beginLoading();
    vi.advanceTimersByTime(200);
    expect(getLoadingSnapshot()).toBe(true);
    // Returns almost immediately: the minimum visible window still applies.
    endLoading();
    vi.advanceTimersByTime(100);
    expect(getLoadingSnapshot()).toBe(true);
    vi.advanceTimersByTime(400);
    expect(getLoadingSnapshot()).toBe(false);
  });

  it("balances a navigation start with its completion, even if repeated", () => {
    const seen: boolean[] = [];
    const off = subscribeLoading((active) => seen.push(active));
    startNavigation();
    startNavigation(); // second call is ignored, not double counted
    vi.advanceTimersByTime(200);
    expect(getLoadingSnapshot()).toBe(true);
    finishNavigation();
    finishNavigation(); // already finished — must not underflow
    vi.advanceTimersByTime(400);
    expect(getLoadingSnapshot()).toBe(false);
    off();
    expect(seen).toEqual([true, false]);
  });

  it("releases a navigation that never completes", () => {
    startNavigation();
    vi.advanceTimersByTime(200);
    expect(getLoadingSnapshot()).toBe(true);
    vi.advanceTimersByTime(10_000);
    expect(getLoadingSnapshot()).toBe(false);
  });
});

describe("request classification", () => {
  it("blocks the screen for writes the user started", () => {
    for (const method of ["POST", "PATCH", "PUT", "DELETE", "post", "patch"]) {
      expect(isBlockingRequest(method)).toBe(true);
    }
  });

  it("stays silent for reads, refreshes and polls", () => {
    for (const method of [undefined, "GET", "get", "HEAD", "OPTIONS"]) {
      expect(isBlockingRequest(method)).toBe(false);
    }
  });
});
