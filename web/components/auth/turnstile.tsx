"use client";
import { useEffect, useRef } from "react";

/**
 * Cloudflare Turnstile widget for the auth forms.
 *
 * Supabase enforces the challenge on its own side (the token below is sent with the sign-up /
 * sign-in request), so a bot that skips the widget cannot create an account at all. The widget only
 * renders when NEXT_PUBLIC_TURNSTILE_SITE_KEY is set; with no key the app behaves exactly as before
 * and Supabase is the only gate, which is what happens until CAPTCHA is switched on.
 */

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const SCRIPT_ID = "cf-turnstile-script";
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

interface TurnstileApi {
  render: (
    element: HTMLElement,
    options: {
      sitekey: string;
      theme?: "auto" | "light" | "dark";
      callback: (token: string) => void;
      "expired-callback"?: () => void;
      "error-callback"?: () => void;
    },
  ) => string | undefined;
  remove: (widgetId?: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

/** Whether the app is configured to show a CAPTCHA at all. */
export function captchaConfigured(): boolean {
  return Boolean(SITE_KEY);
}

export function Turnstile({ onToken }: { onToken: (token: string | null) => void }) {
  const holder = useRef<HTMLDivElement | null>(null);
  const widget = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!SITE_KEY) return;
    let cancelled = false;

    function render() {
      if (cancelled || !window.turnstile || !holder.current || widget.current) return;
      widget.current = window.turnstile.render(holder.current, {
        sitekey: SITE_KEY!,
        theme: "auto",
        callback: (token: string) => onToken(token),
        "expired-callback": () => onToken(null),
        "error-callback": () => onToken(null),
      });
    }

    if (window.turnstile) {
      render();
    } else {
      let script = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
      if (!script) {
        script = document.createElement("script");
        script.id = SCRIPT_ID;
        script.src = SCRIPT_SRC;
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }
      script.addEventListener("load", render);
      // The script may have finished loading before this listener was attached.
      const poll = window.setInterval(() => {
        if (window.turnstile) {
          window.clearInterval(poll);
          render();
        }
      }, 300);
      return () => {
        cancelled = true;
        window.clearInterval(poll);
        script?.removeEventListener("load", render);
      };
    }

    return () => {
      cancelled = true;
      if (widget.current && window.turnstile) window.turnstile.remove(widget.current);
      widget.current = undefined;
    };
  }, [onToken]);

  if (!SITE_KEY) return null;
  return <div ref={holder} className="flex min-h-[65px] justify-center" aria-label="Security check" />;
}
