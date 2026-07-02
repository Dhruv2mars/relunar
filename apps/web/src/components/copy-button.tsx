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
      aria-label={label}
      onClick={() => void handleCopy()}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        copied
          ? "border-accent/25 bg-accent-soft text-accent"
          : "border-border bg-surface text-foreground-muted hover:border-border-strong hover:bg-surface-strong hover:text-foreground",
        className,
      )}
    >
      {copied ? <Check className="size-3.5" strokeWidth={2} /> : <Copy className="size-3.5" strokeWidth={1.75} />}
      {copied ? "Copied" : label}
    </button>
  );
}
