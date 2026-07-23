import type {
  CommandEvidence,
  ProbeCheck,
  ProbeExpectations,
  SandboxExecResult,
  SandboxSession,
} from "./types";

export type ExecuteProbeInput = {
  sandbox: SandboxSession;
  command: string;
  cwd: string;
  timeoutSeconds: number;
  expectations: ProbeExpectations;
  repeat?: number | undefined;
  env?: Record<string, string> | undefined;
  secrets?: string[] | undefined;
  resetCommand?: string | undefined;
  control?: { command: string; expectations: ProbeExpectations } | undefined;
  evidenceId?: string | undefined;
  claim?: string | undefined;
};

export async function executeProbe(input: ExecuteProbeInput): Promise<CommandEvidence[]> {
  const totalAttempts = input.repeat ?? 1;
  if (!Number.isInteger(totalAttempts) || totalAttempts < 1) {
    throw new Error("Probe repeat must be a positive integer.");
  }

  const evidence: CommandEvidence[] = [];
  if (input.control) {
    evidence.push(await executeOne(input, "control", input.control.command, input.control.expectations, 1, 1));
  }
  for (let attempt = 1; attempt <= totalAttempts; attempt += 1) {
    if (attempt > 1 && input.resetCommand) {
      evidence.push(await executeUnverified(input, "probe_reset", input.resetCommand));
    }
    evidence.push(await executeOne(input, "repro", input.command, input.expectations, attempt, totalAttempts));
  }
  return evidence;
}

async function executeOne(
  input: ExecuteProbeInput,
  name: string,
  command: string,
  expectations: ProbeExpectations,
  attempt: number,
  totalAttempts: number,
): Promise<CommandEvidence> {
  const evidence = await executeUnverified(input, name, command);
  if (input.evidenceId) evidence.evidenceId = input.evidenceId;
  if (input.claim) evidence.claim = input.claim;
  const result: SandboxExecResult = {
    exitCode: evidence.exitCode,
    stdout: evidence.stdout,
    stderr: evidence.stderr,
    timedOut: evidence.status === "timed_out",
  };
  const checks = await evaluateChecks(input.sandbox, result, evidence.durationMs, expectations, input.timeoutSeconds, input.cwd);
  const verified = checks.length > 0;
  evidence.verification = { verified, passed: verified && checks.every((check) => check.passed), attempt, totalAttempts, checks };
  return evidence;
}

async function executeUnverified(input: ExecuteProbeInput, name: string, command: string): Promise<CommandEvidence> {
  const startedAt = new Date().toISOString();
  const started = Date.now();
  const raw = await input.sandbox.run(command, input.cwd, input.timeoutSeconds, input.env);
  return {
    name,
    command,
    status: raw.timedOut ? "timed_out" : raw.exitCode === 0 ? "passed" : "failed",
    exitCode: raw.exitCode,
    durationMs: Date.now() - started,
    stdout: redact(raw.stdout, input.secrets ?? []),
    stderr: redact(raw.stderr, input.secrets ?? []),
    cwd: input.cwd,
    envNames: Object.keys(input.env ?? {}).sort(),
    startedAt,
    finishedAt: new Date().toISOString(),
  };
}

async function evaluateChecks(
  sandbox: SandboxSession,
  result: SandboxExecResult,
  durationMs: number,
  expectations: ProbeExpectations,
  timeoutSeconds: number,
  cwd: string,
): Promise<ProbeCheck[]> {
  const checks: ProbeCheck[] = [];
  if (expectations.exitCode !== undefined) {
    checks.push(check("exit_code", String(expectations.exitCode), String(result.exitCode), result.exitCode === expectations.exitCode));
  }
  if (expectations.stdoutMatches) {
    checks.push(regexCheck("stdout_matches", expectations.stdoutMatches, result.stdout));
  }
  if (expectations.stderrMatches) {
    checks.push(regexCheck("stderr_matches", expectations.stderrMatches, result.stderr));
  }
  if (expectations.outputMatches) {
    checks.push(regexCheck("output_matches", expectations.outputMatches, `${result.stdout}\n${result.stderr}`));
  }
  if (expectations.maxDurationMs !== undefined) {
    checks.push(check("max_duration", `<=${expectations.maxDurationMs}ms`, `${durationMs}ms`, durationMs <= expectations.maxDurationMs));
  }
  for (const path of expectations.filesExist ?? []) {
    const exists = await sandbox.run(`test -e ${shellQuote(path)}`, cwd, timeoutSeconds);
    checks.push(check("file_exists", path, exists.exitCode === 0 ? "exists" : "missing", exists.exitCode === 0));
  }
  return checks;
}

function regexCheck(kind: ProbeCheck["kind"], pattern: string, value: string): ProbeCheck {
  let regex: RegExp;
  try {
    regex = compilePattern(pattern);
  } catch {
    throw new Error(`Invalid probe expectation regex: ${pattern}`);
  }
  return check(kind, `/${pattern}/`, value, regex.test(value));
}

function compilePattern(pattern: string): RegExp {
  if (pattern.startsWith("(?i)")) return new RegExp(pattern.slice(4), "im");
  return new RegExp(pattern, "m");
}

function check(kind: ProbeCheck["kind"], expected: string, actual: string, passed: boolean): ProbeCheck {
  return { kind, expected, actual, passed };
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'\\''`)}'`;
}

function redact(value: string, secrets: string[]): string {
  return secrets.filter(Boolean).reduce((current, secret) => current.split(secret).join("[redacted]"), value);
}
