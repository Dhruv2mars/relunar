import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { getDocNeighbors } from "@/lib/docs";

export function DocsPager({ slug }: { slug: string }) {
  const { previous, next } = getDocNeighbors(slug);

  if (!previous && !next) {
    return null;
  }

  return (
    <div className="mt-14 grid gap-4 border-t border-border pt-10 sm:grid-cols-2">
      {previous ? (
        <Link
          href={`/docs/${previous.slug}`}
          className="group rounded-[1.15rem] border border-border bg-background-elevated p-5 transition-colors hover:border-border-strong hover:bg-surface"
        >
          <span className="inline-flex items-center gap-1 text-xs font-medium uppercase tracking-[0.16em] text-foreground-subtle">
            <ArrowLeft className="size-3.5" />
            Previous
          </span>
          <p className="mt-2 text-sm font-medium text-foreground group-hover:text-accent">{previous.title}</p>
        </Link>
      ) : (
        <div />
      )}
      {next ? (
        <Link
          href={`/docs/${next.slug}`}
          className="group rounded-[1.15rem] border border-border bg-background-elevated p-5 text-left transition-colors hover:border-border-strong hover:bg-surface sm:text-right"
        >
          <span className="inline-flex items-center gap-1 text-xs font-medium uppercase tracking-[0.16em] text-foreground-subtle sm:float-right">
            Next
            <ArrowRight className="size-3.5" />
          </span>
          <p className="mt-2 clear-both text-sm font-medium text-foreground group-hover:text-accent">{next.title}</p>
        </Link>
      ) : null}
    </div>
  );
}
