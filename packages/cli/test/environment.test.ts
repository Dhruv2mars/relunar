import { describe, expect, test } from "bun:test";
import { prepareTerminalEnvironment, startTerminalServices } from "../src/environment";
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
    const services = await startTerminalServices({
      sandbox,
      config,
      commandEnv: prepared.commandEnv,
      workdir: prepared.workdir,
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
      "pg-ready",
    ]));
    const serviceStart = sandbox.calls.find((call) => call.command.includes("nohup sh -c 'start-postgres'"));
    expect(serviceStart?.env).toEqual(prepared.commandEnv);
    expect(services.commands.map((command) => command.name)).toEqual(["service_start", "service_ready"]);
    expect(services.failure).toBeNull();
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

  test("launches foreground services without waiting for them to exit", async () => {
    const sandbox = new ForegroundServiceSandbox();
    const config: RelunarConfig = {
      ...defaultRelunarConfig,
      services: [{ name: "web/api", start: "bun run dev", ready: "curl -fsS http://127.0.0.1:3000/health" }],
    };

    const prepared = await prepareTerminalEnvironment({ sandbox, config, hostEnv: {}, timeoutSeconds: 300 });
    const services = await startTerminalServices({
      sandbox,
      config,
      commandEnv: prepared.commandEnv,
      workdir: prepared.workdir,
      timeoutSeconds: 300,
    });

    expect(services.commands.map((command) => command.name)).toEqual(["service_start", "service_ready"]);
    expect(services.commands[0]?.command).toBe("bun run dev");
    const serviceStartIndex = sandbox.commands.findIndex((command) => command.includes("nohup sh -c 'bun run dev'"));
    expect(sandbox.commands[serviceStartIndex]).toContain(".relunar/services/web-api.pid");
    expect(sandbox.commands[serviceStartIndex + 1]).toBe("curl -fsS http://127.0.0.1:3000/health");
    expect(sandbox.calls[serviceStartIndex + 1]?.timeout).toBe(10);
  });

  test("redacts passthrough secrets from service evidence without corrupting ordinary values", async () => {
    const sandbox = new ServiceOutputSandbox();
    const config: RelunarConfig = {
      ...defaultRelunarConfig,
      environment: { variables: { LABEL: "true" }, passthrough: ["TOKEN"] },
      services: [{ name: "web", start: "serve secret-value true", ready: "ready" }],
    };
    const prepared = await prepareTerminalEnvironment({
      sandbox,
      config,
      hostEnv: { TOKEN: "secret-value" },
      timeoutSeconds: 30,
    });
    const services = await startTerminalServices({
      sandbox,
      config,
      commandEnv: prepared.commandEnv,
      workdir: prepared.workdir,
      timeoutSeconds: 30,
    });

    expect(services.commands[0]?.command).toBe("serve [redacted] true");
    expect(services.commands[0]?.stdout).toBe("token=[redacted] enabled=true");
  });

  test("returns failed readiness evidence instead of discarding it", async () => {
    const sandbox = new FailingReadySandbox();
    const config: RelunarConfig = {
      ...defaultRelunarConfig,
      services: [{ name: "web", start: "run-server", ready: "never-ready" }],
    };
    const prepared = await prepareTerminalEnvironment({ sandbox, config, hostEnv: {}, timeoutSeconds: 1 });
    const services = await startTerminalServices({
      sandbox,
      config,
      commandEnv: prepared.commandEnv,
      workdir: prepared.workdir,
      timeoutSeconds: 1,
    });

    expect(services.failure).toContain("Service web did not become ready");
    expect(services.commands.at(-1)).toMatchObject({
      name: "service_ready",
      command: "never-ready",
      status: "failed",
      stderr: "connection refused",
    });
  });
});

class EnvironmentSandbox implements SandboxSession {
  readonly id = "sandbox";
  readonly target = "test";
  readonly commands: string[] = [];
  readonly calls: Array<{ command: string; cwd: string; timeout: number; env?: Record<string, string> }> = [];

  async run(command: string, cwd: string, timeout: number, env?: Record<string, string>): Promise<SandboxExecResult> {
    this.commands.push(command);
    this.calls.push({ command, cwd, timeout, ...(env ? { env } : {}) });
    if (command.includes("RELUNAR_FINGERPRINT")) {
      return ok("os=Linux\narch=x86_64\nruntime:node=v22.1.0\nruntime:bun=1.3.13\n");
    }
    return ok("");
  }

  async upload(): Promise<void> {}
  async dispose(): Promise<void> {}
}

class ForegroundServiceSandbox extends EnvironmentSandbox {
  override async run(command: string, cwd: string, timeout: number, env?: Record<string, string>): Promise<SandboxExecResult> {
    if (command === "bun run dev") {
      return { exitCode: null, stdout: "", stderr: "", timedOut: true };
    }
    return super.run(command, cwd, timeout, env);
  }
}

class ServiceOutputSandbox extends EnvironmentSandbox {
  override async run(command: string, cwd: string, timeout: number, env?: Record<string, string>): Promise<SandboxExecResult> {
    const result = await super.run(command, cwd, timeout, env);
    return command.includes("nohup sh -c") ? ok("token=secret-value enabled=true") : result;
  }
}

class FailingReadySandbox extends EnvironmentSandbox {
  override async run(command: string, cwd: string, timeout: number, env?: Record<string, string>): Promise<SandboxExecResult> {
    if (command === "never-ready") {
      this.commands.push(command);
      this.calls.push({ command, cwd, timeout, ...(env ? { env } : {}) });
      return { exitCode: 1, stdout: "", stderr: "connection refused", timedOut: false };
    }
    return super.run(command, cwd, timeout, env);
  }
}

function ok(stdout: string): SandboxExecResult {
  return { exitCode: 0, stdout, stderr: "", timedOut: false };
}
