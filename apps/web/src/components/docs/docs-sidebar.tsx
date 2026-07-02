import Link from "next/link";
import { docsNavigation } from "@/lib/docs";
import { cn } from "@/lib/cn";

export function DocsSidebar({ activeSlug }: { activeSlug?: string }) {
  return (
    <aside className="sticky top-24 hidden h-[calc(100vh-6rem)] w-56 shrink-0 overflow-y-auto pr-2 lg:block xl:w-60">
      <nav className="space-y-8" aria-label="Documentation">
        {docsNavigation.map((section) => (
          <div key={section.title}>
            <p className="mb-3 text-[0.68rem] font-medium uppercase tracking-[0.22em] text-foreground-subtle">
              {section.title}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => (
                <li key={item.slug}>
                  <Link
                    href={`/docs/${item.slug}`}
                    className={cn(
                      "block rounded-xl px-3 py-2 text-sm transition-colors",
                      activeSlug === item.slug
                        ? "bg-accent-soft font-medium text-foreground"
                        : "text-foreground-muted hover:bg-surface hover:text-foreground",
                    )}
                  >
                    {item.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
