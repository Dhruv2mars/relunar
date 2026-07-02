import Link from "next/link";
import { LogoMark } from "@/components/logo-mark";
import { cn } from "@/lib/cn";

type LogoProps = {
  className?: string;
  iconOnly?: boolean;
  markClassName?: string;
};

export function Logo({ className, iconOnly = false, markClassName }: LogoProps) {
  return (
    <Link href="/" className={cn("group inline-flex items-center gap-3", className)}>
      <span className="relative flex size-9 items-center justify-center overflow-hidden rounded-xl border border-border bg-surface-strong shadow-[var(--shadow-card)]">
        <LogoMark className={cn("size-[1.35rem] text-foreground", markClassName)} />
      </span>
      {!iconOnly ? (
        <span className="display-serif text-[1.35rem] leading-none tracking-[-0.03em] text-foreground transition-opacity group-hover:opacity-80">
          Relunar
        </span>
      ) : null}
    </Link>
  );
}
