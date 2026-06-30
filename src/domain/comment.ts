import { createHash } from "node:crypto";
import type { CommandRun, JobResult, PackageManager } from "./types";

export type RenderCommentInput = {
  result: JobResult;
  repositoryFullName: string;
  commitSha: string | null;
  packageManager: PackageManager | null;
  commands: readonly CommandRun[];
  sandbox: {
    id: string | null;
    target: string | null;
    runtime: "daytona";
  };
  errorMessage?: string | null;
};

const statusLabels: Record<JobResult, string> = {
  baseline_passed: "Baseline passed",
  baseline_failed: "Baseline failed",
  blocked: "Blocked",
  run_failed: "Run failed",
};

export function renderBaselineComment(input: RenderCommentInput): string {
  const lines: string[] = [
    "## Relunar baseline report",
    "",
    `Status: ${statusLabels[input.result]}`,
    "",
    "Repository:",
    `- Name: ${input.repositoryFullName}`,
    `- Commit: ${input.commitSha ?? "unknown"}`,
    `- Package manager: ${input.packageManager ?? "unknown"}`,
    "",
    "Sandbox:",
    `- Runtime: ${input.sandbox.runtime}`,
    `- ID: ${input.sandbox.id ?? "unknown"}`,
    `- Target: ${input.sandbox.target ?? "unknown"}`,
    "",
    "Commands:",
  ];

  if (input.commands.length === 0) {
    lines.push("- none");
  } else {
    for (const command of input.commands) {
      const outcome = command.timedOut
        ? "timed out"
        : command.exitCode === 0
          ? "passed"
          : `failed with exit code ${command.exitCode ?? "unknown"}`;
      lines.push(`- \`${command.command}\` -> ${outcome}`);
    }
  }

  const failedCommand = input.commands.find((command) => command.timedOut || command.exitCode !== 0);
  if (failedCommand) {
    lines.push("", "Failure:");
    lines.push(`- Command: \`${failedCommand.command}\``);
    lines.push(`- Exit code: ${failedCommand.exitCode ?? "unknown"}`);
    lines.push(`- Timed out: ${failedCommand.timedOut ? "yes" : "no"}`);
    const excerpt = formatExcerpt(failedCommand.stderrExcerpt || failedCommand.stdoutExcerpt);
    if (excerpt) {
      lines.push("", "Log excerpt:", "```txt", excerpt, "```");
    }
  }

  lines.push("", "Result:");
  lines.push(resultSentence(input));
  lines.push("");
  lines.push("Relunar did not attempt issue-specific reproduction in this milestone.");

  return lines.join("\n");
}

export function hashCommentBody(body: string): string {
  return createHash("sha256").update(body).digest("hex");
}

function resultSentence(input: RenderCommentInput): string {
  if (input.errorMessage) {
    return input.errorMessage;
  }

  switch (input.result) {
    case "baseline_passed":
      return "All baseline commands passed in a clean Daytona sandbox.";
    case "baseline_failed":
      return "The repository installed, but a detected baseline command failed in a clean Daytona sandbox.";
    case "blocked":
      return "Relunar could not complete repository setup in a clean Daytona sandbox.";
    case "run_failed":
      return "Relunar could not complete the run because of an infrastructure or integration failure.";
  }
}

function formatExcerpt(text: string): string {
  return text.trim().split("\n").slice(-40).join("\n").slice(-4000);
}
