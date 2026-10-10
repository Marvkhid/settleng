import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50 select-none whitespace-nowrap",
  {
    variants: {
      variant: {
        primary: "bg-emerald-ink text-white hover:bg-emerald-deep",
        dark: "bg-panel text-white hover:bg-ink-soft",
        outline: "border border-line bg-surface text-ink hover:bg-sunken",
        ghost: "text-ink hover:bg-sunken",
        danger: "bg-red text-white hover:bg-red/90",
        dangerOutline: "border border-red/40 bg-surface text-red hover:bg-red-wash",
      },
      size: { md: "h-12 px-5 text-base", sm: "h-10 px-4 text-sm", lg: "h-14 px-7 text-lg", icon: "h-11 w-11 shrink-0" },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, loading, disabled, children, type = "button", ...props }, ref) {
  return (
    <button ref={ref} type={type} className={cn(buttonVariants({ variant, size }), className)} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});
