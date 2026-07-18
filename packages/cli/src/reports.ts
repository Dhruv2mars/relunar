import type { CommandEvidence, RunReport } from "./types";

/**
 * Maintainer-facing markdown for report.md and `--comment`.
 * Agent machinery (nextStep, full issue body, setup dumps, sandbox IDs) stays in report.json.
 */
export function renderMarkdownReport(report: RunReport, maxLogLines: number): string {
  const lines: string[] = [`## Repro: ${formatStatus(report.status)}`, ""];

  if (report.summary?.trim()) {
    lines.push(report.summary.trim(), "");
  } else if (!isFinalOutcome(report.status)) {
    lines.push(statusBlurb(report), "");
  }

  const reproSteps = report.reproSteps?.trim();
  if (reproSteps) {
    lines.push("### Steps to reproduce", "", reproSteps, "");
  }

  const observed = report.observed?.trim() || evidenceExcerpt(report.commands, maxLogLines);
  if (observed) {
    lines.push("### Observed", "", fenced(observed), "");
  }

  const expected = report.expected?.trim();
  if (expected) {
    lines.push("### Expected", "", expected, "");
  }

  lines.push("### Environment", "");
  lines.push(`- Repo: \`${report.repo}\`${report.commit ? ` @ \`${report.commit}\`` : ""}`);
  const environmentNotes = report.environmentNotes?.trim();
  if (environmentNotes) {
    for (const note of environmentNotes.split("\n")) {
      const trimmed = note.trim();
      if (trimmed) {
        lines.push(trimmed.startsWith("-") ? trimmed : `- ${trimmed}`);
      }
    }
  }
  lines.push("");

  lines.push(`Artifacts: \`.relunar/runs/${report.runId}\``);
  return `${lines.join("\n")}\n`;
}

export function isFinalizedRepro(report: RunReport): boolean {
  return (
    (report.status === "reproduced" || report.status === "not_reproduced" || report.status === "blocked") &&
    Boolean(report.summary?.trim()) &&
    report.commands.some((command) => command.name === "repro")
  );
}

export function hasIssueProbeEvidence(report: RunReport): boolean {
  return report.commands.some((command) => command.name === "repro");
}

export function agentNextStep(report: RunReport): string {
  switch (report.status) {
    case "environment_ready":
      if (hasIssueProbeEvidence(report)) {
        return `Probe evidence recorded (status is still environment_ready, not a final outcome). Run more probes with \`relunar repro exec ${report.runId} -- <command>\`, or finish with \`relunar repro finish ${report.runId} --outcome reproduced|not-reproduced|blocked --summary <text>\` (optional: --repro-steps, --observed, --expected, --environment).`;
      }
      return `Environment ready only — not reproduced. Read issue.body, plan probes, then \`relunar repro exec ${report.runId} -- <command>\` (or \`relunar repro ${report.issue.number} -- <command>\`). Finish only after probe evidence with --outcome and --summary.`;
    case "passed":
      return "Legacy dispose-on-ready run completed baseline only. Prefer `relunar repro start` and keep the sandbox warm for probes.";
    case "setup_failed":
      return "Setup failed before probing. Fix .relunar.yml setup commands or sandbox image, then start a new run.";
    case "baseline_failed":
      return "Baseline failed before probing. Fix baseline commands or the repo build, then start a new run.";
    case "aborted":
      return "Run aborted and sandbox disposed. Start a new run to continue.";
    case "reproduced":
    case "not_reproduced":
    case "blocked":
      return `Run finalized as ${report.status.replaceAll("_", "-")}. Sandbox disposed.`;
  }
}

export function withAgentNextStep(report: RunReport): RunReport {
  return { ...report, nextStep: agentNextStep(report) };
}

export function redactSecret(value: string, secret: string | null): string {
  if (!secret) {
    return value;
  }
  return value.split(secret).join("[redacted]");
}

function isFinalOutcome(status: RunReport["status"]): boolean {
  return status === "reproduced" || status === "not_reproduced" || status === "blocked";
}

function statusBlurb(report: RunReport): string {
  if (report.failure) {
    return report.failure;
  }
  switch (report.status) {
    case "environment_ready":
      return hasIssueProbeEvidence(report)
        ? "Sandbox ready; probe evidence recorded. Finish with an outcome when ready."
        : "Sandbox ready for probing — not yet reproduced.";
    case "passed":
      return "Baseline passed (legacy dispose-on-ready).";
    case "aborted":
      return "Run aborted.";
    case "setup_failed":
      return "Setup failed before probing.";
    case "baseline_failed":
      return "Baseline failed before probing.";
    default:
      return formatStatus(report.status);
  }
}

function formatStatus(status: RunReport["status"]): string {
  switch (status) {
    case "passed":
      return "Baseline passed";
    case "environment_ready":
      return "Environment ready";
    case "reproduced":
      return "Reproduced";
    case "not_reproduced":
      return "Not reproduced";
    case "aborted":
      return "Aborted";
    case "setup_failed":
      return "Setup failed";
    case "baseline_failed":
      return "Baseline failed";
    case "blocked":
      return "Blocked";
  }
}

/** Prefer agent-supplied observed text; else last repro (or failing) command output, trimmed. */
export function evidenceExcerpt(commands: CommandEvidence[], maxLogLines: number): string | null {
  const reproCommands = commands.filter((command) => command.name === "repro");
  const preferred =
    [...reproCommands].reverse().find((command) => command.status === "failed" || command.status === "timed_out") ??
    reproCommands.at(-1) ??
    commands.find((command) => command.status === "failed" || command.status === "timed_out");

  if (!preferred) {
    return null;
  }

  const output = [preferred.stderr, preferred.stdout].filter(Boolean).join("\n").trim();
  if (!output) {
    return preferred.status === "passed" ? null : "Command failed with no output.";
  }

  return trimLog(output, maxLogLines);
}

function trimLog(output: string, maxLogLines: number): string {
  const lines = output.split("\n");
  if (lines.length <= maxLogLines) {
    return output;
  }
  return lines.slice(-maxLogLines).join("\n");
}

function fenced(value: string): string {
  return `\`\`\`txt\n${value}\n\`\`\``;
}
