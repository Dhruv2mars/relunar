import type {
  CommandRun,
  CommandRunInput,
  CreateIssueJobInput,
  FinishJobInput,
  IssueCommentInput,
  JobBundle,
  ReproJob,
} from "./domain/types";

export interface RelunarStore {
  createIssueJob(input: CreateIssueJobInput): Promise<{ jobId: string }>;
  setQueueJobId(jobId: string, queueJobId: string): Promise<void>;
  getJobBundle(jobId: string): Promise<JobBundle | null>;
  markJobRunning(jobId: string, input?: { sandboxId?: string | null; sandboxTarget?: string | null }): Promise<void>;
  recordCommandRun(jobId: string, input: CommandRunInput): Promise<CommandRun>;
  listCommandRuns(jobId: string): Promise<CommandRun[]>;
  finishJob(jobId: string, input: FinishJobInput): Promise<void>;
  failJob(jobId: string, input: { errorCategory: FinishJobInput["errorCategory"]; errorMessage: string }): Promise<void>;
  recordIssueComment(input: IssueCommentInput): Promise<void>;
}

export type StoredReproJob = ReproJob;
