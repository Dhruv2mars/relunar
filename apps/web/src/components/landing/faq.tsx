"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";

const faqs = [
  {
    question: "Is Relunar an AI agent?",
    answer:
      "No. Relunar is a CLI harness. Your coding agent chooses issues, interprets reports, and decides follow-up. Relunar handles sandbox plumbing and structured evidence.",
  },
  {
    question: "Does it post comments automatically?",
    answer:
      "Never by default. GitHub comments require the explicit --comment flag so maintainers stay in control of public issue threads.",
  },
  {
    question: "What does “repro” mean in v1?",
    answer:
      "Relunar clones the linked repository into a fresh Daytona sandbox, runs setup and baseline commands from .relunar.yml, and writes a structured local report. Your agent uses that foundation to investigate the issue itself.",
  },
  {
    question: "Do I need a Daytona account?",
    answer:
      "Yes. Relunar creates ephemeral sandboxes through Daytona using your own API key. Credentials are resolved locally — never stored in the repository.",
  },
] as const;

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section className="border-t border-border">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-24 sm:px-8 md:py-32 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)] lg:gap-16">
        <h2 className="display display-section">
          Straight
          <br />
          answers.
        </h2>

        <div>
          {faqs.map((faq, index) => {
            const open = openIndex === index;
            const panelId = `faq-panel-${index}`;

            return (
              <div key={faq.question} className="border-t border-border last:border-b">
                <button
                  type="button"
                  id={`faq-trigger-${index}`}
                  aria-expanded={open}
                  aria-controls={panelId}
                  className="flex min-h-11 w-full items-center justify-between gap-6 py-5 text-left transition-colors duration-150 hover:text-accent-bright focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--ring)]"
                  onClick={() => setOpenIndex(open ? null : index)}
                >
                  <span className="text-[1.0625rem] font-semibold tracking-[-0.01em] text-foreground">
                    {faq.question}
                  </span>
                  <Plus
                    className={cn(
                      "size-4 shrink-0 text-foreground-subtle transition-transform duration-200 ease-[var(--ease-out)]",
                      open && "rotate-45 text-accent",
                    )}
                    strokeWidth={2}
                    aria-hidden
                  />
                </button>
                <div
                  id={panelId}
                  role="region"
                  aria-labelledby={`faq-trigger-${index}`}
                  className="faq-panel"
                  data-open={open || undefined}
                >
                  <div className="faq-panel-clip">
                    <p className="faq-panel-body text-pretty max-w-xl pb-6 text-[0.9375rem] leading-[1.7] text-foreground-muted">
                      {faq.answer}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
