import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { DocsSidebar } from "@/components/docs/docs-sidebar";
import { docsNavigation, docsPages } from "@/lib/docs";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Documentation",
  description: "Guides for installing, configuring, and using Relunar with coding agents.",
};

export default function DocsIndexPage() {
  return (
    <div className="mx-auto flex max-w-6xl gap-10 px-6 py-16 md:py-20">
      <DocsSidebar />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium uppercase tracking-[0.24em] text-foreground-subtle">Documentation</p>
        <h1 className="display-serif mt-4 text-5xl tracking-[-0.03em] text-foreground">Guides for agents and maintainers.</h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-foreground-muted">
          Everything you need to install Relunar, configure a repository, and let your coding agent reproduce GitHub
          issues with structured evidence.
        </p>

        <div className="mt-12 grid gap-5 md:grid-cols-2">
          {docsNavigation.flatMap((section) =>
            section.items.map((item) => {
              const page = docsPages.find((doc) => doc.slug === item.slug);
              if (!page) return null;
              return (
                <Link
                  key={item.slug}
                  href={`/docs/${item.slug}`}
                  className="group rounded-[1.35rem] border border-border bg-background-elevated p-6 transition-transform duration-300 hover:-translate-y-1"
                >
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-foreground-subtle">
                    {section.title}
                  </p>
                  <h2 className="mt-3 text-xl font-medium tracking-[-0.02em] text-foreground">{page.title}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-foreground-muted">{page.description}</p>
                  <span className="mt-5 inline-flex items-center gap-1 text-sm text-accent">
                    Read guide
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>
              );
            }),
          )}
        </div>

        <div className="mt-14 rounded-[1.35rem] border border-border bg-surface p-6">
          <p className="text-sm text-foreground-muted">
            Looking for the CLI package? Install{" "}
            <a href={siteConfig.npm} className="text-accent underline underline-offset-4">
              @dhruv2mars/relunar
            </a>{" "}
            from npm or browse the source on{" "}
            <a href={siteConfig.github} className="text-accent underline underline-offset-4">
              GitHub
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
