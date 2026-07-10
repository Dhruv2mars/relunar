import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { DocsLayout } from "@/components/docs/docs-layout";
import { docsNavigation, docsPages } from "@/lib/docs";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Documentation",
  description: "Guides for installing, configuring, and using Relunar with coding agents.",
};

export default function DocsIndexPage() {
  return (
    <DocsLayout>
      <p className="mono-label text-foreground-subtle">Documentation</p>
      <h1 className="display display-section mt-4">Guides for agents and maintainers.</h1>
      <p className="mt-5 max-w-2xl text-lg leading-[1.65] text-foreground-muted">
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
                className="group rounded-lg border border-border bg-background-elevated p-6 transition-colors duration-150 hover:border-border-strong md:p-7"
              >
                <p className="mono-label text-foreground-subtle">{section.title}</p>
                <h2 className="mt-3 text-xl font-semibold tracking-[-0.015em] text-foreground">{page.title}</h2>
                <p className="mt-2 text-sm leading-[1.65] text-foreground-muted">{page.description}</p>
                <span className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-accent-bright">
                  Read guide
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            );
          }),
        )}
      </div>

      <div className="mt-14 rounded-lg border border-border bg-surface px-6 py-5">
        <p className="text-sm leading-[1.65] text-foreground-muted">
          Looking for the CLI package? Install{" "}
          <a
            href={siteConfig.npm}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-accent-bright underline underline-offset-4"
          >
            @dhruv2mars/relunar
          </a>{" "}
          from npm or browse the source on{" "}
          <a
            href={siteConfig.github}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-accent-bright underline underline-offset-4"
          >
            GitHub
          </a>
          .
        </p>
      </div>
    </DocsLayout>
  );
}
