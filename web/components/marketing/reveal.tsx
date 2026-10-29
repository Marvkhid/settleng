"use client";
import { useReveal } from "@/hooks/use-reveal";
import { cn } from "@/lib/utils";

/**
 * Fades and lifts its children once they scroll into view. Progressive enhancement: the CSS leaves
 * the content visible if IntersectionObserver or motion is unavailable.
 */
export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  /** Milliseconds to stagger siblings. */
  delay?: number;
}) {
  const ref = useReveal<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={cn("animate-on-scroll", className)}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}
