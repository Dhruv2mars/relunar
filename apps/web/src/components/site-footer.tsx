import Link from "next/link";
import { LogoMark } from "@/components/logo-mark";
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
    <footer className="border-t border-border bg-background-deep">
      <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 md:py-20">
        <div className="flex flex-col gap-12 md:flex-row md:items-start md:justify-between">
          <div className="max-w-sm space-y-5">
            <div className="flex items-center gap-2.5 text-foreground">
              <LogoMark id="footer" className="size-5 text-accent" />
              <span
                className="text-[0.875rem] font-semibold uppercase"
                style={{ fontVariationSettings: '"wdth" 118', letterSpacing: "0.12em" }}
              >
                Relunar
              </span>
            </div>
            <p className="text-pretty text-sm leading-[1.7] text-foreground-muted">
              The repro harness for coding agents. Local credentials, deterministic sandboxes,
              evidence on your machine.
            </p>
            <p className="mono-label text-foreground-subtle">Open source · MIT · No hosted service</p>
          </div>

          <nav
            className="grid grid-cols-2 gap-x-12 gap-y-1 sm:grid-cols-3"
            aria-label="Footer"
          >
            {links.map((link) =>
              "external" in link && link.external ? (
                <a
                  key={link.href}
                  href={link.href}
                  target="_blank"
                  rel="noreferrer"
                  className="mono-label inline-flex min-h-11 items-center text-foreground-subtle transition-colors hover:text-foreground"
                >
                  {link.label}
                </a>
              ) : (
                <Link
                  key={link.href}
                  href={link.href}
                  className="mono-label inline-flex min-h-11 items-center text-foreground-subtle transition-colors hover:text-foreground"
                >
                  {link.label}
                </Link>
              ),
            )}
          </nav>
        </div>

        <div className="mt-14 flex flex-col gap-2 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="mono-label text-foreground-subtle">
            © {new Date().getFullYear()} Relunar
          </p>
          <p className="mono-label text-foreground-subtle">Built for the night shift</p>
        </div>
      </div>
    </footer>
  );
}
