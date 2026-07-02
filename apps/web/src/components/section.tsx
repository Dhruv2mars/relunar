import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type SectionProps = {
  children: ReactNode;
  className?: string;
  id?: string;
  eyebrow?: string;
  title?: string;
  description?: string;
  align?: "left" | "center";
  compact?: boolean;
};

export function Section({
  children,
  className,
  id,
  eyebrow,
  title,
  description,
  align = "left",
  compact = false,
}: SectionProps) {
  return (
    <section
      id={id}
      className={cn("relative scroll-mt-24 px-6", compact ? "py-20 md:py-24" : "py-24 md:py-32", className)}
    >
      <div className="mx-auto max-w-6xl">
        {(eyebrow || title || description) && (
          <div className={cn("mb-12 md:mb-14", align === "center" ? "mx-auto max-w-2xl text-center" : "max-w-2xl")}>
            {eyebrow ? <p className="eyebrow mb-4">{eyebrow}</p> : null}
            {title ? (
              <h2 className="display-serif text-balance text-4xl leading-[1.04] tracking-[-0.035em] text-foreground md:text-[3.25rem]">
                {title}
              </h2>
            ) : null}
            {description ? (
              <p className="mt-5 text-balance text-lg leading-[1.65] text-foreground-muted md:text-[1.125rem]">
                {description}
              </p>
            ) : null}
          </div>
        )}
        {children}
      </div>
    </section>
  );
}
