import type { ReactNode } from "react";
import { DocsMobileNav } from "@/components/docs/docs-mobile-nav";
import { DocsSidebar } from "@/components/docs/docs-sidebar";

type DocsLayoutProps = {
  children: ReactNode;
  activeSlug?: string;
};

export function DocsLayout({ children, activeSlug }: DocsLayoutProps) {
  return (
    <div className="mx-auto flex max-w-6xl gap-10 px-6 py-16 md:py-20 lg:gap-12">
      <DocsSidebar activeSlug={activeSlug} />
      <div className="min-w-0 flex-1">
        <DocsMobileNav activeSlug={activeSlug} />
        {children}
      </div>
    </div>
  );
}
