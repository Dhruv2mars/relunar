import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

const variants = {
  accent:
    "border border-transparent bg-accent text-background hover:bg-accent-bright active:scale-[0.98]",
  outline:
    "border border-border-strong bg-transparent text-foreground hover:border-foreground/40 hover:bg-surface active:scale-[0.98]",
  ghost:
    "border border-transparent text-foreground-muted hover:bg-surface hover:text-foreground active:scale-[0.98]",
} as const;

type ButtonProps = {
  href?: string;
  children: ReactNode;
  className?: string;
  variant?: keyof typeof variants;
  external?: boolean;
};

export function Button({ href, children, className, variant = "accent", external }: ButtonProps) {
  const classes = cn(
    "mono-label inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-5 py-3 transition-[transform,background-color,border-color,color] duration-150 ease-[var(--ease-out)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-background",
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
