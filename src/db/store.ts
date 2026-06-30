import { and, asc, eq } from "drizzle-orm";
import type { Db } from "./client";
import {
  commandRuns,
  installations,
  issueComments,
  issues,
  repositories,
  reproJobs,
} from "./schema";
import type {
  CommandRun,
  CommandRunInput,
  CreateIssueJobInput,
  FinishJobInput,
  IssueCommentInput,
  JobBundle,
  ReproJob,
} from "../domain/types";
import type { RelunarStore } from "../store";

export class PostgresRelunarStore implements RelunarStore {
  constructor(private readonly db: Db) {}

  async createIssueJob(input: CreateIssueJobInput): Promise<{ jobId: string }> {
    const now = new Date();
    const installation = await this.db
      .insert(installations)
      .values({
        githubInstallationId: input.installation.githubInstallationId,
        accountLogin: input.installation.accountLogin,
        accountType: input.installation.accountType,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: installations.githubInstallationId,
        set: {
          accountLogin: input.installation.accountLogin,
          accountType: input.installation.accountType,
          updatedAt: now,
        },
      })
      .returning();

    const installationRow = installation[0];
    if (!installationRow) {
      throw new Error("installation upsert failed");
    }

    const repository = await this.db
      .insert(repositories)
      .values({
        installationId: installationRow.id,
        githubRepositoryId: input.repository.githubRepositoryId,
        owner: input.repository.owner,
        name: input.repository.name,
        fullName: input.repository.fullName,
        defaultBranch: input.repository.defaultBranch,
        cloneUrl: input.repository.cloneUrl,
        htmlUrl: input.repository.htmlUrl,
        isPrivate: input.repository.isPrivate,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: repositories.githubRepositoryId,
        set: {
          installationId: installationRow.id,
          owner: input.repository.owner,
          name: input.repository.name,
          fullName: input.repository.fullName,
          defaultBranch: input.repository.defaultBranch,
          cloneUrl: input.repository.cloneUrl,
          htmlUrl: input.repository.htmlUrl,
          isPrivate: input.repository.isPrivate,
          updatedAt: now,
        },
      })
      .returning();

    const repositoryRow = repository[0];
    if (!repositoryRow) {
      throw new Error("repository upsert failed");
    }

    const issue = await this.db
      .insert(issues)
      .values({
        repositoryId: repositoryRow.id,
        githubIssueId: input.issue.githubIssueId,
        number: input.issue.number,
        title: input.issue.title,
        body: input.issue.body,
        authorLogin: input.issue.authorLogin,
        state: input.issue.state,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: issues.githubIssueId,
        set: {
          repositoryId: repositoryRow.id,
          number: input.issue.number,
          title: input.issue.title,
          body: input.issue.body,
          authorLogin: input.issue.authorLogin,
          state: input.issue.state,
          updatedAt: now,
        },
      })
      .returning();

    const issueRow = issue[0];
    if (!issueRow) {
      throw new Error("issue upsert failed");
    }

    const job = await this.db
      .insert(reproJobs)
      .values({
        issueId: issueRow.id,
        repositoryId: repositoryRow.id,
        installationId: installationRow.id,
        githubDeliveryId: input.githubDeliveryId,
      })
      .returning({ id: reproJobs.id });

    const jobRow = job[0];
    if (!jobRow) {
      throw new Error("job insert failed");
    }

    return { jobId: jobRow.id };
  }

  async setQueueJobId(jobId: string, queueJobId: string): Promise<void> {
    await this.db
      .update(reproJobs)
      .set({ queueJobId, updatedAt: new Date() })
      .where(eq(reproJobs.id, jobId));
  }

  async getJobBundle(jobId: string): Promise<JobBundle | null> {
    const rows = await this.db
      .select()
      .from(reproJobs)
      .innerJoin(repositories, eq(reproJobs.repositoryId, repositories.id))
      .innerJoin(issues, eq(reproJobs.issueId, issues.id))
      .innerJoin(installations, eq(reproJobs.installationId, installations.id))
      .where(eq(reproJobs.id, jobId))
      .limit(1);

    const row = rows[0];
    if (!row) {
      return null;
    }

    return {
      job: mapJob(row.repro_jobs),
      repository: {
        id: row.repositories.id,
        installationId: row.installations.githubInstallationId,
        githubRepositoryId: row.repositories.githubRepositoryId,
        owner: row.repositories.owner,
        name: row.repositories.name,
        fullName: row.repositories.fullName,
        defaultBranch: row.repositories.defaultBranch,
        cloneUrl: row.repositories.cloneUrl,
        htmlUrl: row.repositories.htmlUrl,
        isPrivate: row.repositories.isPrivate,
      },
      issue: {
        id: row.issues.id,
        repositoryId: row.issues.repositoryId,
        githubIssueId: row.issues.githubIssueId,
        number: row.issues.number,
        title: row.issues.title,
        body: row.issues.body,
        authorLogin: row.issues.authorLogin,
        state: row.issues.state,
      },
    };
  }

  async markJobRunning(jobId: string, input?: { sandboxId?: string | null; sandboxTarget?: string | null }): Promise<void> {
    await this.db
      .update(reproJobs)
      .set({
        state: "running",
        sandboxId: input?.sandboxId ?? undefined,
        sandboxTarget: input?.sandboxTarget ?? undefined,
        startedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(reproJobs.id, jobId));
  }

  async recordCommandRun(jobId: string, input: CommandRunInput): Promise<CommandRun> {
    const rows = await this.db
      .insert(commandRuns)
      .values({
        jobId,
        sequence: input.sequence,
        phase: input.phase,
        command: input.command,
        cwd: input.cwd,
        startedAt: input.startedAt,
        finishedAt: input.finishedAt,
        durationMs: input.durationMs,
        exitCode: input.exitCode,
        timedOut: input.timedOut,
        stdoutExcerpt: input.stdoutExcerpt,
        stderrExcerpt: input.stderrExcerpt,
      })
      .returning();

    const row = rows[0];
    if (!row) {
      throw new Error("command run insert failed");
    }

    return {
      id: row.id,
      sequence: row.sequence,
      phase: row.phase,
      command: row.command,
      cwd: row.cwd,
      startedAt: row.startedAt,
      finishedAt: row.finishedAt,
      durationMs: row.durationMs,
      exitCode: row.exitCode,
      timedOut: row.timedOut,
      stdoutExcerpt: row.stdoutExcerpt,
      stderrExcerpt: row.stderrExcerpt,
    };
  }

  async listCommandRuns(jobId: string): Promise<CommandRun[]> {
    const rows = await this.db
      .select()
      .from(commandRuns)
      .where(eq(commandRuns.jobId, jobId))
      .orderBy(asc(commandRuns.sequence));

    return rows.map((row) => ({
      id: row.id,
      sequence: row.sequence,
      phase: row.phase,
      command: row.command,
      cwd: row.cwd,
      startedAt: row.startedAt,
      finishedAt: row.finishedAt,
      durationMs: row.durationMs,
      exitCode: row.exitCode,
      timedOut: row.timedOut,
      stdoutExcerpt: row.stdoutExcerpt,
      stderrExcerpt: row.stderrExcerpt,
    }));
  }

  async finishJob(jobId: string, input: FinishJobInput): Promise<void> {
    await this.db
      .update(reproJobs)
      .set({
        state: "completed",
        result: input.result,
        errorCategory: input.errorCategory ?? null,
        errorMessage: input.errorMessage ?? null,
        sandboxId: input.sandboxId ?? undefined,
        sandboxTarget: input.sandboxTarget ?? undefined,
        commitSha: input.commitSha ?? undefined,
        packageManager: input.packageManager ?? undefined,
        finishedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(reproJobs.id, jobId));
  }

  async failJob(jobId: string, input: { errorCategory: FinishJobInput["errorCategory"]; errorMessage: string }): Promise<void> {
    await this.db
      .update(reproJobs)
      .set({
        state: "failed",
        result: "run_failed",
        errorCategory: input.errorCategory ?? "queue_error",
        errorMessage: input.errorMessage,
        finishedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(reproJobs.id, jobId)));
  }

  async recordIssueComment(input: IssueCommentInput): Promise<void> {
    await this.db.insert(issueComments).values(input);
  }
}

function mapJob(row: typeof reproJobs.$inferSelect): ReproJob {
  return {
    id: row.id,
    issueId: row.issueId,
    repositoryId: row.repositoryId,
    installationId: row.installationId,
    state: row.state,
    result: row.result,
    errorCategory: row.errorCategory,
    errorMessage: row.errorMessage,
    queueJobId: row.queueJobId,
    githubDeliveryId: row.githubDeliveryId,
    sandboxId: row.sandboxId,
    sandboxTarget: row.sandboxTarget,
    commitSha: row.commitSha,
    packageManager: row.packageManager,
  };
}
