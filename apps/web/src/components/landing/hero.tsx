"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { useSyncExternalStore, type ReactNode } from "react";
import { Button } from "@/components/button";
import { CopyButton } from "@/components/copy-button";
import { Eclipse } from "@/components/landing/eclipse";
import { TerminalRun } from "@/components/landing/terminal-run";
import { siteConfig } from "@/lib/site";

const easeOut = [0.19, 1, 0.22, 1] as const;

const subscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

function Enter({
  children,
  delay,
  className,
  canAnimate,
}: {
  children: ReactNode;
  delay: number;
  className?: string;
  canAnimate: boolean;
}) {
  if (!canAnimate) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 22 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay, ease: easeOut }}
    >
      {children}
    </motion.div>
  );
}

export function Hero() {
  const reduceMotion = useReducedMotion();
  const mounted = useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
  const canAnimate = mounted && !reduceMotion;

  return (
    <section className="night-field relative overflow-hidden">
      {/* Scrim so the fixed nav stays readable where the eclipse arc crosses it. */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-10 h-24 bg-gradient-to-b from-background/90 to-transparent"
        aria-hidden
      />
      {/* The eclipse rises behind the headline, bleeding off the top right. */}
      <div
        className="pointer-events-none absolute -right-[11rem] -top-[13rem] w-[30rem] sm:-right-[12rem] sm:-top-[15rem] sm:w-[38rem] lg:-right-[9rem] lg:-top-[22rem] lg:w-[52rem]"
        aria-hidden
      >
        {canAnimate ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.6, ease: easeOut }}
          >
            <Eclipse id="hero" className="w-full" />
          </motion.div>
        ) : (
          <Eclipse id="hero" className="w-full" />
        )}
      </div>

      <div className="relative mx-auto flex min-h-svh max-w-6xl flex-col justify-center px-5 pb-12 pt-24 sm:px-8 md:pt-28">
        <Enter delay={0} canAnimate={canAnimate}>
          <p className="mono-label text-accent-bright">
            The repro harness for coding agents
          </p>
        </Enter>

        <Enter delay={0.08} canAnimate={canAnimate}>
          <h1 className="display display-hero mt-6 max-w-[11ch] sm:max-w-none">
            <span className="block">Reproduce issues.</span>
            <span className="block text-accent">Keep the evidence.</span>
          </h1>
        </Enter>

        <div className="mt-10 grid grid-cols-[minmax(0,1fr)] items-start gap-12 md:mt-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.12fr)] lg:gap-16">
          <Enter delay={0.18} canAnimate={canAnimate} className="max-w-xl">
            <p className="text-pretty text-lg leading-[1.65] text-foreground-muted">
              Ask Codex, Cursor, or Claude Code to reproduce a GitHub issue. Relunar spins a
              clean Daytona sandbox, runs your baseline, and writes the evidence to your
              machine — never to the thread unless you say{" "}
              <code className="mono-data whitespace-nowrap rounded border border-border bg-code-bg px-1.5 py-0.5 text-[0.8em] text-accent-bright">
                --comment
              </code>
              .
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Button href="/docs/getting-started">Get started</Button>
              <Button href={siteConfig.github} variant="outline" external>
                GitHub
                <ArrowUpRight className="size-3.5" strokeWidth={2} />
              </Button>
            </div>

            <div className="mt-9 flex max-w-md items-center justify-between gap-3 rounded-md border border-border bg-code-bg py-1.5 pl-4 pr-1.5">
              <code className="mono-data truncate text-foreground-muted">
                <span className="select-none text-accent">$ </span>
                {siteConfig.installCommand}
              </code>
              <CopyButton value={siteConfig.installCommand} label="Copy" className="border-transparent" />
            </div>
          </Enter>

          <Enter delay={0.3} canAnimate={canAnimate}>
            <TerminalRun />
          </Enter>
        </div>
      </div>
    </section>
  );
}
