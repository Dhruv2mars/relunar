import type { CommandRun, ErrorCategory, JobResult } from "./types";

export type Classification = {
  result: JobResult;
  errorCategory: ErrorCategory | null;
  errorMessage: string | null;
};

export function classifyCommandRuns(commands: readonly CommandRun[]): Classification {
  const firstFailure = commands.find((command) => command.timedOut || command.exitCode !== 0);

  if (!firstFailure) {
    return {
      result: "baseline_passed",
      errorCategory: null,
      errorMessage: null,
    };
  }

  const errorCategory: ErrorCategory = firstFailure.timedOut ? "command_timeout" : "command_failed";
  const exitText = firstFailure.exitCode === null ? "no exit code" : `exit code ${firstFailure.exitCode}`;
  const errorMessage = `${firstFailure.command} failed with ${exitText}`;

  if (firstFailure.phase === "build" || firstFailure.phase === "test") {
    return {
      result: "baseline_failed",
      errorCategory,
      errorMessage,
    };
  }

  if (firstFailure.phase === "clone") {
    return {
      result: "blocked",
      errorCategory: "clone_error",
      errorMessage,
    };
  }

  return {
    result: "blocked",
    errorCategory,
    errorMessage,
  };
}
