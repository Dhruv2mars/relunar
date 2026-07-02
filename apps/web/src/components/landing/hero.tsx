"use client";

import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/button";
import { CopyButton } from "@/components/copy-button";
import { siteConfig } from "@/lib/site";

export function Hero() {
  return (
    <section className="relative overflow-hidden px-6 pb-20 pt-16 md:pb-28 md:pt-24">
      <div className="hero-glow pointer-events-none absolute inset-0" />
      <div className="relative mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto max-w-4xl text-center"
        >
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-1.5 text-xs font-medium text-foreground-muted backdrop-blur">
            <span className="size-1.5 rounded-full bg-accent" />
            CLI harness for coding agents
          </div>
          <h1 className="display-serif text-balance text-5xl leading-[0.98] tracking-[-0.04em] text-foreground md:text-7xl">
            Reproduce GitHub issues with evidence, not guesswork.
          </h1>
          <p className="mx-auto mt-7 max-w-2xl text-balance text-lg leading-relaxed text-foreground-muted md:text-xl">
            Relunar gives your coding agent deterministic sandbox plumbing — GitHub reads, Daytona
            environments, structured reports, and optional issue comments when you ask.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button href="/docs/getting-started">Get started</Button>
            <Button href={siteConfig.github} variant="secondary" external>
              View on GitHub
              <ArrowUpRight className="ml-1.5 size-4" />
            </Button>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto mt-16 max-w-3xl"
        >
          <div className="glass-panel overflow-hidden rounded-[1.75rem] border border-border">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-foreground-subtle">
                Install
              </p>
              <CopyButton value={siteConfig.installCommand} label="Copy command" />
            </div>
            <div className="bg-code-bg px-5 py-6 font-mono text-sm leading-relaxed text-foreground md:px-7 md:text-[0.95rem]">
              <p className="text-foreground-subtle">$ {siteConfig.installCommand}</p>
              <p className="mt-4 text-foreground-subtle">$ relunar setup</p>
              <p className="text-foreground-subtle">$ relunar repro 123</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.35 }}
          className="mx-auto mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-foreground-subtle"
        >
          <span>Agent-driven workflow</span>
          <span className="hidden h-1 w-1 rounded-full bg-border-strong sm:inline-block" />
          <span>Your GitHub + Daytona credentials</span>
          <span className="hidden h-1 w-1 rounded-full bg-border-strong sm:inline-block" />
          <span>Local reports by default</span>
        </motion.div>
      </div>
    </section>
  );
}
