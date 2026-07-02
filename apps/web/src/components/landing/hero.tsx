"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/button";
import { CodePanel } from "@/components/code-panel";
import { CopyButton } from "@/components/copy-button";
import { siteConfig } from "@/lib/site";

const installLines = ["relunar setup", "relunar repro 123"] as const;

export function Hero() {
  const reduceMotion = useReducedMotion();

  return (
    <section className="relative overflow-hidden px-6 pb-24 pt-20 md:pb-32 md:pt-28">
      <div className="hero-glow pointer-events-none absolute inset-0" />
      <div className="relative mx-auto max-w-6xl">
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto max-w-4xl text-center"
        >
          <div className="mb-8 inline-flex items-center gap-2.5 rounded-full border border-border bg-surface px-4 py-1.5 text-xs font-medium text-foreground-muted backdrop-blur-md">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-30" />
              <span className="relative inline-flex size-2 rounded-full bg-accent" />
            </span>
            CLI harness for coding agents
          </div>
          <h1 className="display-serif text-balance text-[2.75rem] leading-[0.98] tracking-[-0.04em] text-foreground sm:text-6xl md:text-7xl">
            Reproduce GitHub issues with evidence, not guesswork.
          </h1>
          <p className="mx-auto mt-7 max-w-2xl text-balance text-lg leading-[1.65] text-foreground-muted md:text-xl md:leading-[1.6]">
            Relunar gives your coding agent deterministic sandbox plumbing — GitHub reads, Daytona
            environments, structured reports, and optional issue comments when you ask.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
            <Button href="/docs/getting-started">Get started</Button>
            <Button href={siteConfig.github} variant="secondary" external>
              View on GitHub
              <ArrowUpRight className="size-4" strokeWidth={1.75} />
            </Button>
          </div>
        </motion.div>

        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 26 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto mt-16 max-w-3xl md:mt-20"
        >
          <CodePanel title="Install" actions={<CopyButton value={siteConfig.installCommand} label="Copy" />}>
            <div className="space-y-1 px-5 py-6 font-mono text-[0.9rem] leading-8 md:px-7">
              <p>
                <span className="select-none text-foreground-subtle">$</span>{" "}
                <span className="text-foreground">{siteConfig.installCommand}</span>
              </p>
              {installLines.map((line) => (
                <p key={line}>
                  <span className="select-none text-foreground-subtle">$</span>{" "}
                  <span className="text-foreground-muted">{line}</span>
                </p>
              ))}
            </div>
          </CodePanel>
        </motion.div>

        <motion.div
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.9, delay: 0.28 }}
          className="mx-auto mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-foreground-subtle md:gap-x-8"
        >
          {["Agent-driven workflow", "Your GitHub + Daytona credentials", "Local reports by default"].map(
            (item, index) => (
              <span key={item} className="inline-flex items-center gap-x-6">
                {index > 0 ? <span className="hidden h-1 w-1 rounded-full bg-border-strong sm:inline-block" /> : null}
                {item}
              </span>
            ),
          )}
        </motion.div>
      </div>
    </section>
  );
}
