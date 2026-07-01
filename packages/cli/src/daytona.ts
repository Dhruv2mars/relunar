import { CodeLanguage, Daytona, type DaytonaConfig } from "@daytona/sdk";
import type { SandboxProvider, SandboxSession } from "./types";

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

  async createSandbox(input: { runId: string }): Promise<SandboxSession> {
    const sandbox = await this.daytona.create(
      {
        language: CodeLanguage.TYPESCRIPT,
        ephemeral: true,
        autoStopInterval: 30,
        autoDeleteInterval: 0,
        labels: {
          app: "relunar",
          runId: input.runId,
        },
      },
      { timeout: 120 },
    );

    return {
      id: sandbox.id,
      target: sandbox.target ?? this.options.target ?? null,
      run: async (command, cwd, timeoutSeconds, env) => {
        try {
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
