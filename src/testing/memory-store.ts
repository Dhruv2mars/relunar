import type {
  CommandRun,
  CommandRunInput,
  CreateIssueJobInput,
  FinishJobInput,
  IssueCommentInput,
  IssueRef,
  JobBundle,
  RepositoryRef,
  ReproJob,
} from "../domain/types";
import type { RelunarStore } from "../store";

export class MemoryRelunarStore implements RelunarStore {
  readonly repositories = new Map<string, RepositoryRef>();
  readonly issues = new Map<string, IssueRef>();
  readonly jobs = new Map<string, ReproJob>();
  readonly commands = new Map<string, CommandRun[]>();
  readonly comments: IssueCommentInput[] = [];
  private nextId = 1;

  async createIssueJob(input: CreateIssueJobInput): Promise<{ jobId: string }> {
    const repositoryId = `repo-${this.nextId++}`;
    const issueId = `issue-${this.nextId++}`;
    const jobId = `job-${this.nextId++}`;
    const repository: RepositoryRef = {
      id: repositoryId,
      installationId: input.installation.githubInstallationId,
      ...input.repository,
    };
    const issue: IssueRef = {
      id: issueId,
      repositoryId,
      ...input.issue,
    };
    const job: ReproJob = {
      id: jobId,
      issueId,
      repositoryId,
      installationId: input.installation.githubInstallationId,
      state: "queued",
      result: null,
      errorCategory: null,
      errorMessage: null,
      queueJobId: null,
      githubDeliveryId: input.githubDeliveryId,
      sandboxId: null,
      sandboxTarget: null,
      commitSha: null,
      packageManager: null,
    };

    this.repositories.set(repositoryId, repository);
    this.issues.set(issueId, issue);
    this.jobs.set(jobId, job);
    this.commands.set(jobId, []);
    return { jobId };
  }

  async setQueueJobId(jobId: string, queueJobId: string): Promise<void> {
    const job = this.requireJob(jobId);
    job.queueJobId = queueJobId;
  }

  async getJobBundle(jobId: string): Promise<JobBundle | null> {
    const job = this.jobs.get(jobId);
    if (!job) {
      return null;
    }

    const repository = this.repositories.get(job.repositoryId);
    const issue = this.issues.get(job.issueId);
    if (!repository || !issue) {
      return null;
    }

    return { job: { ...job }, repository: { ...repository }, issue: { ...issue } };
  }

  async markJobRunning(jobId: string, input?: { sandboxId?: string | null; sandboxTarget?: string | null }): Promise<void> {
    const job = this.requireJob(jobId);
    job.state = "running";
    job.sandboxId = input?.sandboxId ?? job.sandboxId;
    job.sandboxTarget = input?.sandboxTarget ?? job.sandboxTarget;
  }

  async recordCommandRun(jobId: string, input: CommandRunInput): Promise<CommandRun> {
    const command: CommandRun = { ...input, id: `cmd-${this.nextId++}` };
    const commands = this.commands.get(jobId) ?? [];
    commands.push(command);
    this.commands.set(jobId, commands);
    return command;
  }

  async listCommandRuns(jobId: string): Promise<CommandRun[]> {
    return [...(this.commands.get(jobId) ?? [])].sort((a, b) => a.sequence - b.sequence);
  }

  async finishJob(jobId: string, input: FinishJobInput): Promise<void> {
    const job = this.requireJob(jobId);
    job.state = "completed";
    job.result = input.result;
    job.errorCategory = input.errorCategory ?? null;
    job.errorMessage = input.errorMessage ?? null;
    job.sandboxId = input.sandboxId ?? job.sandboxId;
    job.sandboxTarget = input.sandboxTarget ?? job.sandboxTarget;
    job.commitSha = input.commitSha ?? job.commitSha;
    job.packageManager = input.packageManager ?? job.packageManager;
  }

  async failJob(jobId: string, input: { errorCategory: FinishJobInput["errorCategory"]; errorMessage: string }): Promise<void> {
    const job = this.requireJob(jobId);
    job.state = "failed";
    job.result = "run_failed";
    job.errorCategory = input.errorCategory ?? "queue_error";
    job.errorMessage = input.errorMessage;
  }

  async recordIssueComment(input: IssueCommentInput): Promise<void> {
    this.comments.push(input);
  }

  private requireJob(jobId: string): ReproJob {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`missing job ${jobId}`);
    }
    return job;
  }
}
