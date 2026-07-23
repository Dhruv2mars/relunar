import { describe, expect, test } from "bun:test";
import { prepareTerminalEnvironment } from "../src/environment";
import { defaultRelunarConfig } from "../src/config";
import type { RelunarConfig, SandboxExecResult, SandboxSession } from "../src/types";

describe("terminal environment", () => {
  test("prepares workspace, services, env, and fingerprint behind one interface", async () => {
    const sandbox = new EnvironmentSandbox();
    const config: RelunarConfig = {
      ...defaultRelunarConfig,
      workspace: {
        workdir: "packages/cli",
        checkout: "refs/tags/v1.0.0",
        fetchDepth: 0,
        submodules: true,
        lfs: true,
      },
      environment: {
        variables: { CI: "1" },
        passthrough: ["TEST_DATABASE_URL"],
      },
      services: [{ name: "postgres", start: "start-postgres", ready: "pg-ready", stop: "stop-postgres" }],
    };

    const prepared = await prepareTerminalEnvironment({
      sandbox,
      config,
      hostEnv: { TEST_DATABASE_URL: "postgres://test" },
      timeoutSeconds: 30,
    });

    expect(prepared.workdir).toBe("repo/packages/cli");
    expect(prepared.commandEnv).toEqual({ CI: "1", TEST_DATABASE_URL: "postgres://test" });
    expect(prepared.fingerprint).toMatchObject({
      os: "Linux",
      architecture: "x86_64",
      runtimes: { node: "v22.1.0", bun: "1.3.13" },
      services: ["postgres"],
    });
    expect(sandbox.commands).toEqual(expect.arrayContaining([
      "git fetch origin 'refs/tags/v1.0.0' && git checkout --detach FETCH_HEAD",
      "git submodule update --init --recursive",
      "git lfs pull",
      "start-postgres",
      "pg-ready",
    ]));
    expect(sandbox.calls.find((call) => call.command === "start-postgres")?.env).toEqual(prepared.commandEnv);
  });

  test("rejects missing passthrough values before starting services", async () => {
    const sandbox = new EnvironmentSandbox();
    const config: RelunarConfig = {
      ...defaultRelunarConfig,
      environment: { passthrough: ["REQUIRED_TOKEN"] },
      services: [{ name: "svc", start: "start", ready: "ready" }],
    };
    await expect(
      prepareTerminalEnvironment({ sandbox, config, hostEnv: {}, timeoutSeconds: 30 }),
    ).rejects.toThrow("Missing environment passthrough variable: REQUIRED_TOKEN");
    expect(sandbox.commands).not.toContain("start");
  });
});

class EnvironmentSandbox implements SandboxSession {
  readonly id = "sandbox";
  readonly target = "test";
  readonly commands: string[] = [];
  readonly calls: Array<{ command: string; cwd: string; env?: Record<string, string> }> = [];

  async run(command: string, cwd: string, _timeout: number, env?: Record<string, string>): Promise<SandboxExecResult> {
    this.commands.push(command);
    this.calls.push({ command, cwd, ...(env ? { env } : {}) });
    if (command.includes("RELUNAR_FINGERPRINT")) {
      return ok("os=Linux\narch=x86_64\nruntime:node=v22.1.0\nruntime:bun=1.3.13\n");
    }
    return ok("");
  }

  async upload(): Promise<void> {}
  async dispose(): Promise<void> {}
}

function ok(stdout: string): SandboxExecResult {
  return { exitCode: 0, stdout, stderr: "", timedOut: false };
}
