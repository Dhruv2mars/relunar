"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { Reveal } from "@/components/reveal";
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
  const reduceMotion = useReducedMotion();

  return (
    <Section eyebrow="FAQ" title="Questions, answered plainly." align="center">
      <Reveal>
        <div className="mx-auto max-w-3xl overflow-hidden rounded-[1.5rem] border border-border bg-background-elevated">
          {faqs.map((faq, index) => {
            const open = openIndex === index;
            const panelId = `faq-panel-${index}`;

            return (
              <div key={faq.question} className={cn(index > 0 && "border-t border-border")}>
                <button
                  type="button"
                  id={`faq-trigger-${index}`}
                  aria-expanded={open}
                  aria-controls={panelId}
                  className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--ring)] md:px-7"
                  onClick={() => setOpenIndex(open ? null : index)}
                >
                  <span className="text-base font-medium tracking-[-0.015em] text-foreground">{faq.question}</span>
                  <ChevronDown
                    className={cn(
                      "size-4 shrink-0 text-foreground-subtle transition-transform duration-300",
                      open && "rotate-180",
                    )}
                  />
                </button>
                <AnimatePresence initial={false}>
                  {open ? (
                    <motion.div
                      id={panelId}
                      role="region"
                      aria-labelledby={`faq-trigger-${index}`}
                      initial={reduceMotion ? false : { height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                      className="overflow-hidden"
                    >
                      <p className="px-6 pb-5 text-sm leading-[1.7] text-foreground-muted md:px-7 md:pb-6">
                        {faq.answer}
                      </p>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </Reveal>
    </Section>
  );
}
