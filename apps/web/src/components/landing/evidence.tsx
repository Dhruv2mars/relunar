"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { sampleLogsTxt, sampleReportJson, sampleReportMd } from "@/lib/sample-report";

const files = [
  { name: "report.md", content: sampleReportMd, hint: "for humans" },
  { name: "report.json", content: sampleReportJson, hint: "for agents" },
  { name: "logs.txt", content: sampleLogsTxt, hint: "for skeptics" },
] as const;

type FileName = (typeof files)[number]["name"];

export function EvidenceSection() {
  const [active, setActive] = useState<FileName>("report.md");
  const activeFile = files.find((file) => file.name === active) ?? files[0];

  return (
    <section className="border-t border-border">
      <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] gap-14 px-5 py-24 sm:px-8 md:py-32 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-20">
        <div className="max-w-lg">
          <h2 className="display display-section">
            The run is <span className="text-accent">the receipt.</span>
          </h2>
          <p className="text-pretty mt-7 text-lg leading-[1.65] text-foreground-muted">
            A reproduction is not a comment saying “can’t repro on my machine.” It is a
            directory. Every run leaves three artifacts your agent can read, your CI can
            parse, and you can audit — weeks later, byte for byte.
          </p>

          <div className="mono-data mt-10 rounded-lg border border-border bg-code-bg px-5 py-4 text-foreground-muted">
            <p className="text-foreground-subtle">.relunar/runs/run_7k2m9x4p/</p>
            {files.map((file, index) => (
              <button
                key={file.name}
                type="button"
                onClick={() => setActive(file.name)}
                aria-pressed={active === file.name}
                className={cn(
                  "flex w-full items-baseline justify-between gap-4 rounded px-2 py-0.5 text-left transition-colors duration-150",
                  active === file.name
                    ? "bg-accent-soft text-accent-bright"
                    : "hover:bg-surface hover:text-foreground",
                )}
              >
                <span>
                  <span className="select-none text-foreground-subtle">
                    {index === files.length - 1 ? "└── " : "├── "}
                  </span>
                  {file.name}
                </span>
                <span className="mono-label normal-case tracking-normal text-foreground-subtle">
                  {file.hint}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="panel overflow-hidden rounded-lg">
          <div
            className="flex items-center gap-1 border-b border-[var(--code-border)] px-2"
            role="tablist"
            aria-label="Run artifacts"
          >
            {files.map((file) => (
              <button
                key={file.name}
                type="button"
                role="tab"
                aria-selected={active === file.name}
                onClick={() => setActive(file.name)}
                className={cn(
                  "mono-label relative min-h-11 px-3 transition-colors duration-150",
                  active === file.name
                    ? "text-foreground after:absolute after:inset-x-3 after:bottom-0 after:h-px after:bg-accent"
                    : "text-foreground-subtle hover:text-foreground-muted",
                )}
              >
                {file.name}
              </button>
            ))}
          </div>
          <pre
            key={activeFile.name}
            className="mono-data max-h-[30rem] overflow-auto px-5 py-5 text-foreground-muted"
            tabIndex={0}
          >
            {activeFile.content}
          </pre>
        </div>
      </div>
    </section>
  );
}
