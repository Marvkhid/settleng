"use client";
import { useCallback, useRef } from "react";

/**
 * Wraps an async handler so a second click, tap or Enter is ignored while the first is still running.
 * This stops a fast double-tap on "Save" from recording a sale or payment twice.
 */
export function useSingleFlight() {
  const flying = useRef(false);
  return useCallback(<A extends unknown[], R>(fn: (...args: A) => Promise<R> | R) =>
    async (...args: A): Promise<R | undefined> => {
      if (flying.current) {
        // Swallow the repeated event too, otherwise the browser would submit the form natively and reload the page.
        (args[0] as { preventDefault?: () => void } | undefined)?.preventDefault?.();
        return undefined;
      }
      flying.current = true;
      try { return await fn(...args); } finally { flying.current = false; }
    }, []);
}
