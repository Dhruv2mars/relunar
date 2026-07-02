import { Button } from "@/components/button";
import { siteConfig } from "@/lib/site";

export function CtaSection() {
  return (
    <section className="px-6 pb-24 md:pb-32">
      <div className="mx-auto max-w-6xl">
        <div className="relative overflow-hidden rounded-[2rem] border border-border bg-foreground px-8 py-16 text-background md:px-14 md:py-20">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(165,180,252,0.22),transparent_40%)]" />
          <div className="relative max-w-2xl">
            <p className="text-xs font-medium uppercase tracking-[0.24em] text-background/55">Ready when you are</p>
            <h2 className="display-serif mt-5 text-4xl leading-[1.02] tracking-[-0.03em] md:text-5xl">
              Give your agent a better way to reproduce issues.
            </h2>
            <p className="mt-5 text-base leading-relaxed text-background/75 md:text-lg">
              Install Relunar locally, link your repository, and let your coding agent handle the rest — with evidence
              you can trust.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button href="/docs/getting-started" variant="secondary" className="bg-background text-foreground">
                Read the docs
              </Button>
              <Button href={siteConfig.npm} variant="ghost" external className="text-background/80 hover:bg-background/10 hover:text-background">
                Install from npm
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
