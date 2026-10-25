import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { initialTheme, setTheme, THEME_KEY, applyTheme, useTheme } from "./theme";

// The store is module-local singletons, so tests share state. Reset between tests.

function mockWindow(overrides: Partial<Window> = {}) {
  const w = {
    matchMedia: () => ({ matches: false, addListener: () => {}, removeListener: () => {} }),
    localStorage: {
      store: {} as Record<string, string>,
      getItem: (k: string) => w.localStorage.store[k] ?? null,
      setItem: (k: string, v: string) => { w.localStorage.store[k] = v; },
      removeItem: (k: string) => { delete w.localStorage.store[k]; },
    },
    ...overrides,
  };
  vi.stubGlobal("window", w as unknown as Window);
  return w;
}

describe("theme", () => {
  let w: ReturnType<typeof mockWindow>;

  beforeEach(() => {
    w = mockWindow();
    vi.stubGlobal("localStorage", w.localStorage);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("initialTheme", () => {
    it("follows a stored explicit choice", () => {
      w.localStorage.setItem(THEME_KEY, "dark");
      expect(initialTheme()).toBe("dark");
      w.localStorage.setItem(THEME_KEY, "light");
      expect(initialTheme()).toBe("light");
    });

    it("falls back to the system preference when nothing is stored", () => {
      expect(initialTheme()).toBe("light"); // default mock prefers light
      w.matchMedia = () => ({ matches: true, addListener: () => {}, removeListener: () => {} });
      expect(initialTheme()).toBe("dark");
    });

    it("treats corrupt stored values as unset", () => {
      w.localStorage.setItem(THEME_KEY, "blue");
      expect(initialTheme()).toBe("light");
      w.localStorage.setItem(THEME_KEY, "");
      expect(initialTheme()).toBe("light");
    });
  });

  describe("setTheme + applyTheme", () => {
    it("persists to localStorage and updates the document", () => {
      applyTheme("dark");
      expect(document.documentElement.classList.contains("dark")).toBe(true);
      expect(document.documentElement.style.colorScheme).toBe("dark");

      setTheme("light");
      expect(w.localStorage.getItem(THEME_KEY)).toBe("light");
      expect(document.documentElement.classList.contains("dark")).toBe(false);
      expect(document.documentElement.style.colorScheme).toBe("light");
    });

    it("survives a storage write failure silently", () => {
      let threw = false;
      w.localStorage.setItem = () => { threw = true; throw new Error("blocked"); };
      // applyTheme still runs; setTheme should not throw.
      expect(() => setTheme("dark")).not.toThrow();
      // Storage wasn't updated, but the document still flipped.
      expect(document.documentElement.classList.contains("dark")).toBe(true);
      expect(threw).toBe(true);
    });
  });

  describe("useTheme", () => {
    it("returns the current theme and a toggle", async () => {
      const { result } = renderHook(() => useTheme());
      // jsdom default window prefers light.
      expect(result.current.theme).toBe("light");
      act(() => { result.current.setTheme("dark"); });
      expect(result.current.theme).toBe("dark");
      expect(document.documentElement.classList.contains("dark")).toBe(true);
      act(() => { result.current.toggle(); });
      expect(result.current.theme).toBe("light");
      expect(document.documentElement.classList.contains("dark")).toBe(false);
    });
  });
});
