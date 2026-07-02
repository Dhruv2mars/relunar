"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/button";
import { siteConfig } from "@/lib/site";
import { cn } from "@/lib/cn";

const navItems = [
  { href: "/docs", label: "Docs" },
  { href: "/#how-it-works", label: "How it works" },
  { href: siteConfig.github, label: "GitHub", external: true },
] as const;

export function SiteHeader() {
  const pathname = usePathname();
  const onDocs = pathname.startsWith("/docs");
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/75 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Logo />
        <nav className="hidden items-center gap-1 md:flex">
          {navItems.map((item) =>
            "external" in item && item.external ? (
              <a
                key={item.href}
                href={item.href}
                target="_blank"
                rel="noreferrer"
                className="rounded-full px-3.5 py-2 text-sm text-foreground-muted transition-colors hover:text-foreground"
              >
                {item.label}
              </a>
            ) : (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-full px-3.5 py-2 text-sm transition-colors",
                  pathname === item.href || (item.href.startsWith("/docs") && onDocs)
                    ? "text-foreground"
                    : "text-foreground-muted hover:text-foreground",
                )}
              >
                {item.label}
              </Link>
            ),
          )}
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button href="/docs/getting-started" variant="primary" className="hidden sm:inline-flex">
            Get started
          </Button>
          <button
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            className="inline-flex size-9 items-center justify-center rounded-full border border-border bg-surface text-foreground md:hidden"
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>
      </div>
      {open ? (
        <div className="border-t border-border bg-background px-6 py-4 md:hidden">
          <nav className="flex flex-col gap-1">
            {navItems.map((item) =>
              "external" in item && item.external ? (
                <a
                  key={item.href}
                  href={item.href}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl px-3 py-3 text-sm text-foreground-muted"
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </a>
              ) : (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-xl px-3 py-3 text-sm text-foreground-muted"
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </Link>
              ),
            )}
            <Link
              href="/docs/getting-started"
              className="mt-2 rounded-full bg-foreground px-4 py-3 text-center text-sm font-medium text-background"
              onClick={() => setOpen(false)}
            >
              Get started
            </Link>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
