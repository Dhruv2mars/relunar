"use client";

import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { docsNavigation, getFlatDocNav } from "@/lib/docs";
import { cn } from "@/lib/cn";

export function DocsMobileNav({ activeSlug }: { activeSlug?: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const activeTitle =
    getFlatDocNav().find((item) => item.slug === activeSlug || pathname === `/docs/${item.slug}`)?.title ??
    "Documentation";

  return (
    <div className="mb-8 lg:hidden">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between rounded-[1rem] border border-border bg-background-elevated px-4 py-3 text-sm font-medium text-foreground"
      >
        {activeTitle}
        <ChevronDown className={cn("size-4 text-foreground-subtle transition-transform", open && "rotate-180")} />
      </button>
      <div
        className={cn(
          "mt-2 overflow-hidden rounded-[1rem] border border-border bg-background-elevated transition-[max-height,opacity] duration-300",
          open ? "max-h-[28rem] opacity-100" : "max-h-0 opacity-0 border-transparent",
        )}
      >
        <nav className="space-y-6 p-4">
          {docsNavigation.map((section) => (
            <div key={section.title}>
              <p className="mb-2 text-[0.68rem] font-medium uppercase tracking-[0.22em] text-foreground-subtle">
                {section.title}
              </p>
              <ul className="space-y-1">
                {section.items.map((item) => (
                  <li key={item.slug}>
                    <Link
                      href={`/docs/${item.slug}`}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "block rounded-xl px-3 py-2 text-sm transition-colors",
                        activeSlug === item.slug
                          ? "bg-accent-soft text-foreground"
                          : "text-foreground-muted hover:bg-surface hover:text-foreground",
                      )}
                    >
                      {item.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>
    </div>
  );
}
