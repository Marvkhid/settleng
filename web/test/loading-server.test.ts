// @vitest-environment node
/**
 * The loading store must be strictly browser-side.
 *
 * This module is imported by a client component that the root layout renders, so Next also
 * evaluates it inside the shared server process during SSR. If the store were attached to
 * `globalThis` there, one object would be reused for every request — loading state leaking between
 * users. These assertions run with no `window` at all, exactly like that server evaluation.
 */
import { describe, expect, it } from "vitest";
import {
  beginLoading,
  endLoading,
  finishNavigation,
  getLoadingSnapshot,
  getServerLoadingSnapshot,
  isBlockingRequest,
  startNavigation,
  subscribeLoading,
} from "@/lib/loading";

const STORE_KEY = "__settlengLoadingStore__";

describe("loading store on the server", () => {
  it("never creates the shared globalThis slot", () => {
    expect(typeof window).toBe("undefined");
    expect((globalThis as Record<string, unknown>)[STORE_KEY]).toBeUndefined();

    beginLoading();
    startNavigation();
    endLoading();
    finishNavigation();

    expect((globalThis as Record<string, unknown>)[STORE_KEY]).toBeUndefined();
  });

  it("never reports an active overlay while server-rendering", () => {
    expect(getLoadingSnapshot()).toBe(false);
    expect(getServerLoadingSnapshot()).toBe(false);

    beginLoading();
    expect(getLoadingSnapshot()).toBe(false);

    endLoading();
    expect(getLoadingSnapshot()).toBe(false);
  });

  it("never delivers state to a subscriber", () => {
    let calls = 0;
    const unsubscribe = subscribeLoading(() => {
      calls += 1;
    });
    beginLoading();
    endLoading();
    unsubscribe();
    expect(calls).toBe(0);
  });

  it("still classifies requests the same way on the server", () => {
    expect(isBlockingRequest("POST")).toBe(true);
    expect(isBlockingRequest("GET")).toBe(false);
    expect(isBlockingRequest(undefined)).toBe(false);
  });
});