import type { SandboxCommandResult, SandboxProvider, SandboxSession } from "./types";

export type FakeSandboxCommand = {
  match: string | RegExp;
  result: SandboxCommandResult;
};

export class FakeSandboxProvider implements SandboxProvider {
  readonly commands: Array<{ command: string; cwd: string | undefined; timeoutSeconds: number }> = [];

  constructor(private readonly scripted: FakeSandboxCommand[]) {}

  async createSandbox(): Promise<SandboxSession> {
    return {
      id: "sandbox-test",
      target: "test-target",
      run: async (command, cwd, timeoutSeconds) => {
        this.commands.push({ command, cwd, timeoutSeconds });
        const scriptedCommand = this.scripted.find((entry) =>
          typeof entry.match === "string" ? command === entry.match : entry.match.test(command),
        );
        if (!scriptedCommand) {
          return {
            exitCode: 0,
            stdout: "",
            stderr: "",
            timedOut: false,
          };
        }
        return scriptedCommand.result;
      },
      dispose: async () => undefined,
    };
  }
}
