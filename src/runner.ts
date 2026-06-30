import { classifyCommandRuns } from "./domain/classify";
import { renderBaselineComment, hashCommentBody } from "./domain/comment";
import { buildCommand, detectPackageManager, testCommand } from "./domain/package-manager";
import { detectRunnableScripts } from "./domain/scripts";
import type { CommandPhase, CommandRun, ErrorCategory, FinishJobInput, JobBundle } from "./domain/types";
import type { Logger } from "./logger";
import type { SandboxProvider, SandboxSession } from "./sandbox/types";
import type { RelunarStore } from "./store";
import { shellQuote } from "./util/shell";
import { excerpt } from "./util/text";

export type BaselineRunnerOptions = {
  commandTimeoutSeconds: number;
  jobTimeoutSeconds: number;
};

export type BaselineRunResult = {
  finish: FinishJobInput;
  commentBody: string;
  commentBodyHash: string;
};

export async function runBaselineJob(input: {
  bundle: JobBundle;
  store: RelunarStore;
  sandboxProvider: SandboxProvider;
  logger: Logger;
  options: BaselineRunnerOptions;
}): Promise<BaselineRunResult> {
  const startedAt = Date.now();
  const sandbox = await input.sandboxProvider.createSandbox({ jobId: input.bundle.job.id });
  await input.store.markJobRunning(input.bundle.job.id, {
    sandboxId: sandbox.id,
    sandboxTarget: sandbox.target,
  });

  const commandRecorder = new CommandRecorder(input.store, input.bundle.job.id, sandbox, input.options.commandTimeoutSeconds);
  let commitSha: string | null = null;
  let packageManager = input.bundle.job.packageManager;
  let finish: FinishJobInput | null = null;

  try {
    const cloneCommand = buildCloneCommand(input.bundle.repository.cloneUrl, input.bundle.repository.defaultBranch);
    const cloneRun = await commandRecorder.run("clone", cloneCommand, undefined);
    if (cloneRun.exitCode !== 0 || cloneRun.timedOut) {
      finish = {
        result: "blocked",
        errorCategory: cloneRun.timedOut ? "command_timeout" : "clone_error",
        errorMessage: "Repository could not be cloned in the sandbox.",
        sandboxId: sandbox.id,
        sandboxTarget: sandbox.target,
      };
      return await finalize(input, finish);
    }

    const commitRun = await commandRecorder.run("inspect", "git rev-parse HEAD", "repo");
    if (commitRun.exitCode === 0 && commitRun.stdoutExcerpt.trim()) {
      commitSha = commitRun.stdoutExcerpt.trim().split(/\s+/)[0] ?? null;
    }

    const fileRun = await commandRecorder.run(
      "inspect",
      "for f in bun.lockb bun.lock pnpm-lock.yaml yarn.lock package-lock.json package.json; do test -f \"$f\" && echo \"$f\"; done",
      "repo",
    );
    if (fileRun.exitCode !== 0 || fileRun.timedOut) {
      finish = {
        result: "blocked",
        errorCategory: fileRun.timedOut ? "command_timeout" : "package_detection_error",
        errorMessage: "Relunar could not inspect repository package files.",
        sandboxId: sandbox.id,
        sandboxTarget: sandbox.target,
        commitSha,
      };
      return await finalize(input, finish);
    }

    const files = fileRun.stdoutExcerpt.split("\n").map((line) => line.trim()).filter(Boolean);
    const detection = detectPackageManager(files);
    if (!detection) {
      finish = {
        result: "blocked",
        errorCategory: "package_detection_error",
        errorMessage: "No supported JavaScript or TypeScript package shape was detected.",
        sandboxId: sandbox.id,
        sandboxTarget: sandbox.target,
        commitSha,
      };
      return await finalize(input, finish);
    }
    packageManager = detection.packageManager;

    const installRun = await commandRecorder.run("install", detection.installCommand, "repo");
    if (installRun.exitCode !== 0 || installRun.timedOut) {
      const classification = classifyCommandRuns(await input.store.listCommandRuns(input.bundle.job.id));
      finish = {
        ...classification,
        sandboxId: sandbox.id,
        sandboxTarget: sandbox.target,
        commitSha,
        packageManager,
      };
      return await finalize(input, finish);
    }

    const packageJsonRun = await commandRecorder.run("inspect", "cat package.json", "repo");
    let scripts = { hasBuild: false, hasTest: false };
    if (packageJsonRun.exitCode === 0 && !packageJsonRun.timedOut) {
      scripts = detectRunnableScripts(packageJsonRun.stdoutExcerpt);
    }

    if (scripts.hasBuild) {
      const run = await commandRecorder.run("build", buildCommand(packageManager), "repo");
      if (run.exitCode !== 0 || run.timedOut) {
        const classification = classifyCommandRuns(await input.store.listCommandRuns(input.bundle.job.id));
        finish = {
          ...classification,
          sandboxId: sandbox.id,
          sandboxTarget: sandbox.target,
          commitSha,
          packageManager,
        };
        return await finalize(input, finish);
      }
    }

    if (scripts.hasTest) {
      const run = await commandRecorder.run("test", testCommand(packageManager), "repo");
      if (run.exitCode !== 0 || run.timedOut) {
        const classification = classifyCommandRuns(await input.store.listCommandRuns(input.bundle.job.id));
        finish = {
          ...classification,
          sandboxId: sandbox.id,
          sandboxTarget: sandbox.target,
          commitSha,
          packageManager,
        };
        return await finalize(input, finish);
      }
    }

    const classification = classifyCommandRuns(await input.store.listCommandRuns(input.bundle.job.id));
    finish = {
      ...classification,
      sandboxId: sandbox.id,
      sandboxTarget: sandbox.target,
      commitSha,
      packageManager,
    };
    return await finalize(input, finish);
  } finally {
    const durationMs = Date.now() - startedAt;
    input.logger.info(
      {
        jobId: input.bundle.job.id,
        repository: input.bundle.repository.fullName,
        issueNumber: input.bundle.issue.number,
        sandboxId: sandbox.id,
        durationMs,
      },
      "baseline job run finished",
    );
    await sandbox.dispose();
  }
}

class CommandRecorder {
  private sequence = 0;

  constructor(
    private readonly store: RelunarStore,
    private readonly jobId: string,
    private readonly sandbox: SandboxSession,
    private readonly timeoutSeconds: number,
  ) {}

  async run(phase: CommandPhase, command: string, cwd: string | undefined): Promise<CommandRun> {
    const startedAt = new Date();
    const result = await this.sandbox.run(command, cwd, this.timeoutSeconds);
    const finishedAt = new Date();
    return await this.store.recordCommandRun(this.jobId, {
      sequence: ++this.sequence,
      phase,
      command,
      cwd: cwd ?? ".",
      startedAt,
      finishedAt,
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      exitCode: result.exitCode,
      timedOut: result.timedOut,
      stdoutExcerpt: excerpt(result.stdout),
      stderrExcerpt: excerpt(result.stderr),
    });
  }
}

async function finalize(
  input: {
    bundle: JobBundle;
    store: RelunarStore;
  },
  finish: FinishJobInput,
): Promise<BaselineRunResult> {
  await input.store.finishJob(input.bundle.job.id, finish);
  const commands = await input.store.listCommandRuns(input.bundle.job.id);
  const commentBody = renderBaselineComment({
    result: finish.result,
    repositoryFullName: input.bundle.repository.fullName,
    commitSha: finish.commitSha ?? null,
    packageManager: finish.packageManager ?? null,
    commands,
    sandbox: {
      id: finish.sandboxId ?? null,
      target: finish.sandboxTarget ?? null,
      runtime: "daytona",
    },
    errorMessage: finish.errorMessage ?? null,
  });

  return {
    finish,
    commentBody,
    commentBodyHash: hashCommentBody(commentBody),
  };
}

export function buildCloneCommand(cloneUrl: string, defaultBranch: string): string {
  return `git clone --depth 1 --branch ${shellQuote(defaultBranch)} ${shellQuote(cloneUrl)} repo`;
}

export function errorCategoryFromUnknown(error: unknown): ErrorCategory {
  if (error instanceof Error && /sandbox/i.test(error.message)) {
    return "sandbox_create_error";
  }
  return "queue_error";
}
