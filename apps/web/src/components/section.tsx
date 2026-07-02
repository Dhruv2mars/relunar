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
};

export function Section({
  children,
  className,
  id,
  eyebrow,
  title,
  description,
  align = "left",
}: SectionProps) {
  return (
    <section id={id} className={cn("relative px-6 py-24 md:py-32", className)}>
      <div className="mx-auto max-w-6xl">
        {(eyebrow || title || description) && (
          <div className={cn("mb-14 max-w-2xl", align === "center" && "mx-auto text-center")}>
            {eyebrow ? (
              <p className="mb-4 text-xs font-medium uppercase tracking-[0.24em] text-foreground-subtle">
                {eyebrow}
              </p>
            ) : null}
            {title ? (
              <h2 className="display-serif text-4xl leading-[1.05] tracking-[-0.03em] text-foreground md:text-5xl">
                {title}
              </h2>
            ) : null}
            {description ? (
              <p className="mt-5 text-lg leading-relaxed text-foreground-muted">{description}</p>
            ) : null}
          </div>
        )}
        {children}
      </div>
    </section>
  );
}
