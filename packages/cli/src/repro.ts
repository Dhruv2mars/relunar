import { parseRelunarConfig, defaultRelunarConfig } from "./config";
import { redactSecret } from "./reports";
import { createRunId, writeRun } from "./runs";
import type { CommandEvidence, Issue, RelunarConfig, RepoSlug, RunReport, SandboxProvider, SandboxSession } from "./types";

export type ReproInput = {
  cwd: string;
  repo: RepoSlug;
  issue: Issue;
  githubToken: string;
  sandboxProvider: SandboxProvider;
  commandTimeoutSeconds?: number;
};

export async function runRepro(input: ReproInput): Promise<RunReport> {
  const runId = createRunId(input.issue.number);
  const startedAt = new Date().toISOString();
  const commandTimeoutSeconds = input.commandTimeoutSeconds ?? 300;
  const commands: CommandEvidence[] = [];
  let sandbox: SandboxSession | null = null;
  let commit: string | null = null;
  let config: RelunarConfig = defaultRelunarConfig;

  try {
    sandbox = await input.sandboxProvider.createSandbox({ runId });

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

    const configResult = await sandbox.run("test -f .relunar.yml && cat .relunar.yml || true", "repo", commandTimeoutSeconds);
    if (configResult.stdout.trim().length > 0) {
      config = parseRelunarConfig(configResult.stdout);
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

    return await finish(input, startedAt, runId, "passed", commands, commit, sandbox, null, config);
  } catch (error) {
    const failure = error instanceof Error ? error.message : String(error);
    return await finish(input, startedAt, runId, "blocked", commands, commit, sandbox, failure, config);
  } finally {
    if (sandbox) {
      await sandbox.dispose();
    }
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
