import type { CommandEvidence, RunReport } from "./types";

export function renderMarkdownReport(report: RunReport, maxLogLines: number): string {
  const lines: string[] = [
    "## Relunar Repro Report",
    "",
    `Status: ${formatStatus(report.status)}`,
    "",
    `Issue: #${report.issue.number}`,
    `Repo: ${report.repo}`,
    `Commit: ${report.commit ?? "unknown"}`,
    `Sandbox: Daytona ${report.sandbox.id ?? "unavailable"}`,
    "",
    "Commands:",
  ];

  for (const command of report.commands) {
    lines.push(`- ${command.command}: ${formatCommandStatus(command)}`);
  }

  if (report.failure) {
    lines.push("", "Failure:", fenced(excerpt(report.commands, maxLogLines)));
  }

  lines.push("", "Artifacts:", `- Local run: .relunar/runs/${report.runId}`);
  return `${lines.join("\n")}\n`;
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
