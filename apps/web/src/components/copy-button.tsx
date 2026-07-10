"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";

type CopyButtonProps = {
  value: string;
  className?: string;
  label?: string;
};

export function CopyButton({ value, className, label = "Copy" }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy(): Promise<void> {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <button
      type="button"
      aria-label={copied ? "Copied" : label}
      onClick={() => void handleCopy()}
      className={cn(
        "mono-label inline-flex min-h-9 items-center gap-1.5 rounded-md border px-2.5 py-1.5 transition-[transform,background-color,border-color,color] duration-150 ease-[var(--ease-out)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.96]",
        copied
          ? "border-accent/35 bg-accent-soft text-accent-bright"
          : "border-border bg-transparent text-foreground-subtle hover:border-border-strong hover:text-foreground",
        className,
      )}
    >
      {copied ? (
        <Check className="size-3.5" strokeWidth={2} />
      ) : (
        <Copy className="size-3.5" strokeWidth={1.75} />
      )}
      {copied ? "Copied" : label}
    </button>
  );
}
