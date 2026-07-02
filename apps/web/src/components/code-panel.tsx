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
    <div className={cn("glass-panel overflow-hidden rounded-[1.5rem] border border-border", className)}>
      <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-3.5 md:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="hidden items-center gap-1.5 sm:flex" aria-hidden>
            <span className="size-2.5 rounded-full bg-[#ff5f57]" />
            <span className="size-2.5 rounded-full bg-[#febc2e]" />
            <span className="size-2.5 rounded-full bg-[#28c840]" />
          </div>
          <p className="truncate text-xs font-medium uppercase tracking-[0.18em] text-foreground-subtle">{title}</p>
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
      <div className="bg-code-bg">{children}</div>
    </div>
  );
}
