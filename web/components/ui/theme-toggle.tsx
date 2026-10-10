"use client";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

/**
 * Light/dark switch. A single button that flips the theme and persists the choice to localStorage.
 * The accessible name describes the action ("switch to dark mode"), and the icon swaps so the
 * change feels instant.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const next = theme === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={theme === "dark"}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
      className={cn(
        "inline-flex size-11 items-center justify-center rounded-xl border border-line bg-surface text-ink-soft transition-colors hover:bg-sunken",
        className,
      )}
    >
      {theme === "dark" ? <Sun className="size-5" aria-hidden /> : <Moon className="size-5" aria-hidden />}
    </button>
  );
}
