export type RepoSlug = `${string}/${string}`;

export type RelunarConfig = {
  version: 1;
  setup: string[];
  baseline: string[];
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

export type RunStatus = "passed" | "setup_failed" | "baseline_failed" | "blocked";

export type RunReport = {
  runId: string;
  status: RunStatus;
  issue: {
    number: number;
    title: string;
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
  dispose(): Promise<void>;
};

export type SandboxProvider = {
  createSandbox(input: { runId: string }): Promise<SandboxSession>;
};
