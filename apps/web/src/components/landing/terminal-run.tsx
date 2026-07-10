"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { cn } from "@/lib/cn";

type Line =
  | { kind: "cmd"; text: string }
  | { kind: "row"; label: string; text: string; tone?: "pass" | "fail" }
  | { kind: "gap" }
  | { kind: "note"; text: string };

const RUN: Line[] = [
  { kind: "cmd", text: "relunar repro 123" },
  { kind: "gap" },
  { kind: "row", label: "issue", text: "#123 · TypeError when parsing empty config" },
  { kind: "row", label: "sandbox", text: "daytona · fresh · acme/widget@main" },
  { kind: "row", label: "setup", text: "bun install · 142 packages", tone: "pass" },
  { kind: "row", label: "baseline", text: "bun test · 1 failed — reproduced", tone: "fail" },
  { kind: "row", label: "report", text: ".relunar/runs/run_7k2m9x4p/report.md" },
  { kind: "gap" },
  { kind: "note", text: "evidence written locally · nothing posted to GitHub" },
];

const CMD_INDEX = 0;
const TYPE_MS = 34;
const LINE_MS = 340;
const START_DELAY_MS = 900;

export function TerminalRun({ className }: { className?: string }) {
  const reduceMotion = useReducedMotion();
  // Fully rendered by default (SSR, no-JS, reduced motion). Animation opts in.
  const [visibleLines, setVisibleLines] = useState(RUN.length);
  const [typedChars, setTypedChars] = useState<number | null>(null);
  const [done, setDone] = useState(true);

  useEffect(() => {
    if (reduceMotion) return;

    const timers: number[] = [];
    const cmd = RUN[CMD_INDEX];
    const cmdLength = cmd?.kind === "cmd" ? cmd.text.length : 0;

    timers.push(
      window.setTimeout(() => {
        setDone(false);
        setVisibleLines(0);
        setTypedChars(0);
      }, 0),
    );

    let t = START_DELAY_MS;
    timers.push(window.setTimeout(() => setVisibleLines(1), t));
    for (let c = 1; c <= cmdLength; c += 1) {
      t += TYPE_MS;
      const chars = c;
      timers.push(window.setTimeout(() => setTypedChars(chars), t));
    }
    t += 420;
    for (let line = 2; line <= RUN.length; line += 1) {
      const count = line;
      const lineDef = RUN[line - 1];
      t += lineDef?.kind === "gap" ? 120 : LINE_MS;
      timers.push(window.setTimeout(() => setVisibleLines(count), t));
    }
    t += 300;
    timers.push(window.setTimeout(() => setDone(true), t));

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      setVisibleLines(RUN.length);
      setTypedChars(null);
      setDone(true);
    };
  }, [reduceMotion]);

  return (
    <div
      className={cn("panel overflow-hidden rounded-lg shadow-[0_32px_80px_-32px_oklch(0.05_0.02_268/0.9)]", className)}
      role="img"
      aria-label="Terminal session: relunar repro 123 creates a sandbox, runs the baseline, reproduces the failure, and writes a local report."
    >
      <div className="flex min-h-10 items-center justify-between border-b border-[var(--code-border)] px-4">
        <p className="mono-label text-foreground-subtle">maintainer@laptop — 23:41</p>
        <p className="mono-label text-foreground-subtle">relunar v0.1</p>
      </div>

      <div className="mono-data min-h-[16.5rem] overflow-x-auto px-4 py-4 sm:px-5" aria-hidden>
        {RUN.slice(0, visibleLines).map((line, index) => {
          if (line.kind === "gap") {
            return <div key={index} className="h-3" />;
          }

          if (line.kind === "cmd") {
            const text =
              typedChars === null ? line.text : line.text.slice(0, typedChars);
            const typing = typedChars !== null && typedChars < line.text.length;
            return (
              <p key={index} className="text-foreground">
                <span className="select-none text-accent">$ </span>
                {text}
                {typing ? <span className="terminal-caret" /> : null}
              </p>
            );
          }

          if (line.kind === "note") {
            return (
              <p key={index} className="whitespace-nowrap text-pass">
                <span className="select-none">✓ </span>
                {line.text}
              </p>
            );
          }

          return (
            <p key={index} className="flex gap-3 whitespace-nowrap">
              <span className="w-[4.5rem] shrink-0 select-none text-foreground-subtle">
                {line.label}
              </span>
              <span
                className={cn(
                  line.tone === "pass" && "text-pass",
                  line.tone === "fail" && "text-fail",
                  !line.tone && "text-foreground-muted",
                )}
              >
                {line.text}
              </span>
            </p>
          );
        })}
        {done ? (
          <p className="text-foreground">
            <span className="select-none text-accent">$ </span>
            <span className="terminal-caret" />
          </p>
        ) : null}
      </div>
    </div>
  );
}
