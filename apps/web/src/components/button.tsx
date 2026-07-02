import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

const variants = {
  primary:
    "border border-transparent bg-foreground text-background shadow-[var(--shadow-soft)] hover:brightness-[0.96] active:scale-[0.98]",
  secondary:
    "border border-border bg-surface text-foreground hover:border-border-strong hover:bg-surface-strong active:scale-[0.98]",
  ghost:
    "border border-transparent text-foreground-muted hover:text-foreground hover:bg-surface active:scale-[0.98]",
  inverse:
    "border border-transparent bg-inverse-foreground text-inverse shadow-[var(--shadow-soft)] hover:brightness-[0.96] active:scale-[0.98]",
  inverseGhost:
    "border border-transparent text-inverse-muted hover:bg-inverse-foreground/10 hover:text-inverse active:scale-[0.98]",
} as const;

type ButtonProps = {
  href?: string;
  children: ReactNode;
  className?: string;
  variant?: keyof typeof variants;
  external?: boolean;
};

export function Button({ href, children, className, variant = "primary", external }: ButtonProps) {
  const classes = cn(
    "inline-flex items-center justify-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    variants[variant],
    className,
  );

  if (!href) {
    return <span className={classes}>{children}</span>;
  }

  if (external) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={classes}>
        {children}
      </a>
    );
  }

  return (
    <Link href={href} className={classes}>
      {children}
    </Link>
  );
}
