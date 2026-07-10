import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseRelunarConfig, defaultRelunarConfig } from "./config";
import { redactSecret } from "./reports";
import { createRunId, readRun, writeRun } from "./runs";
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

export async function execRepro(input: { cwd: string; runId: string; command: string; sandboxProvider: SandboxProvider }): Promise<RunReport> {
  const report = await requireReadyRun(input.cwd, input.runId);
  const config = (await readLocalConfig(input.cwd)) ?? defaultRelunarConfig;
  const sandbox = await input.sandboxProvider.resumeSandbox(requireSandboxId(report));
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
  await writeRun(input.cwd, report, config.report.maxLogLines);
  return report;
}

export async function uploadReproFile(input: { cwd: string; runId: string; localPath: string; remotePath: string; sandboxProvider: SandboxProvider }): Promise<RunReport> {
  const report = await requireReadyRun(input.cwd, input.runId);
  const config = (await readLocalConfig(input.cwd)) ?? defaultRelunarConfig;
  const sandbox = await input.sandboxProvider.resumeSandbox(requireSandboxId(report));
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
  await writeRun(input.cwd, report, config.report.maxLogLines);
  return report;
}

export async function finishRepro(input: { cwd: string; runId: string; outcome: ReproOutcome; summary: string; sandboxProvider: SandboxProvider }): Promise<RunReport> {
  const report = await requireReadyRun(input.cwd, input.runId);
  if (!report.commands.some((command) => command.name === "repro")) {
    throw new Error("Cannot finish repro without issue-specific command evidence.");
  }
  const summary = input.summary.trim();
  if (!summary) {
    throw new Error("Cannot finish repro without a summary.");
  }
  const config = (await readLocalConfig(input.cwd)) ?? defaultRelunarConfig;
  const sandbox = await input.sandboxProvider.resumeSandbox(requireSandboxId(report));
  await sandbox.dispose();
  report.status = input.outcome;
  report.summary = summary;
  report.failure = input.outcome === "blocked" ? summary : null;
  report.finishedAt = new Date().toISOString();
  await writeRun(input.cwd, report, config.report.maxLogLines);
  return report;
}

export async function abortRepro(input: { cwd: string; runId: string; sandboxProvider: SandboxProvider }): Promise<RunReport> {
  const report = await requireReadyRun(input.cwd, input.runId);
  const config = (await readLocalConfig(input.cwd)) ?? defaultRelunarConfig;
  const sandbox = await input.sandboxProvider.resumeSandbox(requireSandboxId(report));
  await sandbox.dispose();
  report.status = "aborted";
  report.finishedAt = new Date().toISOString();
  await writeRun(input.cwd, report, config.report.maxLogLines);
  return report;
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
  const report: RunReport = {
    runId,
    status,
    issue: {
      number: input.issue.number,
      title: input.issue.title,
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
    startedAt,
    finishedAt: new Date().toISOString(),
  };

  await writeRun(input.cwd, report, config.report.maxLogLines);
  return report;
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
