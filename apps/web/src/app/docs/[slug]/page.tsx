import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocsContent } from "@/components/docs/docs-content";
import { DocsSidebar } from "@/components/docs/docs-sidebar";
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
    <div className="mx-auto flex max-w-6xl gap-10 px-6 py-16 md:py-20">
      <DocsSidebar activeSlug={slug} />
      <article className="min-w-0 flex-1">
        <p className="text-xs font-medium uppercase tracking-[0.24em] text-foreground-subtle">Documentation</p>
        <h1 className="display-serif mt-4 text-4xl tracking-[-0.03em] text-foreground md:text-5xl">{page.title}</h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-foreground-muted">{page.description}</p>
        <div className="mt-10 border-t border-border pt-10">
          <DocsContent content={page.content} />
        </div>
      </article>
    </div>
  );
}
