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
        "group inline-flex items-center gap-2.5 text-foreground transition-opacity duration-150 hover:opacity-85",
        className,
      )}
    >
      <LogoMark className="size-5 text-accent" />
      <span
        className="text-[0.875rem] font-semibold uppercase"
        style={{ fontVariationSettings: '"wdth" 118', letterSpacing: "0.12em" }}
      >
        Relunar
      </span>
    </Link>
  );
}
