"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { Section } from "@/components/section";
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
    question: "What does repro mean in v1?",
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
    <Section eyebrow="FAQ" title="Questions, answered plainly." align="center">
      <div className="mx-auto max-w-3xl divide-y divide-border rounded-[1.5rem] border border-border bg-background-elevated">
        {faqs.map((faq, index) => {
          const open = openIndex === index;
          return (
            <div key={faq.question}>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
                onClick={() => setOpenIndex(open ? null : index)}
                aria-expanded={open}
              >
                <span className="text-base font-medium tracking-[-0.01em] text-foreground">{faq.question}</span>
                <ChevronDown
                  className={cn("size-4 shrink-0 text-foreground-subtle transition-transform", open && "rotate-180")}
                />
              </button>
              <div className={cn("grid transition-all", open ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
                <div className="overflow-hidden">
                  <p className="px-6 pb-5 text-sm leading-relaxed text-foreground-muted">{faq.answer}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}
