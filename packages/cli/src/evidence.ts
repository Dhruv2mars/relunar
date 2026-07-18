import type { CommandEvidence, EvidenceGate, RelunarConfig, ReproOutcome, RunReport, SandboxSession } from "./types";

export type EvidenceGateOptions = {
  skip?: boolean | undefined;
  sandbox?: SandboxSession | undefined;
  timeoutSeconds?: number | undefined;
};

/** Enforce outcome-scoped evidence gates before finish finalizes a run. */
export async function assertEvidenceGates(
  report: RunReport,
  outcome: ReproOutcome,
  config: RelunarConfig,
  options: EvidenceGateOptions = {},
): Promise<void> {
  if (options.skip) {
    return;
  }

  const gate = resolveGate(outcome, config);
  const reproCommands = report.commands.filter((command) => command.name === "repro");

  if (gate.requireReproCommand !== false && reproCommands.length === 0) {
    throw new Error("Cannot finish repro without issue-specific command evidence.");
  }

  if (gate.requireNonZeroExit && !reproCommands.some((command) => isFailureSignal(command))) {
    throw new Error("Evidence gate failed: reproduced requires at least one failing or timed-out repro command.");
  }

  if (gate.requireZeroExit && !reproCommands.some((command) => command.status === "passed" && command.exitCode === 0)) {
    throw new Error("Evidence gate failed: outcome requires at least one successful repro command (exit 0).");
  }

  if (gate.requireProbeOutput && !reproCommands.some((command) => hasTextOutput(command))) {
    throw new Error("Evidence gate failed: at least one repro command must produce stdout or stderr.");
  }

  if (gate.requireProbeSignal && !reproCommands.some((command) => isFailureSignal(command) || hasTextOutput(command))) {
    throw new Error("Evidence gate failed: at least one repro command must fail, time out, or produce output.");
  }

  if (gate.requireOutputMatch) {
    let regex: RegExp;
    try {
      regex = compileOutputMatch(gate.requireOutputMatch);
    } catch {
      throw new Error(`Evidence gate failed: invalid requireOutputMatch regex: ${gate.requireOutputMatch}`);
    }
    const matched = reproCommands.some((command) => regex.test(`${command.stdout}\n${command.stderr}`));
    if (!matched) {
      throw new Error(`Evidence gate failed: repro output did not match /${gate.requireOutputMatch}/.`);
    }
  }

  const artifacts = gate.requireArtifacts ?? [];
  if (artifacts.length > 0) {
    if (!options.sandbox) {
      throw new Error("Evidence gate failed: artifact checks require an active sandbox.");
    }
    const timeoutSeconds = options.timeoutSeconds ?? config.commandTimeoutSeconds;
    for (const artifact of artifacts) {
      const result = await options.sandbox.run(`test -e ${shellQuote(artifact)}`, ".", timeoutSeconds);
      if (result.exitCode !== 0) {
        throw new Error(`Evidence gate failed: required artifact missing in sandbox: ${artifact}`);
      }
    }
  }
}

function resolveGate(outcome: ReproOutcome, config: RelunarConfig): EvidenceGate {
  const configured = config.evidence?.[outcome] ?? {};
  if (outcome === "reproduced") {
    const hasExplicitSignalGate =
      configured.requireProbeOutput !== undefined ||
      configured.requireNonZeroExit !== undefined ||
      configured.requireProbeSignal !== undefined;
    return {
      requireReproCommand: true,
      ...configured,
      // Default: failure/timeout or captured text (Daytona may collapse stderr).
      requireProbeSignal: configured.requireProbeSignal ?? (hasExplicitSignalGate ? false : true),
    };
  }
  if (outcome === "not_reproduced") {
    return {
      requireReproCommand: true,
      ...configured,
    };
  }
  return {
    requireReproCommand: false,
    ...configured,
  };
}

function isFailureSignal(command: CommandEvidence): boolean {
  return command.status === "failed" || command.status === "timed_out";
}

function hasTextOutput(command: CommandEvidence): boolean {
  return command.stdout.trim().length > 0 || command.stderr.trim().length > 0;
}

/** Accept JS regexes plus a leading `(?i)` inline flag (documented in README). */
export function compileOutputMatch(pattern: string): RegExp {
  let source = pattern;
  let flags = "m";
  if (source.startsWith("(?i)")) {
    source = source.slice(4);
    flags += "i";
  }
  return new RegExp(source, flags);
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'\\''`)}'`;
}
