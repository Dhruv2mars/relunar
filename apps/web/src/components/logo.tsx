import Link from "next/link";
import { cn } from "@/lib/cn";
import { LogoMark } from "@/components/logo-mark";

type LogoProps = {
  className?: string;
};

export function Logo({ className }: LogoProps) {
  return (
    <Link
      href="/"
      className={cn(
        "group inline-flex items-center gap-2 text-foreground transition-opacity hover:opacity-80",
        className,
      )}
    >
      <LogoMark className="size-7" />
      <span className="display-serif text-[1.35rem] leading-none tracking-[-0.03em]">Relunar</span>
    </Link>
  );
}
