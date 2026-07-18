import type { CommandEvidence, RunReport } from "./types";

export function renderMarkdownReport(report: RunReport, maxLogLines: number): string {
  const lines: string[] = [
    "## Relunar Repro Report",
    "",
    `Status: ${formatStatus(report.status)}`,
    isFinalizedRepro(report)
      ? "Evidence: issue-specific commands captured in this report."
      : "Evidence: environment baseline only; this command does not itself prove the issue behavior.",
    "",
    `Next step: ${report.nextStep}`,
    "",
  ];

  if (report.summary) {
    lines.push(`Summary: ${report.summary}`, "");
  }

  lines.push(
    `Issue: #${report.issue.number} (${report.issue.state})`,
    `Title: ${report.issue.title}`,
    `Repo: ${report.repo}`,
    `Commit: ${report.commit ?? "unknown"}`,
    `Sandbox: Daytona ${report.sandbox.id ?? "unavailable"}`,
    "",
    "Issue body:",
    fenced(report.issue.body.trim() || "(empty)"),
    "",
    "Commands:",
  );

  for (const command of report.commands) {
    lines.push(`- ${command.command}: ${formatCommandStatus(command)}`);
  }

  if (report.failure) {
    lines.push("", "Failure:", fenced(excerpt(report.commands, maxLogLines)));
  }

  lines.push("", "Artifacts:", `- Local run: .relunar/runs/${report.runId}`);
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
        return `Probe evidence recorded (status is still environment_ready, not a final outcome). Run more probes with \`relunar repro exec ${report.runId} -- <command>\`, or finish with \`relunar repro finish ${report.runId} --outcome reproduced|not-reproduced|blocked --summary <text>\`.`;
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

function formatStatus(status: RunReport["status"]): string {
  switch (status) {
    case "passed":
      return "Baseline passed";
    case "environment_ready":
      return "Environment ready (not reproduced — probing still required)";
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

function formatCommandStatus(command: CommandEvidence): string {
  if (command.status === "timed_out") {
    return "timed out";
  }
  if (command.status === "passed") {
    return "passed";
  }
  if (command.exitCode === null) {
    return command.status;
  }
  return `${command.status} (${command.exitCode})`;
}

function excerpt(commands: CommandEvidence[], maxLogLines: number): string {
  const failed = commands.find((command) => command.status === "failed" || command.status === "timed_out");
  if (!failed) {
    return "No failing command captured.";
  }

  const output = [failed.stderr, failed.stdout].filter(Boolean).join("\n").trim();
  if (!output) {
    return "Command failed with no output.";
  }

  return output.split("\n").slice(-maxLogLines).join("\n");
}

function fenced(value: string): string {
  return `\`\`\`txt\n${value}\n\`\`\``;
}
