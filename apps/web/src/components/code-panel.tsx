import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type CodePanelProps = {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
};

export function CodePanel({ title, children, actions, className }: CodePanelProps) {
  return (
    <div className={cn("panel overflow-hidden rounded-lg", className)}>
      <div className="flex min-h-11 items-center justify-between gap-4 border-b border-[var(--code-border)] px-4">
        <p className="mono-label text-foreground-subtle">{title}</p>
        {actions ? <div className="shrink-0 py-1.5">{actions}</div> : null}
      </div>
      <div>{children}</div>
    </div>
  );
}
