"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/button";
import { siteConfig } from "@/lib/site";
import { cn } from "@/lib/cn";

const navItems = [
  { href: "/docs", label: "Docs", match: (path: string) => path.startsWith("/docs") },
  { href: "/#how-it-works", label: "How it works", match: (path: string) => path === "/" },
  { href: siteConfig.github, label: "GitHub", external: true },
] as const;

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = (): void => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b transition-[background-color,box-shadow,border-color] duration-300",
        scrolled
          ? "border-border bg-background/85 shadow-[0_10px_40px_rgba(0,0,0,0.04)] backdrop-blur-xl dark:shadow-[0_10px_40px_rgba(0,0,0,0.25)]"
          : "border-transparent bg-background/70 backdrop-blur-lg",
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Logo />
        <nav className="hidden items-center gap-0.5 md:flex" aria-label="Primary">
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
                  "match" in item && item.match(pathname)
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
            aria-expanded={open}
            className="inline-flex size-9 items-center justify-center rounded-full border border-border bg-surface text-foreground transition-colors hover:bg-surface-strong md:hidden"
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>
      </div>
      <div
        className={cn(
          "overflow-hidden border-t border-border bg-background transition-[max-height,opacity] duration-300 md:hidden",
          open ? "max-h-96 opacity-100" : "max-h-0 opacity-0",
        )}
      >
        <nav className="flex flex-col gap-1 px-6 py-4" aria-label="Mobile">
          {navItems.map((item) =>
            "external" in item && item.external ? (
              <a
                key={item.href}
                href={item.href}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl px-3 py-3 text-sm text-foreground-muted transition-colors hover:bg-surface hover:text-foreground"
              >
                {item.label}
              </a>
            ) : (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-xl px-3 py-3 text-sm text-foreground-muted transition-colors hover:bg-surface hover:text-foreground"
              >
                {item.label}
              </Link>
            ),
          )}
          <Link
            href="/docs/getting-started"
            className="mt-2 rounded-full bg-foreground px-4 py-3 text-center text-sm font-medium text-background"
          >
            Get started
          </Link>
        </nav>
      </div>
    </header>
  );
}
