export type RepoSlug = `${string}/${string}`;

export type SandboxResources = {
  cpu?: number | undefined;
  memory?: number | undefined;
  disk?: number | undefined;
};

export type RelunarConfig = {
  version: 1;
  setup: string[];
  baseline: string[];
  sandbox?: {
    /**
     * Optional Daytona-compatible image. Use this when a repository pins a
     * runtime that differs from Daytona's language image.
     */
    image?: string | undefined;
    resources?: SandboxResources | undefined;
  } | undefined;
  commandTimeoutSeconds: number;
  report: {
    maxLogLines: number;
  };
};

export type GlobalConfig = {
  daytona?: {
    apiUrl?: string | undefined;
    target?: string | undefined;
  } | undefined;
  repoLinks: Record<string, RepoSlug>;
};

export type Issue = {
  number: number;
  title: string;
  body: string;
  state: "open" | "closed";
  url: string;
};

export type CommandStatus = "passed" | "failed" | "timed_out";

export type CommandEvidence = {
  name: string;
  command: string;
  status: CommandStatus;
  exitCode: number | null;
  durationMs: number;
  stdout: string;
  stderr: string;
};

export type ReproOutcome = "reproduced" | "not_reproduced" | "blocked";

export type RunStatus = "passed" | "environment_ready" | ReproOutcome | "aborted" | "setup_failed" | "baseline_failed";

export type RunReport = {
  runId: string;
  status: RunStatus;
  issue: {
    number: number;
    title: string;
    body: string;
    state: "open" | "closed";
    url: string;
  };
  repo: RepoSlug;
  commit: string | null;
  sandbox: {
    provider: "daytona";
    id: string | null;
    target: string | null;
  };
  commands: CommandEvidence[];
  failure: string | null;
  /** Plain-language verdict of what was tried / found. Required to finish. */
  summary?: string | null | undefined;
  /** Agent-authored copy-pasteable repro steps. Relunar never invents these. */
  reproSteps?: string | null | undefined;
  /** Agent-authored observed behavior (or key stderr/stdout signal). */
  observed?: string | null | undefined;
  /** Agent-authored expected behavior when known. */
  expected?: string | null | undefined;
  /** Brief environment that matters (tsc/node/OS). Not sandbox IDs. */
  environmentNotes?: string | null | undefined;
  /** Agent-facing hint. environment_ready means probing is still required. */
  nextStep: string;
  startedAt: string;
  finishedAt: string;
};

export type SandboxExecResult = {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
};

export type SandboxSession = {
  id: string;
  target: string | null;
  run(command: string, cwd: string, timeoutSeconds: number, env?: Record<string, string>): Promise<SandboxExecResult>;
  upload(localPath: string, remotePath: string): Promise<void>;
  dispose(): Promise<void>;
};

export type SandboxProvider = {
  createSandbox(input: { runId: string; image?: string | undefined; resources?: SandboxResources | undefined }): Promise<SandboxSession>;
  resumeSandbox(id: string): Promise<SandboxSession>;
};
