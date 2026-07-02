import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocsContent } from "@/components/docs/docs-content";
import { DocsLayout } from "@/components/docs/docs-layout";
import { DocsPager } from "@/components/docs/docs-pager";
import { getAllDocSlugs, getDocPage } from "@/lib/docs";
import { siteConfig } from "@/lib/site";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  return getAllDocSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = getDocPage(slug);
  if (!page) {
    return {};
  }

  return {
    title: page.title,
    description: page.description,
    openGraph: {
      title: `${page.title} · Relunar Docs`,
      description: page.description,
      url: `${siteConfig.url}/docs/${page.slug}`,
    },
  };
}

export default async function DocPage({ params }: PageProps) {
  const { slug } = await params;
  const page = getDocPage(slug);
  if (!page) {
    notFound();
  }

  return (
    <DocsLayout activeSlug={slug}>
      <article>
        <p className="eyebrow">Documentation</p>
        <h1 className="display-serif mt-4 text-balance text-4xl tracking-[-0.035em] text-foreground md:text-5xl">
          {page.title}
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-[1.65] text-foreground-muted">{page.description}</p>
        <div className="mt-10 border-t border-border pt-10">
          <DocsContent content={page.content} />
        </div>
        <DocsPager slug={slug} />
      </article>
    </DocsLayout>
  );
}
