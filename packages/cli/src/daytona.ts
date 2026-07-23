import { CodeLanguage, Daytona, type DaytonaConfig } from "@daytona/sdk";
import { DEFAULT_AUTO_STOP_MINUTES } from "./config";
import type { CreateSandboxInput, SandboxProvider, SandboxSession } from "./types";

export type DaytonaProviderOptions = {
  apiKey: string;
  apiUrl?: string | undefined;
  target?: string | undefined;
};

export class DaytonaSandboxProvider implements SandboxProvider {
  private readonly daytona: Daytona;

  constructor(private readonly options: DaytonaProviderOptions) {
    const config: DaytonaConfig = {
      apiKey: options.apiKey,
      otelEnabled: false,
    };
    if (options.apiUrl) {
      config.apiUrl = options.apiUrl;
    }
    if (options.target) {
      config.target = options.target;
    }
    this.daytona = new Daytona(config);
  }

  async createSandbox(input: CreateSandboxInput): Promise<SandboxSession> {
    const autoStopInterval = input.autoStopMinutes ?? DEFAULT_AUTO_STOP_MINUTES;
    const sandbox = await this.daytona.create(
      {
        ...(input.snapshot
          ? { snapshot: input.snapshot }
          : input.image
          ? { image: input.image, ...(input.resources ? { resources: input.resources } : {}) }
          : { language: CodeLanguage.TYPESCRIPT }),
        ephemeral: true,
        autoStopInterval,
        autoDeleteInterval: 0,
        labels: {
          app: "relunar",
          runId: input.runId,
        },
      },
      { timeout: 120 },
    );

    return this.session(sandbox, autoStopInterval);
  }

  async resumeSandbox(id: string): Promise<SandboxSession> {
    const sandbox = await this.daytona.get(id);
    if (sandbox.state !== "started") {
      await sandbox.start(120);
    }
    const autoStopInterval = sandbox.autoStopInterval ?? DEFAULT_AUTO_STOP_MINUTES;
    return this.session(sandbox, autoStopInterval);
  }

  async listRelunarSandboxes(): Promise<Array<{ id: string; runId: string | null; state: string }>> {
    const items: Array<{ id: string; runId: string | null; state: string }> = [];
    for await (const sandbox of this.daytona.list({ labels: { app: "relunar" } })) {
      items.push({ id: sandbox.id, runId: sandbox.labels.runId ?? null, state: sandbox.state ?? "unknown" });
    }
    return items;
  }

  async deleteSandbox(id: string): Promise<void> {
    const sandbox = await this.daytona.get(id);
    await this.daytona.delete(sandbox, 120);
  }

  private session(sandbox: Awaited<ReturnType<Daytona["get"]>>, autoStopMinutes: number): SandboxSession {
    return {
      id: sandbox.id,
      target: sandbox.target ?? this.options.target ?? null,
      run: async (command, cwd, timeoutSeconds, env) => {
        try {
          // Daytona collapses streams into `result`. Do not wrap with bash — custom
          // images (e.g. Alpine) may lack it. Evidence gates treat failed/timed_out
          // as probe signal even when captured text is empty.
          const result = await sandbox.process.executeCommand(command, cwd, env ?? {}, timeoutSeconds);
          return {
            exitCode: result.exitCode,
            stdout: result.result ?? result.artifacts?.stdout ?? "",
            stderr: "",
            timedOut: false,
          };
        } catch (error) {
          if (isTimeoutError(error)) {
            return {
              exitCode: null,
              stdout: "",
              stderr: error instanceof Error ? error.message : "command timed out",
              timedOut: true,
            };
          }
          throw error;
        }
      },
      upload: async (localPath, remotePath) => {
        await sandbox.fs.uploadFile(localPath, remotePath);
      },
      download: async (remotePath, localPath) => {
        await sandbox.fs.downloadFile(remotePath, localPath);
      },
      touchIdle: async (minutes = autoStopMinutes) => {
        await sandbox.setAutostopInterval(minutes);
      },
      dispose: async () => {
        await sandbox.delete(120).catch(async () => {
          await sandbox.stop().catch(() => undefined);
        });
      },
    };
  }
}

function isTimeoutError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  return /timeout|timed out/i.test(`${error.name} ${error.message}`);
}
