import Link from "next/link";
import { cn } from "@/lib/cn";

type LogoProps = {
  className?: string;
};

export function Logo({ className }: LogoProps) {
  return (
    <Link
      href="/"
      className={cn(
        "group display-serif text-[1.35rem] leading-none tracking-[-0.03em] text-foreground transition-opacity hover:opacity-80",
        className,
      )}
    >
      Relunar
    </Link>
  );
}
