import Link from "next/link";
import { Logo } from "@/components/logo";
import { siteConfig } from "@/lib/site";

const links = [
  { href: "/docs", label: "Documentation" },
  { href: "/docs/getting-started", label: "Getting started" },
  { href: "/docs/commands", label: "Commands" },
  { href: siteConfig.github, label: "GitHub", external: true },
  { href: siteConfig.npm, label: "npm", external: true },
] as const;

export function SiteFooter() {
  return (
    <footer className="border-t border-border px-6 py-16 md:py-20">
      <div className="mx-auto flex max-w-6xl flex-col gap-12 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-sm space-y-5">
          <Logo />
          <p className="text-sm leading-[1.7] text-foreground-muted">
            CLI-first issue reproduction for coding agents. Local credentials. Deterministic reports. Optional comments
            when you ask.
          </p>
          <p className="text-xs uppercase tracking-[0.22em] text-foreground-subtle">
            Open source · MIT · No hosted service
          </p>
        </div>
        <div className="grid grid-cols-2 gap-x-12 gap-y-3 text-sm sm:grid-cols-3">
          {links.map((link) =>
            "external" in link && link.external ? (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noreferrer"
                className="text-foreground-muted transition-colors hover:text-foreground"
              >
                {link.label}
              </a>
            ) : (
              <Link
                key={link.href}
                href={link.href}
                className="text-foreground-muted transition-colors hover:text-foreground"
              >
                {link.label}
              </Link>
            ),
          )}
        </div>
      </div>
      <div className="mx-auto mt-12 max-w-6xl border-t border-border pt-6 text-xs text-foreground-subtle">
        © {new Date().getFullYear()} Relunar. Built for maintainers who work with coding agents.
      </div>
    </footer>
  );
}
