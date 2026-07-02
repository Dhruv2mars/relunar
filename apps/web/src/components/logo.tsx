"use client";

import Link from "next/link";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

type LogoProps = {
  className?: string;
  iconOnly?: boolean;
};

export function Logo({ className, iconOnly = false }: LogoProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [imageError, setImageError] = useState(false);

  useEffect(() => setMounted(true), []);

  const src =
    mounted && resolvedTheme === "dark"
      ? "/brand/relunar-whitefill.png"
      : "/brand/relunar-blackfill.png";

  const showImage = mounted && !imageError;

  return (
    <Link href="/" className={cn("group inline-flex items-center gap-3", className)}>
      <span className="relative flex size-9 items-center justify-center overflow-hidden rounded-xl border border-border bg-surface-strong shadow-[var(--shadow-card)]">
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt=""
            className="size-7 object-contain"
            onError={() => setImageError(true)}
          />
        ) : (
          <LogoMark />
        )}
      </span>
      {!iconOnly ? (
        <span className="display-serif text-[1.35rem] leading-none tracking-[-0.03em] text-foreground transition-opacity group-hover:opacity-80">
          Relunar
        </span>
      ) : null}
    </Link>
  );
}

function LogoMark() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className="size-5 text-accent">
      <circle cx="16" cy="16" r="11" fill="currentColor" opacity="0.12" />
      <path d="M20.5 10.5c-3.8 0.6-6.8 3.6-7.4 7.4 3.8-0.6 6.8-3.6 7.4-7.4Z" fill="currentColor" />
      <circle cx="21.5" cy="11.5" r="1.1" fill="currentColor" />
    </svg>
  );
}
