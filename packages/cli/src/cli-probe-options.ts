import { flagBoolean, flagNeedsValue, flagString } from "./args";
import type { ProbeExpectations, ReproOutcome } from "./types";

export function parseOutcome(value: string | undefined): ReproOutcome | null {
  if (value === "reproduced" || value === "blocked") return value;
  if (value === "not-reproduced") return "not_reproduced";
  return null;
}

export function optionalTrueFlag(flags: Record<string, string | boolean>, name: string): true | undefined {
  return flagBoolean(flags, name) ? true : undefined;
}

export function parseFinishNarrative(flags: Record<string, string | boolean>): {
  summary: string;
  reproSteps?: string;
  observed?: string;
  expected?: string;
  environmentNotes?: string;
  evidenceIds?: string[];
} | null {
  const summary = flagString(flags, "summary")?.trim();
  if (!summary) return null;
  const narrative: {
    summary: string;
    reproSteps?: string;
    observed?: string;
    expected?: string;
    environmentNotes?: string;
    evidenceIds?: string[];
  } = { summary };
  const reproSteps = flagString(flags, "repro-steps")?.trim();
  const observed = flagString(flags, "observed")?.trim();
  const expected = flagString(flags, "expected")?.trim();
  const environmentNotes = flagString(flags, "environment")?.trim();
  const evidenceIds = flagString(flags, "evidence")?.split(",").map((value) => value.trim()).filter(Boolean);
  if (reproSteps) narrative.reproSteps = reproSteps;
  if (observed) narrative.observed = observed;
  if (expected) narrative.expected = expected;
  if (environmentNotes) narrative.environmentNotes = environmentNotes;
  if (evidenceIds?.length) narrative.evidenceIds = evidenceIds;
  return narrative;
}

export function hasCompleteNarrative(narrative: NonNullable<ReturnType<typeof parseFinishNarrative>>): boolean {
  return Boolean(
    narrative.reproSteps?.trim() &&
      narrative.observed?.trim() &&
      narrative.expected?.trim() &&
      narrative.environmentNotes?.trim(),
  );
}

export function shellCommand(args: string[]): string {
  return args.map((arg) => /^[A-Za-z0-9_./:=@%+,-]+$/.test(arg) ? arg : `'${arg.replaceAll("'", `'\\''`)}'`).join(" ");
}

export function parseProbeOptions(flags: Record<string, string | boolean>): {
  expectations: ProbeExpectations;
  repeat?: number;
  resetCommand?: string;
  control?: { command: string; expectations: ProbeExpectations };
  claim?: string;
} {
  for (const name of [
    "claim", "expect-exit", "stdout-match", "stderr-match", "output-match", "file-exists",
    "max-duration-ms", "repeat", "reset-command", "control-command", "control-expect-exit", "control-output-match",
  ]) {
    if (flagNeedsValue(flags, name)) throw new Error(`Missing value for --${name}.`);
  }

  const expectations: ProbeExpectations = {};
  const exit = flagString(flags, "expect-exit");
  if (exit !== undefined) {
    if (!/^-?\d+$/.test(exit)) throw new Error("--expect-exit must be an integer.");
    expectations.exitCode = Number.parseInt(exit, 10);
  }
  const stdout = flagString(flags, "stdout-match");
  const stderr = flagString(flags, "stderr-match");
  const output = flagString(flags, "output-match");
  if (stdout) expectations.stdoutMatches = stdout;
  if (stderr) expectations.stderrMatches = stderr;
  if (output) expectations.outputMatches = output;
  const files = flagString(flags, "file-exists")?.split(",").map((value) => value.trim()).filter(Boolean);
  if (files?.length) expectations.filesExist = files;

  const maxDuration = parsePositiveFlag(flags, "max-duration-ms");
  if (maxDuration !== undefined) expectations.maxDurationMs = maxDuration;
  const repeat = parsePositiveFlag(flags, "repeat");
  const resetCommand = flagString(flags, "reset-command")?.trim();
  const controlCommand = flagString(flags, "control-command")?.trim();
  const controlExpectations: ProbeExpectations = {};
  const controlExit = flagString(flags, "control-expect-exit");
  if (controlExit !== undefined) {
    if (!/^-?\d+$/.test(controlExit)) throw new Error("--control-expect-exit must be an integer.");
    controlExpectations.exitCode = Number.parseInt(controlExit, 10);
  }
  const controlOutput = flagString(flags, "control-output-match")?.trim();
  const claim = flagString(flags, "claim")?.trim();
  if (Object.keys(expectations).length > 0 && !claim) {
    throw new Error("Machine-asserted probes require --claim describing the issue behavior being tested.");
  }
  if (controlOutput) controlExpectations.outputMatches = controlOutput;
  if ((controlExit !== undefined || controlOutput) && !controlCommand) throw new Error("Control expectations require --control-command.");
  if (controlCommand && Object.keys(controlExpectations).length === 0) {
    throw new Error("--control-command requires --control-expect-exit or --control-output-match.");
  }
  return {
    expectations,
    ...(repeat !== undefined ? { repeat } : {}),
    ...(resetCommand ? { resetCommand } : {}),
    ...(controlCommand ? { control: { command: controlCommand, expectations: controlExpectations } } : {}),
    ...(claim ? { claim } : {}),
  };
}

function parsePositiveFlag(flags: Record<string, string | boolean>, name: string): number | undefined {
  const value = flagString(flags, name);
  if (value === undefined) return undefined;
  if (!/^[1-9]\d*$/.test(value)) throw new Error(`--${name} must be a positive integer.`);
  return Number.parseInt(value, 10);
}
