export type SandboxCommandResult = {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
};

export type SandboxSession = {
  id: string;
  target: string | null;
  run(command: string, cwd: string | undefined, timeoutSeconds: number): Promise<SandboxCommandResult>;
  dispose(): Promise<void>;
};

export interface SandboxProvider {
  createSandbox(input: { jobId: string }): Promise<SandboxSession>;
}
