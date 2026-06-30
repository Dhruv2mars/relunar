import type { ErrorCategory } from "./domain/types";
import type { GitHubIssueCommenter } from "./github/client";
import type { Logger } from "./logger";
import { runBaselineJob, type BaselineRunnerOptions } from "./runner";
import type { SandboxProvider } from "./sandbox/types";
import type { RelunarStore } from "./store";

export type ProcessReproJobDependencies = {
  store: RelunarStore;
  sandboxProvider: SandboxProvider;
  github: GitHubIssueCommenter;
  logger: Logger;
  runnerOptions: BaselineRunnerOptions;
};

export async function processReproJob(jobId: string, dependencies: ProcessReproJobDependencies): Promise<void> {
  const bundle = await dependencies.store.getJobBundle(jobId);
  if (!bundle) {
    throw new Error(`missing repro job ${jobId}`);
  }

  try {
    const result = await runBaselineJob({
      bundle,
      store: dependencies.store,
      sandboxProvider: dependencies.sandboxProvider,
      logger: dependencies.logger,
      options: dependencies.runnerOptions,
    });

    const comment = await dependencies.github.createIssueComment({
      installationId: bundle.repository.installationId,
      owner: bundle.repository.owner,
      repo: bundle.repository.name,
      issueNumber: bundle.issue.number,
      body: result.commentBody,
    });

    await dependencies.store.recordIssueComment({
      repositoryId: bundle.repository.id,
      issueId: bundle.issue.id,
      jobId: bundle.job.id,
      githubCommentId: comment.id,
      body: result.commentBody,
      bodyHash: result.commentBodyHash,
    });

    dependencies.logger.info(
      {
        jobId,
        repository: bundle.repository.fullName,
        issueNumber: bundle.issue.number,
        commentId: comment.id,
        result: result.finish.result,
      },
      "posted baseline report",
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "unknown worker error";
    const errorCategory = categorizeWorkerError(error);
    await dependencies.store.failJob(jobId, { errorCategory, errorMessage });
    dependencies.logger.error({ jobId, error, errorCategory }, "failed repro job");
    throw error;
  }
}

function categorizeWorkerError(error: unknown): ErrorCategory {
  if (error instanceof Error) {
    if (/github|octokit|comment/i.test(error.message)) {
      return "report_post_error";
    }
    if (/daytona|sandbox/i.test(error.message)) {
      return "sandbox_create_error";
    }
  }

  return "queue_error";
}
