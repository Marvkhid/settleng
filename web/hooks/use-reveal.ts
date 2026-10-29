"use client";
import { useEffect, useRef, type RefObject } from "react";

/**
 * Adds the `in-view` class once the element has entered the viewport, so CSS can animate it in.
 *
 * Deliberately does not rely on IntersectionObserver callbacks: the element's position is measured
 * directly on mount and on scroll. If an observer never fires (an embedded or throttled browser),
 * content would otherwise stay invisible — this way anything already on screen is revealed
 * immediately and everything else appears as soon as it is scrolled to.
 */
export function useReveal<T extends HTMLElement>(): RefObject<T | null> {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let done = false;
    const reveal = () => {
      if (done) return;
      done = true;
      el.classList.add("in-view");
      window.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
    };

    function check() {
      if (done || !el) return;
      const rect = el.getBoundingClientRect();
      const viewport = window.innerHeight || document.documentElement.clientHeight;
      // 40px of grace so an element just under the fold animates as it arrives, not after.
      if (rect.top < viewport - 40 && rect.bottom > 0) reveal();
    }

    check();
    if (!done) {
      window.addEventListener("scroll", check, { passive: true });
      window.addEventListener("resize", check);
    }
    return () => {
      window.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
    };
  }, []);

  return ref;
}
