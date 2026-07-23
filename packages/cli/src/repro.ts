import { readFile, writeFile } from "node:fs/promises";
import { join, posix } from "node:path";
import { collectArtifacts } from "./artifacts";
import { parseRelunarConfig, defaultRelunarConfig, resolveAutoStopMinutes } from "./config";
import { assertEvidenceGates } from "./evidence";
import { detectSandboxImage } from "./detection";
import { prepareTerminalEnvironment, resolveCommandEnv, resolveCommandSecrets, resolveWorkdir, startTerminalServices } from "./environment";
import { executeProbe } from "./probe";
import { redactSecret, withAgentNextStep } from "./reports";
import { createRunId, readRun, runStoreDir, withRunLock, writeRun } from "./runs";
import { syncWorktree } from "./sync";
import type { CommandEvidence, Issue, ProbeExpectations, RelunarConfig, RepoSlug, ReproOutcome, RunReport, SandboxProvider, SandboxSession } from "./types";

export type ReproInput = {
  cwd: string;
  repo: RepoSlug;
  issue: Issue;
  githubToken: string;
  sandboxProvider: SandboxProvider;
  commandTimeoutSeconds?: number;
  hostEnv?: NodeJS.ProcessEnv | undefined;
  repositoryConfig?: RelunarConfig | null | undefined;
};

export class SandboxUnavailableError extends Error {
  override readonly name = "SandboxUnavailableError";

  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
  }
}

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
  let workdir = "repo";
  let commandEnv: Record<string, string> = {};
  let environment: RunReport["environment"];
  let sandboxImage: string | undefined;

  try {
    const localConfig = await readLocalConfig(input.cwd);
    const hasLocalConfig = localConfig !== null;
    const preflightConfig = localConfig ?? input.repositoryConfig;
    if (preflightConfig) {
      config = preflightConfig;
      commandTimeoutSeconds = input.commandTimeoutSeconds ?? config.commandTimeoutSeconds;
    }
    sandboxImage = config.sandbox?.snapshot
      ? undefined
      : config.sandbox?.image ?? await detectSandboxImage(input.cwd);
    sandbox = await input.sandboxProvider.createSandbox({
      runId,
      image: sandboxImage,
      snapshot: config.sandbox?.snapshot,
      resources: config.sandbox?.resources,
      autoStopMinutes: resolveAutoStopMinutes(config),
      timeoutSeconds: commandTimeoutSeconds,
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
      return await finish(input, startedAt, runId, "setup_failed", commands, commit, sandbox, "Repository clone failed", config, environment, sandboxImage);
    }

    const commitResult = await sandbox.run("git rev-parse HEAD", "repo", commandTimeoutSeconds);
    commit = commitResult.exitCode === 0 ? commitResult.stdout.trim() : null;

    if (!hasLocalConfig && !input.repositoryConfig) {
      const configResult = await sandbox.run("test -f .relunar.yml && cat .relunar.yml || true", "repo", commandTimeoutSeconds);
      if (configResult.stdout.trim().length > 0) {
        config = parseRelunarConfig(configResult.stdout);
        commandTimeoutSeconds = input.commandTimeoutSeconds ?? config.commandTimeoutSeconds;
      }
    }
    const prepared = await prepareTerminalEnvironment({
      sandbox,
      config,
      hostEnv: input.hostEnv ?? process.env,
      timeoutSeconds: commandTimeoutSeconds,
    });
    workdir = prepared.workdir;
    commandEnv = prepared.commandEnv;
    const commandSecrets = resolveCommandSecrets(config, commandEnv);
    environment = prepared.fingerprint;
    commands.push(...prepared.commands);
    const preparedCommit = await sandbox.run("git rev-parse HEAD", "repo", commandTimeoutSeconds);
    commit = preparedCommit.exitCode === 0 ? preparedCommit.stdout.trim() : commit;

    for (const command of config.setup) {
      commands.push(
        await execEvidence({
          sandbox,
          name: "setup",
          command,
          cwd: workdir,
          timeoutSeconds: commandTimeoutSeconds,
          secret: input.githubToken,
          env: commandEnv,
          secrets: commandSecrets,
        }),
      );
      if (lastFailed(commands)) {
        return await finish(input, startedAt, runId, "setup_failed", commands, commit, sandbox, `${command} failed`, config, environment, sandboxImage);
      }
    }

    const services = await startTerminalServices({
      sandbox,
      config,
      commandEnv,
      workdir,
      timeoutSeconds: commandTimeoutSeconds,
    });
    commands.push(...services.commands);
    if (services.failure) {
      return await finish(input, startedAt, runId, "setup_failed", commands, commit, sandbox, services.failure, config, environment, sandboxImage);
    }

    for (const command of config.baseline) {
      commands.push(
        await execEvidence({
          sandbox,
          name: "baseline",
          command,
          cwd: workdir,
          timeoutSeconds: commandTimeoutSeconds,
          secret: input.githubToken,
          env: commandEnv,
          secrets: commandSecrets,
        }),
      );
      if (lastFailed(commands)) {
        return await finish(input, startedAt, runId, "baseline_failed", commands, commit, sandbox, `${command} failed`, config, environment, sandboxImage);
      }
    }

    const report = await finish(input, startedAt, runId, disposeOnReady ? "passed" : "environment_ready", commands, commit, sandbox, null, config, environment, sandboxImage);
    if (!disposeOnReady) {
      keepSandbox = true;
    }
    return report;
  } catch (error) {
    const failure = error instanceof Error ? error.message : String(error);
    return await finish(input, startedAt, runId, "blocked", commands, commit, sandbox, failure, config, environment, sandboxImage);
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
  expectations?: ProbeExpectations | undefined;
  repeat?: number | undefined;
  hostEnv?: NodeJS.ProcessEnv | undefined;
  resetCommand?: string | undefined;
  control?: { command: string; expectations: ProbeExpectations } | undefined;
  claim?: string | undefined;
};

export async function execRepro(input: ExecReproInput): Promise<RunReport> {
  return withRunLock(input.cwd, input.runId, () => execReproUnlocked(input));
}

async function execReproUnlocked(input: ExecReproInput): Promise<RunReport> {
  const report = await requireReadyRun(input.cwd, input.runId);
  const config = await configForRun(input.cwd, report);
  const sandbox = await resumeAndTouch(input.cwd, input.sandboxProvider, report, config);
  const workdir = resolveWorkdir(config.workspace?.workdir);
  const commandEnv = resolveCommandEnv(config, input.hostEnv ?? process.env);
  const commandSecrets = resolveCommandSecrets(config, commandEnv);

  const shouldSync = input.sync === true || config.sync?.onExec === true;
  if (shouldSync) {
    const syncEvidence = await recordSync(input.cwd, report.runId, sandbox, config, input.includeUntracked);
    report.commands.push(syncEvidence);
    if (syncEvidence.status === "failed") {
      report.finishedAt = new Date().toISOString();
      await persistRun(input.cwd, report, config.report.maxLogLines);
      throw new Error(`Worktree sync failed: ${syncEvidence.stderr || "unknown error"}`);
    }
  }

  const evidenceId = nextEvidenceId(report);
  report.commands.push(
    ...(await executeProbe({
      sandbox,
      command: input.command,
      cwd: workdir,
      timeoutSeconds: config.commandTimeoutSeconds,
      expectations: input.expectations ?? {},
      repeat: input.repeat,
      env: commandEnv,
      secrets: commandSecrets,
      resetCommand: input.resetCommand,
      control: input.control,
      evidenceId,
      claim: input.claim?.trim(),
    })),
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
  return withRunLock(input.cwd, input.runId, () => syncReproUnlocked(input));
}

async function syncReproUnlocked(input: {
  cwd: string;
  runId: string;
  sandboxProvider: SandboxProvider;
  includeUntracked?: boolean | undefined;
}): Promise<RunReport> {
  const report = await requireReadyRun(input.cwd, input.runId);
  const config = await configForRun(input.cwd, report);
  const sandbox = await resumeAndTouch(input.cwd, input.sandboxProvider, report, config);
  const syncEvidence = await recordSync(input.cwd, report.runId, sandbox, config, input.includeUntracked);
  report.commands.push(syncEvidence);
  report.finishedAt = new Date().toISOString();
  const persisted = await persistRun(input.cwd, report, config.report.maxLogLines);
  if (syncEvidence.status === "failed") {
    throw new Error(`Worktree sync failed: ${syncEvidence.stderr || "unknown error"}`);
  }
  return persisted;
}

export async function uploadReproFile(input: { cwd: string; runId: string; localPath: string; remotePath: string; sandboxProvider: SandboxProvider }): Promise<RunReport> {
  return withRunLock(input.cwd, input.runId, () => uploadReproFileUnlocked(input));
}

async function uploadReproFileUnlocked(input: { cwd: string; runId: string; localPath: string; remotePath: string; sandboxProvider: SandboxProvider }): Promise<RunReport> {
  const report = await requireReadyRun(input.cwd, input.runId);
  const config = await configForRun(input.cwd, report);
  const sandbox = await resumeAndTouch(input.cwd, input.sandboxProvider, report, config);
  const remotePath = resolveRemoteUploadPath(resolveWorkdir(config.workspace?.workdir), input.remotePath);
  const started = Date.now();
  await sandbox.upload(input.localPath, remotePath);
  report.commands.push({
    name: "repro_upload",
    command: `upload ${input.localPath} ${remotePath}`,
    status: "passed",
    exitCode: 0,
    durationMs: Date.now() - started,
    stdout: "",
    stderr: "",
  });
  report.finishedAt = new Date().toISOString();
  return await persistRun(input.cwd, report, config.report.maxLogLines);
}

export function resolveRemoteUploadPath(workdir: string, remotePath: string): string {
  if (!remotePath || posix.isAbsolute(remotePath) || remotePath.split("/").includes("..")) {
    throw new Error(`Unsafe remote upload path: ${remotePath}`);
  }
  return posix.join(workdir, remotePath);
}

export type FinishNarrative = {
  summary: string;
  reproSteps?: string | undefined;
  observed?: string | undefined;
  expected?: string | undefined;
  environmentNotes?: string | undefined;
  evidenceIds?: string[] | undefined;
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
  return withRunLock(input.cwd, input.runId, () => finishReproUnlocked(input));
}

async function finishReproUnlocked(
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
  const config = await configForRun(input.cwd, report);
  const sandbox = await resumeAndTouch(input.cwd, input.sandboxProvider, report, config);

  if (input.outcome !== "blocked" && !input.evidenceIds?.length) {
    throw new Error("A conclusive outcome requires explicit --evidence selection.");
  }

  await assertEvidenceGates(report, input.outcome, config, {
    skip: input.skipEvidenceGates === true,
    sandbox,
    timeoutSeconds: config.commandTimeoutSeconds,
    evidenceIds: input.evidenceIds,
  });
  if (
    input.outcome !== "blocked" &&
    (![input.reproSteps, input.observed, input.expected, input.environmentNotes].every((value) => value?.trim()))
  ) {
    throw new Error("A conclusive outcome requires --repro-steps, --observed, --expected, and --environment.");
  }
  report.artifacts = await collectArtifacts({
    cwd: input.cwd,
    runId: report.runId,
    sandbox,
    patterns: config.artifacts?.collect ?? [],
    timeoutSeconds: config.commandTimeoutSeconds,
  });

  report.status = input.outcome;
  report.trust = input.skipEvidenceGates === true || input.outcome === "blocked" ? "unverified" : "verified";
  report.selectedEvidenceIds = input.evidenceIds;
  report.summary = summary;
  report.reproSteps = optionalText(input.reproSteps);
  report.observed = optionalText(input.observed);
  report.expected = optionalText(input.expected);
  report.environmentNotes = optionalText(input.environmentNotes);
  report.failure = input.outcome === "blocked" ? summary : null;
  report.cleanup = {
    status: "pending",
    error: null,
    updatedAt: new Date().toISOString(),
  };
  report.finishedAt = new Date().toISOString();
  return await persistRun(input.cwd, report, config.report.maxLogLines);
}

function nextEvidenceId(report: RunReport): string {
  const ids = new Set(report.commands.flatMap((command) => command.evidenceId ? [command.evidenceId] : []));
  let index = ids.size + 1;
  while (ids.has(`probe-${index}`)) index += 1;
  return `probe-${index}`;
}

export async function cleanupRepro(input: {
  cwd: string;
  runId: string;
  sandboxProvider: SandboxProvider;
}): Promise<RunReport> {
  return withRunLock(input.cwd, input.runId, () => cleanupReproUnlocked(input));
}

async function cleanupReproUnlocked(input: {
  cwd: string;
  runId: string;
  sandboxProvider: SandboxProvider;
}): Promise<RunReport> {
  const report = await readRun(input.cwd, input.runId);
  if (report.cleanup?.status === "completed") return report;
  const config = await configForRun(input.cwd, report);
  report.cleanup = { status: "pending", error: null, updatedAt: new Date().toISOString() };
  try {
    await persistRun(input.cwd, report, config.report.maxLogLines);
  } catch {
    // Local bookkeeping failure must not prevent disposal of the remote sandbox.
  }
  try {
    const sandbox = await input.sandboxProvider.resumeSandbox(requireSandboxId(report));
    try {
      const commandEnv = resolveCommandEnv(config, process.env);
      const workdir = resolveWorkdir(config.workspace?.workdir);
      for (const service of [...(config.services ?? [])].reverse()) {
        if (!service.stop) continue;
        try {
          await sandbox.run(service.stop, workdir, config.commandTimeoutSeconds, commandEnv);
        } catch {
          // Disposal is the cleanup guarantee; a best-effort service stop must not leak the sandbox.
        }
      }
    } catch {
      // Passthrough variables can disappear after a run. Disposal does not depend on command environment.
    }
    await sandbox.dispose();
    report.cleanup = { status: "completed", error: null, updatedAt: new Date().toISOString() };
    return await persistRun(input.cwd, report, config.report.maxLogLines);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (isMissingSandboxError(error)) {
      report.cleanup = { status: "completed", error: null, updatedAt: new Date().toISOString() };
      return await persistRun(input.cwd, report, config.report.maxLogLines);
    }
    report.cleanup = { status: "failed", error: message, updatedAt: new Date().toISOString() };
    await persistRun(input.cwd, report, config.report.maxLogLines);
    throw error;
  }
}

function optionalText(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export async function abortRepro(input: { cwd: string; runId: string; sandboxProvider: SandboxProvider }): Promise<RunReport> {
  return withRunLock(input.cwd, input.runId, () => abortReproUnlocked(input));
}

async function abortReproUnlocked(input: { cwd: string; runId: string; sandboxProvider: SandboxProvider }): Promise<RunReport> {
  const report = await requireReadyRun(input.cwd, input.runId);
  const config = await configForRun(input.cwd, report);
  try {
    const sandbox = await resumeAndTouch(input.cwd, input.sandboxProvider, report, config);
    await sandbox.dispose();
  } catch {
    // Sandbox already gone; resumeAndTouch marks the run aborted when possible.
    if (report.status === "aborted") {
      return report;
    }
  }
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

async function resumeAndTouch(
  cwd: string,
  provider: SandboxProvider,
  report: RunReport,
  config: RelunarConfig,
): Promise<SandboxSession> {
  try {
    const sandbox = await provider.resumeSandbox(requireSandboxId(report));
    const minutes = resolveAutoStopMinutes(config);
    if (sandbox.touchIdle) {
      await sandbox.touchIdle(minutes);
    }
    return sandbox;
  } catch (error) {
    if (!isMissingSandboxError(error)) throw error;
    const message = error instanceof Error ? error.message : String(error);
    // Mark only definitively missing sandboxes inactive; transient provider failures remain retryable.
    if (report.status === "environment_ready") {
      report.status = "aborted";
      report.failure = message;
      report.finishedAt = new Date().toISOString();
      await persistRun(cwd, report, config.report.maxLogLines);
    }
    throw new SandboxUnavailableError(message, { cause: error });
  }
}

function isMissingSandboxError(error: unknown): boolean {
  const message = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  return /(?:^|\b)(?:404|not found|deleted|disposed|does not exist)(?:\b|$)/i.test(message);
}

async function recordSync(
  cwd: string,
  runId: string,
  sandbox: SandboxSession,
  config: RelunarConfig,
  includeUntrackedOverride?: boolean,
): Promise<CommandEvidence> {
  const started = Date.now();
  const includeUntracked = includeUntrackedOverride ?? config.sync?.includeUntracked ?? false;
  const manifestPath = join(runStoreDir(cwd), runId, "sync-manifest.json");
  try {
    const previouslySyncedPaths = await readSyncManifest(manifestPath);
    const result = await syncWorktree({
      cwd,
      sandbox,
      includeUntracked,
      exclude: config.sync?.exclude ?? [],
      timeoutSeconds: config.commandTimeoutSeconds,
      previouslySyncedPaths,
    });
    await writeSyncManifest(manifestPath, result.syncedPaths);
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

async function readSyncManifest(path: string): Promise<string[]> {
  try {
    const raw = JSON.parse(await readFile(path, "utf8")) as { paths?: unknown };
    return Array.isArray(raw.paths) ? raw.paths.filter((path): path is string => typeof path === "string") : [];
  } catch (error) {
    if (isNotFound(error)) {
      return [];
    }
    throw error;
  }
}

async function writeSyncManifest(path: string, paths: string[]): Promise<void> {
  await writeFile(path, `${JSON.stringify({ paths }, null, 2)}\n`, "utf8");
}

async function execEvidence(input: {
  sandbox: SandboxSession;
  name: string;
  command: string;
  cwd: string;
  timeoutSeconds: number;
  env?: Record<string, string>;
  secret: string | null;
  secrets?: string[] | undefined;
}): Promise<CommandEvidence> {
  const startedAt = new Date().toISOString();
  const started = Date.now();
  const result = await input.sandbox.run(input.command, input.cwd, input.timeoutSeconds, input.env);
  const durationMs = Date.now() - started;
  const status = result.timedOut ? "timed_out" : result.exitCode === 0 ? "passed" : "failed";

  return {
    name: input.name,
    command: redactMany(redactSecret(input.command, input.secret), input.secrets ?? []),
    status,
    exitCode: result.exitCode,
    durationMs,
    stdout: redactMany(redactSecret(result.stdout, input.secret), input.secrets ?? []),
    stderr: redactMany(redactSecret(result.stderr, input.secret), input.secrets ?? []),
    cwd: input.cwd,
    envNames: Object.keys(input.env ?? {}).sort(),
    startedAt,
    finishedAt: new Date().toISOString(),
  };
}

function redactMany(value: string, secrets: string[]): string {
  return secrets.filter(Boolean).reduce((current, secret) => current.split(secret).join("[redacted]"), value);
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
  environment?: RunReport["environment"],
  sandboxImage?: string,
): Promise<RunReport> {
  const report = withAgentNextStep({
    schemaVersion: 2,
    runId,
    status,
    issue: {
      number: input.issue.number,
      title: input.issue.title,
      body: input.issue.body,
      state: input.issue.state,
      url: input.issue.url,
      labels: input.issue.labels,
      comments: input.issue.comments,
      attachments: input.issue.attachments,
    },
    repo: input.repo,
    effectiveConfig: config,
    commit,
    sandbox: {
      provider: "daytona",
      id: sandbox?.id ?? null,
      target: sandbox?.target ?? null,
      image: sandboxImage ?? null,
    },
    commands,
    failure,
    summary: null,
    reproSteps: null,
    observed: null,
    expected: null,
    environmentNotes: null,
    trust: "unverified",
    artifacts: [],
    environment,
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

async function configForRun(cwd: string, report: RunReport): Promise<RelunarConfig> {
  return report.effectiveConfig ?? (await readLocalConfig(cwd)) ?? defaultRelunarConfig;
}

function isNotFound(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}
