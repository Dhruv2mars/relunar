"use client";

import Link from "next/link";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Logo } from "@/components/logo";
import { siteConfig } from "@/lib/site";
import { cn } from "@/lib/cn";

type NavItem = {
  href: string;
  label: string;
  external?: boolean;
  id: "docs" | "how-it-works" | "github";
};

const navItems: NavItem[] = [
  { id: "how-it-works", href: "/#how-it-works", label: "How it works" },
  { id: "docs", href: "/docs", label: "Docs" },
  { id: "github", href: siteConfig.github, label: "GitHub", external: true },
];

function NavLink({
  href,
  label,
  active,
  external,
  onClick,
  className,
}: {
  href: string;
  label: string;
  active?: boolean;
  external?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  const linkClassName = cn(
    "mono-label relative inline-flex min-h-11 items-center gap-1 px-3 transition-colors duration-150",
    active ? "text-accent-bright" : "text-foreground-subtle hover:text-foreground",
    className,
  );

  const content = (
    <>
      {label}
      {external ? <ArrowUpRight className="size-3 opacity-70" strokeWidth={2} aria-hidden /> : null}
    </>
  );

  if (external) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={linkClassName} onClick={onClick}>
        {content}
      </a>
    );
  }

  return (
    <Link href={href} className={linkClassName} onClick={onClick}>
      {content}
    </Link>
  );
}

function useScrolled(threshold = 16, release = 4): boolean {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = (): void => {
      setScrolled((current) => {
        const y = window.scrollY;
        if (!current && y > threshold) return true;
        if (current && y < release) return false;
        return current;
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [release, threshold]);

  return scrolled;
}

function useFocusTrap(containerRef: React.RefObject<HTMLElement | null>, enabled: boolean): void {
  useEffect(() => {
    if (!enabled || !containerRef.current) return;

    const container = containerRef.current;
    const selector = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusable = Array.from(container.querySelectorAll<HTMLElement>(selector));
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    first?.focus();

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== "Tab" || focusable.length === 0) return;

      if (event.shiftKey) {
        if (document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        }
        return;
      }

      if (document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };

    container.addEventListener("keydown", onKeyDown);
    return () => container.removeEventListener("keydown", onKeyDown);
  }, [containerRef, enabled]);
}

export function SiteHeader() {
  const pathname = usePathname();
  const menuTitleId = useId();
  const [open, setOpen] = useState(false);
  const scrolled = useScrolled();
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  const closeMenu = useCallback(() => {
    setOpen(false);
    menuButtonRef.current?.focus();
  }, []);

  useFocusTrap(menuRef, open);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") closeMenu();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [closeMenu, open]);

  function isActive(item: NavItem): boolean {
    if (item.id === "docs") return pathname.startsWith("/docs");
    return false;
  }

  return (
    <>
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-[var(--z-sticky)] border-b bg-background/70 backdrop-blur-md transition-[background-color,border-color] duration-200",
          scrolled ? "border-border bg-background/85" : "border-transparent",
        )}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
          <Logo />

          <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
            {navItems.map((item) => (
              <NavLink
                key={item.id}
                href={item.href}
                label={item.label}
                external={item.external}
                active={isActive(item)}
              />
            ))}
            <Link
              href="/docs/getting-started"
              className="mono-label ml-3 inline-flex min-h-9 items-center rounded-md bg-accent px-4 text-background transition-[background-color,transform] duration-150 hover:bg-accent-bright active:scale-[0.98]"
            >
              Get started
            </Link>
          </nav>

          <button
            ref={menuButtonRef}
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls={open ? menuTitleId : undefined}
            className="inline-flex size-11 items-center justify-center rounded-md border border-border text-foreground transition-[background-color,transform] duration-150 hover:bg-surface active:scale-[0.96] md:hidden"
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>
      </header>

      {open ? (
        <div className="fixed inset-0 z-[var(--z-overlay)] md:hidden">
          <button
            type="button"
            aria-label="Dismiss menu"
            className="absolute inset-0 bg-background-deep/80 backdrop-blur-sm"
            onClick={closeMenu}
          />

          <div
            ref={menuRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={menuTitleId}
            className="absolute inset-x-0 top-0 border-b border-border bg-background-elevated"
          >
            <div className="flex h-16 items-center justify-between px-5">
              <p id={menuTitleId} className="mono-label text-foreground-subtle">
                Menu
              </p>
              <button
                type="button"
                aria-label="Close menu"
                className="inline-flex size-11 items-center justify-center rounded-md border border-border text-foreground transition-[background-color,transform] duration-150 hover:bg-surface active:scale-[0.96]"
                onClick={closeMenu}
              >
                <X className="size-4" />
              </button>
            </div>

            <nav className="flex flex-col gap-1 px-3 pb-5" aria-label="Mobile">
              {navItems.map((item) => (
                <NavLink
                  key={item.id}
                  href={item.href}
                  label={item.label}
                  external={item.external}
                  active={isActive(item)}
                  className="w-full min-h-12 justify-start rounded-md px-3 hover:bg-surface"
                  onClick={closeMenu}
                />
              ))}
              <Link
                href="/docs/getting-started"
                onClick={closeMenu}
                className="mono-label mt-3 inline-flex min-h-12 items-center justify-center rounded-md bg-accent px-4 text-background active:scale-[0.98]"
              >
                Get started
              </Link>
            </nav>
          </div>
        </div>
      ) : null}
    </>
  );
}
