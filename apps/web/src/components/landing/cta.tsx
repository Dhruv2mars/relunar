import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/button";
import { CopyButton } from "@/components/copy-button";
import { LogoMark } from "@/components/logo-mark";
import { siteConfig } from "@/lib/site";

export function CtaSection() {
  return (
    <section className="relative overflow-hidden border-t border-border bg-background-deep">
      <div
        className="pointer-events-none absolute inset-x-0 -bottom-24 h-64"
        style={{
          background:
            "radial-gradient(ellipse 55% 100% at 50% 100%, oklch(0.768 0.135 62 / 0.14), transparent 70%)",
        }}
        aria-hidden
      />

      <div className="relative mx-auto flex max-w-6xl flex-col items-center px-5 py-28 text-center sm:px-8 md:py-36">
        <LogoMark id="cta" className="size-11 text-accent" />

        <h2 className="display display-hero mt-8">
          <span className="block">The backlog won’t</span>
          <span className="block text-accent">repro itself.</span>
        </h2>

        <p className="text-pretty mt-7 max-w-md text-lg leading-[1.65] text-foreground-muted">
          Open source, MIT, no hosted service. Install it, link a repo, and hand your agent
          the harness.
        </p>

        <div className="mt-10 flex w-full max-w-md items-center justify-between gap-3 rounded-md border border-border bg-code-bg py-1.5 pl-4 pr-1.5 text-left">
          <code className="mono-data truncate text-foreground-muted">
            <span className="select-none text-accent">$ </span>
            {siteConfig.installCommand}
          </code>
          <CopyButton value={siteConfig.installCommand} label="Copy" className="border-transparent" />
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button href="/docs/getting-started">Read the docs</Button>
          <Button href={siteConfig.github} variant="outline" external>
            Star on GitHub
            <ArrowUpRight className="size-3.5" strokeWidth={2} />
          </Button>
        </div>
      </div>
    </section>
  );
}
