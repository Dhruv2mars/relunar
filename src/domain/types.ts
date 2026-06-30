export const jobStates = ["queued", "running", "completed", "failed"] as const;
export type JobState = (typeof jobStates)[number];

export const jobResults = ["baseline_passed", "baseline_failed", "blocked", "run_failed"] as const;
export type JobResult = (typeof jobResults)[number];

export const errorCategories = [
  "webhook_verification_error",
  "queue_error",
  "github_auth_error",
  "github_api_error",
  "sandbox_create_error",
  "clone_error",
  "package_detection_error",
  "command_timeout",
  "command_failed",
  "report_post_error",
] as const;
export type ErrorCategory = (typeof errorCategories)[number];

export type PackageManager = "bun" | "pnpm" | "yarn" | "npm";

export type CommandPhase = "clone" | "inspect" | "install" | "build" | "test";

export type CommandRunInput = {
  sequence: number;
  phase: CommandPhase;
  command: string;
  cwd: string;
  startedAt: Date;
  finishedAt: Date;
  durationMs: number;
  exitCode: number | null;
  timedOut: boolean;
  stdoutExcerpt: string;
  stderrExcerpt: string;
};

export type CommandRun = CommandRunInput & {
  id?: string;
};

export type RepositoryRef = {
  id: string;
  installationId: string;
  githubRepositoryId: string;
  owner: string;
  name: string;
  fullName: string;
  defaultBranch: string;
  cloneUrl: string;
  htmlUrl: string;
  isPrivate: boolean;
};

export type IssueRef = {
  id: string;
  repositoryId: string;
  githubIssueId: string;
  number: number;
  title: string;
  body: string;
  authorLogin: string;
  state: string;
};

export type ReproJob = {
  id: string;
  issueId: string;
  repositoryId: string;
  installationId: string;
  state: JobState;
  result: JobResult | null;
  errorCategory: ErrorCategory | null;
  errorMessage: string | null;
  queueJobId: string | null;
  githubDeliveryId: string;
  sandboxId: string | null;
  sandboxTarget: string | null;
  commitSha: string | null;
  packageManager: PackageManager | null;
};

export type JobBundle = {
  job: ReproJob;
  repository: RepositoryRef;
  issue: IssueRef;
};

export type CreateIssueJobInput = {
  githubDeliveryId: string;
  installation: {
    githubInstallationId: string;
    accountLogin: string;
    accountType: string;
  };
  repository: Omit<RepositoryRef, "id" | "installationId">;
  issue: Omit<IssueRef, "id" | "repositoryId">;
};

export type FinishJobInput = {
  result: JobResult;
  errorCategory?: ErrorCategory | null;
  errorMessage?: string | null;
  sandboxId?: string | null;
  sandboxTarget?: string | null;
  commitSha?: string | null;
  packageManager?: PackageManager | null;
};

export type IssueCommentInput = {
  repositoryId: string;
  issueId: string;
  jobId: string;
  githubCommentId: string;
  body: string;
  bodyHash: string;
};
