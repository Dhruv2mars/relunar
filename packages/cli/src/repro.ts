import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseRelunarConfig, defaultRelunarConfig, resolveAutoStopMinutes } from "./config";
import { assertEvidenceGates } from "./evidence";
import { redactSecret, withAgentNextStep } from "./reports";
import { createRunId, readRun, writeRun } from "./runs";
import { syncWorktree } from "./sync";
import type { CommandEvidence, Issue, RelunarConfig, RepoSlug, ReproOutcome, RunReport, SandboxProvider, SandboxSession } from "./types";

export type ReproInput = {
  cwd: string;
  repo: RepoSlug;
  issue: Issue;
  githubToken: string;
  sandboxProvider: SandboxProvider;
  commandTimeoutSeconds?: number;
};

export async function runRepro(input: ReproInput): Promise<RunReport> {
  return runInitialRepro(input, true);
}

export async function startRepro(input: ReproInput): Promise<RunReport> {
  return runInitialRepro(input, false);
}

async function runInitialRepro(input: ReproInput, disposeOnReady: boolean): Promise<RunReport> {
  const runId = createRunId(input.issue.number);
  const startedAt = new Date().toISOString();
  const commands: CommandEvidence[] = [];
  let sandbox: SandboxSession | null = null;
  let commit: string | null = null;
  let config: RelunarConfig = defaultRelunarConfig;
  let commandTimeoutSeconds = input.commandTimeoutSeconds ?? config.commandTimeoutSeconds;
  let keepSandbox = false;

  try {
    const localConfig = await readLocalConfig(input.cwd);
    const hasLocalConfig = localConfig !== null;
    if (localConfig) {
      config = localConfig;
      commandTimeoutSeconds = input.commandTimeoutSeconds ?? config.commandTimeoutSeconds;
    }
    sandbox = await input.sandboxProvider.createSandbox({
      runId,
      image: config.sandbox?.image,
      resources: config.sandbox?.resources,
      autoStopMinutes: resolveAutoStopMinutes(config),
    });

    commands.push(
      await execEvidence({
        sandbox,
        name: "clone",
        command: `git clone --depth 1 https://x-access-token:$GITHUB_TOKEN@github.com/${input.repo}.git repo`,
        cwd: ".",
        timeoutSeconds: commandTimeoutSeconds,
        env: { GITHUB_TOKEN: input.githubToken },
        secret: input.githubToken,
      }),
    );

    if (lastFailed(commands)) {
      return await finish(input, startedAt, runId, "setup_failed", commands, commit, sandbox, "Repository clone failed", config);
    }

    const commitResult = await sandbox.run("git rev-parse --short HEAD", "repo", commandTimeoutSeconds);
    commit = commitResult.exitCode === 0 ? commitResult.stdout.trim() : null;

    if (!hasLocalConfig) {
      const configResult = await sandbox.run("test -f .relunar.yml && cat .relunar.yml || true", "repo", commandTimeoutSeconds);
      if (configResult.stdout.trim().length > 0) {
        config = parseRelunarConfig(configResult.stdout);
        commandTimeoutSeconds = input.commandTimeoutSeconds ?? config.commandTimeoutSeconds;
      }
    }

    for (const command of config.setup) {
      commands.push(
        await execEvidence({
          sandbox,
          name: "setup",
          command,
          cwd: "repo",
          timeoutSeconds: commandTimeoutSeconds,
          secret: input.githubToken,
        }),
      );
      if (lastFailed(commands)) {
        return await finish(input, startedAt, runId, "setup_failed", commands, commit, sandbox, `${command} failed`, config);
      }
    }

    for (const command of config.baseline) {
      commands.push(
        await execEvidence({
          sandbox,
          name: "baseline",
          command,
          cwd: "repo",
          timeoutSeconds: commandTimeoutSeconds,
          secret: input.githubToken,
        }),
      );
      if (lastFailed(commands)) {
        return await finish(input, startedAt, runId, "baseline_failed", commands, commit, sandbox, `${command} failed`, config);
      }
    }

    const report = await finish(input, startedAt, runId, disposeOnReady ? "passed" : "environment_ready", commands, commit, sandbox, null, config);
    if (!disposeOnReady) {
      keepSandbox = true;
    }
    return report;
  } catch (error) {
    const failure = error instanceof Error ? error.message : String(error);
    return await finish(input, startedAt, runId, "blocked", commands, commit, sandbox, failure, config);
  } finally {
    if (sandbox && !keepSandbox) {
      await sandbox.dispose();
    }
  }
}

export type ExecReproInput = {
  cwd: string;
  runId: string;
  command: string;
  sandboxProvider: SandboxProvider;
  sync?: boolean | undefined;
  includeUntracked?: boolean | undefined;
};

export async function execRepro(input: ExecReproInput): Promise<RunReport> {
  const report = await requireReadyRun(input.cwd, input.runId);
  const config = (await readLocalConfig(input.cwd)) ?? defaultRelunarConfig;
  const sandbox = await resumeAndTouch(input.sandboxProvider, report, config);

  const shouldSync = input.sync === true || config.sync?.onExec === true;
  if (shouldSync) {
    const syncEvidence = await recordSync(input.cwd, sandbox, config, input.includeUntracked);
    report.commands.push(syncEvidence);
    if (syncEvidence.status === "failed") {
      report.finishedAt = new Date().toISOString();
      await persistRun(input.cwd, report, config.report.maxLogLines);
      throw new Error(`Worktree sync failed: ${syncEvidence.stderr || "unknown error"}`);
    }
  }

  report.commands.push(
    await execEvidence({
      sandbox,
      name: "repro",
      command: input.command,
      cwd: "repo",
      timeoutSeconds: config.commandTimeoutSeconds,
      secret: null,
    }),
  );
  report.finishedAt = new Date().toISOString();
  return await persistRun(input.cwd, report, config.report.maxLogLines);
}

export async function syncRepro(input: {
  cwd: string;
  runId: string;
  sandboxProvider: SandboxProvider;
  includeUntracked?: boolean | undefined;
}): Promise<RunReport> {
  const report = await requireReadyRun(input.cwd, input.runId);
  const config = (await readLocalConfig(input.cwd)) ?? defaultRelunarConfig;
  const sandbox = await resumeAndTouch(input.sandboxProvider, report, config);
  report.commands.push(await recordSync(input.cwd, sandbox, config, input.includeUntracked));
  report.finishedAt = new Date().toISOString();
  return await persistRun(input.cwd, report, config.report.maxLogLines);
}

export async function uploadReproFile(input: { cwd: string; runId: string; localPath: string; remotePath: string; sandboxProvider: SandboxProvider }): Promise<RunReport> {
  const report = await requireReadyRun(input.cwd, input.runId);
  const config = (await readLocalConfig(input.cwd)) ?? defaultRelunarConfig;
  const sandbox = await resumeAndTouch(input.sandboxProvider, report, config);
  const started = Date.now();
  await sandbox.upload(input.localPath, input.remotePath);
  report.commands.push({
    name: "repro_upload",
    command: `upload ${input.localPath} ${input.remotePath}`,
    status: "passed",
    exitCode: 0,
    durationMs: Date.now() - started,
    stdout: "",
    stderr: "",
  });
  report.finishedAt = new Date().toISOString();
  return await persistRun(input.cwd, report, config.report.maxLogLines);
}

export type FinishNarrative = {
  summary: string;
  reproSteps?: string | undefined;
  observed?: string | undefined;
  expected?: string | undefined;
  environmentNotes?: string | undefined;
};

export async function finishRepro(
  input: {
    cwd: string;
    runId: string;
    outcome: ReproOutcome;
    sandboxProvider: SandboxProvider;
    skipEvidenceGates?: boolean | undefined;
  } & FinishNarrative,
): Promise<RunReport> {
  const report = await requireReadyRun(input.cwd, input.runId);
  const summary = input.summary.trim();
  if (!summary) {
    throw new Error("Cannot finish repro without a summary.");
  }
  const config = (await readLocalConfig(input.cwd)) ?? defaultRelunarConfig;
  const sandbox = await resumeAndTouch(input.sandboxProvider, report, config);

  await assertEvidenceGates(report, input.outcome, config, {
    skip: input.skipEvidenceGates === true,
    sandbox,
    timeoutSeconds: config.commandTimeoutSeconds,
  });

  await sandbox.dispose();

  report.status = input.outcome;
  report.summary = summary;
  report.reproSteps = optionalText(input.reproSteps);
  report.observed = optionalText(input.observed);
  report.expected = optionalText(input.expected);
  report.environmentNotes = optionalText(input.environmentNotes);
  report.failure = input.outcome === "blocked" ? summary : null;
  report.finishedAt = new Date().toISOString();
  return await persistRun(input.cwd, report, config.report.maxLogLines);
}

function optionalText(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export async function abortRepro(input: { cwd: string; runId: string; sandboxProvider: SandboxProvider }): Promise<RunReport> {
  const report = await requireReadyRun(input.cwd, input.runId);
  const config = (await readLocalConfig(input.cwd)) ?? defaultRelunarConfig;
  const sandbox = await resumeAndTouch(input.sandboxProvider, report, config);
  await sandbox.dispose();
  report.status = "aborted";
  report.finishedAt = new Date().toISOString();
  return await persistRun(input.cwd, report, config.report.maxLogLines);
}

async function requireReadyRun(cwd: string, runId: string): Promise<RunReport> {
  const report = await readRun(cwd, runId);
  if (report.status !== "environment_ready") {
    throw new Error(`Run ${runId} is ${report.status}; expected environment_ready.`);
  }
  return report;
}

function requireSandboxId(report: RunReport): string {
  if (!report.sandbox.id) {
    throw new Error(`Run ${report.runId} has no sandbox id.`);
  }
  return report.sandbox.id;
}

async function resumeAndTouch(provider: SandboxProvider, report: RunReport, config: RelunarConfig): Promise<SandboxSession> {
  const sandbox = await provider.resumeSandbox(requireSandboxId(report));
  const minutes = resolveAutoStopMinutes(config);
  if (sandbox.touchIdle) {
    await sandbox.touchIdle(minutes);
  }
  return sandbox;
}

async function recordSync(
  cwd: string,
  sandbox: SandboxSession,
  config: RelunarConfig,
  includeUntrackedOverride?: boolean,
): Promise<CommandEvidence> {
  const started = Date.now();
  const includeUntracked = includeUntrackedOverride ?? config.sync?.includeUntracked ?? false;
  try {
    const result = await syncWorktree({
      cwd,
      sandbox,
      includeUntracked,
      exclude: config.sync?.exclude ?? [],
      timeoutSeconds: config.commandTimeoutSeconds,
    });
    return {
      name: "repro_sync",
      command: `sync worktree (${result.fileCount} files, ${result.deletedCount} deleted)`,
      status: "passed",
      exitCode: 0,
      durationMs: Date.now() - started,
      stdout: `synced ${result.fileCount} files, removed ${result.deletedCount} (${result.archiveBytes} bytes)`,
      stderr: "",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      name: "repro_sync",
      command: "sync worktree",
      status: "failed",
      exitCode: 1,
      durationMs: Date.now() - started,
      stdout: "",
      stderr: message,
    };
  }
}

async function execEvidence(input: {
  sandbox: SandboxSession;
  name: string;
  command: string;
  cwd: string;
  timeoutSeconds: number;
  env?: Record<string, string>;
  secret: string | null;
}): Promise<CommandEvidence> {
  const started = Date.now();
  const result = await input.sandbox.run(input.command, input.cwd, input.timeoutSeconds, input.env);
  const durationMs = Date.now() - started;
  const status = result.timedOut ? "timed_out" : result.exitCode === 0 ? "passed" : "failed";

  return {
    name: input.name,
    command: redactSecret(input.command, input.secret),
    status,
    exitCode: result.exitCode,
    durationMs,
    stdout: redactSecret(result.stdout, input.secret),
    stderr: redactSecret(result.stderr, input.secret),
  };
}

async function finish(
  input: ReproInput,
  startedAt: string,
  runId: string,
  status: RunReport["status"],
  commands: CommandEvidence[],
  commit: string | null,
  sandbox: SandboxSession | null,
  failure: string | null,
  config: RelunarConfig,
): Promise<RunReport> {
  const report = withAgentNextStep({
    runId,
    status,
    issue: {
      number: input.issue.number,
      title: input.issue.title,
      body: input.issue.body,
      state: input.issue.state,
      url: input.issue.url,
    },
    repo: input.repo,
    commit,
    sandbox: {
      provider: "daytona",
      id: sandbox?.id ?? null,
      target: sandbox?.target ?? null,
    },
    commands,
    failure,
    summary: null,
    reproSteps: null,
    observed: null,
    expected: null,
    environmentNotes: null,
    nextStep: "",
    startedAt,
    finishedAt: new Date().toISOString(),
  });

  await writeRun(input.cwd, report, config.report.maxLogLines);
  return report;
}

async function persistRun(cwd: string, report: RunReport, maxLogLines: number): Promise<RunReport> {
  const next = withAgentNextStep(report);
  await writeRun(cwd, next, maxLogLines);
  return next;
}

function lastFailed(commands: CommandEvidence[]): boolean {
  const last = commands.at(-1);
  return last?.status === "failed" || last?.status === "timed_out";
}

async function readLocalConfig(cwd: string): Promise<RelunarConfig | null> {
  try {
    return parseRelunarConfig(await readFile(join(cwd, ".relunar.yml"), "utf8"));
  } catch (error) {
    if (isNotFound(error)) {
      return null;
    }
    throw error;
  }
}

function isNotFound(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}
