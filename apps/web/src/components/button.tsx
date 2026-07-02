import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

const variants = {
  primary:
    "border border-transparent bg-foreground text-background shadow-[var(--shadow-soft)] hover:opacity-92",
  secondary:
    "border border-border bg-surface text-foreground hover:bg-surface-strong",
  ghost: "border border-transparent text-foreground-muted hover:text-foreground hover:bg-surface",
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
    "inline-flex items-center justify-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-medium transition-all duration-200",
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
