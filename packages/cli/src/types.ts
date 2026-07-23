export type RepoSlug = `${string}/${string}`;

export type SandboxResources = {
  cpu?: number | undefined;
  memory?: number | undefined;
  disk?: number | undefined;
};

export type EvidenceGate = {
  /** Require at least one `repro` command. Defaults by outcome. */
  requireReproCommand?: boolean | undefined;
  /** Require at least one failing or timed-out repro command. */
  requireNonZeroExit?: boolean | undefined;
  /** Require at least one successful (exit 0) repro command. */
  requireZeroExit?: boolean | undefined;
  /** Require at least one repro command with non-empty stdout or stderr. */
  requireProbeOutput?: boolean | undefined;
  /**
   * Require failure/timeout or non-empty probe output.
   * Default for `reproduced` when neither requireProbeOutput nor requireNonZeroExit is set.
   */
  requireProbeSignal?: boolean | undefined;
  /** Regex that must match combined repro stdout/stderr. */
  requireOutputMatch?: string | undefined;
  /** Sandbox paths that must exist at finish time. */
  requireArtifacts?: string[] | undefined;
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
    snapshot?: string | undefined;
    resources?: SandboxResources | undefined;
    /**
     * Daytona idle auto-stop interval in minutes. 0 disables auto-stop.
     * Relunar refreshes this on each resume (exec/upload/sync).
     */
    autoStopMinutes?: number | undefined;
  } | undefined;
  /** Dirty worktree sync into sandbox `repo/`. */
  sync?: {
    /** When true, `repro exec` / one-shot sync before running the probe. */
    onExec?: boolean | undefined;
    /** Include untracked files (still respects git exclude + sync.exclude). */
    includeUntracked?: boolean | undefined;
    /** Path prefixes to skip (e.g. node_modules, dist). */
    exclude?: string[] | undefined;
  } | undefined;
  workspace?: {
    workdir?: string | undefined;
    checkout?: string | undefined;
    fetchDepth?: number | undefined;
    submodules?: boolean | undefined;
    lfs?: boolean | undefined;
  } | undefined;
  environment?: {
    variables?: Record<string, string> | undefined;
    passthrough?: string[] | undefined;
  } | undefined;
  services?: Array<{
    name: string;
    start: string;
    ready: string;
    stop?: string | undefined;
  }> | undefined;
  artifacts?: {
    collect: string[];
  } | undefined;
  /** Outcome-scoped finish gates. Mild defaults apply for reproduced. */
  evidence?: {
    reproduced?: EvidenceGate | undefined;
    not_reproduced?: EvidenceGate | undefined;
    blocked?: EvidenceGate | undefined;
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
  labels?: string[] | undefined;
  comments?: Array<{ author: string; body: string; createdAt: string; url: string }> | undefined;
  attachments?: string[] | undefined;
};

export type CommandStatus = "passed" | "failed" | "timed_out";

export type ProbeExpectations = {
  exitCode?: number | undefined;
  stdoutMatches?: string | undefined;
  stderrMatches?: string | undefined;
  outputMatches?: string | undefined;
  filesExist?: string[] | undefined;
  maxDurationMs?: number | undefined;
};

export type ProbeCheck = {
  kind: "exit_code" | "stdout_matches" | "stderr_matches" | "output_matches" | "file_exists" | "max_duration";
  expected: string;
  actual: string;
  passed: boolean;
};

export type ProbeVerification = {
  verified: boolean;
  passed: boolean;
  attempt: number;
  totalAttempts: number;
  checks: ProbeCheck[];
};

export type CommandEvidence = {
  name: string;
  /** Stable identifier shared by a probe series and its control. */
  evidenceId?: string | undefined;
  /** Agent-authored, issue-specific behavior this evidence evaluates. */
  claim?: string | undefined;
  command: string;
  status: CommandStatus;
  exitCode: number | null;
  durationMs: number;
  stdout: string;
  stderr: string;
  cwd?: string | undefined;
  envNames?: string[] | undefined;
  startedAt?: string | undefined;
  finishedAt?: string | undefined;
  verification?: ProbeVerification | undefined;
};

export type ReproOutcome = "reproduced" | "not_reproduced" | "blocked";

export type RunStatus = "passed" | "environment_ready" | ReproOutcome | "aborted" | "setup_failed" | "baseline_failed";

export type RunReport = {
  schemaVersion?: 2 | undefined;
  runId: string;
  status: RunStatus;
  issue: {
    number: number;
    title: string;
    body: string;
    state: "open" | "closed";
    url: string;
    labels?: string[] | undefined;
    comments?: Array<{ author: string; body: string; createdAt: string; url: string }> | undefined;
    attachments?: string[] | undefined;
  };
  repo: RepoSlug;
  commit: string | null;
  sandbox: {
    provider: "daytona";
    id: string | null;
    target: string | null;
    image?: string | null | undefined;
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
  /** Trust derives from machine-evaluated probe assertions. */
  trust?: "verified" | "unverified" | undefined;
  /** Evidence groups explicitly selected to support the final verdict. */
  selectedEvidenceIds?: string[] | undefined;
  publication?: {
    status: "pending" | "posted" | "failed";
    attempts: number;
    commentUrl: string | null;
    error: string | null;
    updatedAt: string;
  } | undefined;
  cleanup?: {
    status: "pending" | "completed" | "failed";
    error: string | null;
    updatedAt: string;
  } | undefined;
  artifacts?: Array<{
    name: string;
    remotePath: string;
    localPath: string;
    sizeBytes: number;
    sha256: string;
  }> | undefined;
  environment?: {
    os: string;
    architecture: string;
    runtimes: Record<string, string>;
    workingDirectory: string;
    variableNames: string[];
    services: string[];
  } | undefined;
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
  download?(remotePath: string, localPath: string): Promise<void>;
  /** Refresh Daytona idle auto-stop so long probe sessions stay warm. */
  touchIdle?(autoStopMinutes: number): Promise<void>;
  dispose(): Promise<void>;
};

export type CreateSandboxInput = {
  runId: string;
  image?: string | undefined;
  snapshot?: string | undefined;
  resources?: SandboxResources | undefined;
  autoStopMinutes?: number | undefined;
  /** Provider lifecycle timeout; should cover cold image pulls. */
  timeoutSeconds?: number | undefined;
};

export type SandboxProvider = {
  createSandbox(input: CreateSandboxInput): Promise<SandboxSession>;
  resumeSandbox(id: string): Promise<SandboxSession>;
  listRelunarSandboxes?(): Promise<Array<{ id: string; runId: string | null; state: string }>>;
  deleteSandbox?(id: string): Promise<void>;
};
