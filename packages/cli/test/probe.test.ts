import { describe, expect, test } from "bun:test";
import { executeProbe } from "../src/probe";
import type { SandboxExecResult, SandboxSession } from "../src/types";

describe("assertion-driven probes", () => {
  test("verifies exit, output, artifact, and repeatability through one interface", async () => {
    const sandbox = new ProbeSandbox([
      result(1, "", "TypeError: empty config"),
      result(1, "", "TypeError: empty config"),
      result(1, "", "TypeError: empty config"),
    ]);

    const evidence = await executeProbe({
      sandbox,
      command: "bun repro.ts",
      cwd: "repo",
      timeoutSeconds: 30,
      repeat: 3,
      expectations: {
        exitCode: 1,
        stderrMatches: "TypeError: empty config",
        filesExist: ["repo/artifacts/trace.log"],
      },
    });

    expect(evidence).toHaveLength(3);
    expect(evidence.every((attempt) => attempt.verification?.passed)).toBe(true);
    expect(evidence.at(-1)?.verification).toMatchObject({
      verified: true,
      passed: true,
      attempt: 3,
      totalAttempts: 3,
    });
    expect(sandbox.commands.filter((command) => command === "bun repro.ts")).toHaveLength(3);
  });

  test("records assertion mismatch instead of treating arbitrary output as proof", async () => {
    const sandbox = new ProbeSandbox([result(0, "hello", "")]);

    const [evidence] = await executeProbe({
      sandbox,
      command: "echo hello",
      cwd: "repo",
      timeoutSeconds: 30,
      expectations: { outputMatches: "panic|TypeError" },
    });

    expect(evidence?.verification).toMatchObject({ verified: true, passed: false });
    expect(evidence?.verification?.checks[0]).toMatchObject({
      kind: "output_matches",
      passed: false,
    });
  });

  test("marks assertion-free probes unverified", async () => {
    const sandbox = new ProbeSandbox([result(0, "hello", "")]);
    const [evidence] = await executeProbe({
      sandbox,
      command: "echo hello",
      cwd: "repo",
      timeoutSeconds: 30,
      expectations: {},
    });

    expect(evidence?.verification).toMatchObject({ verified: false, passed: false });
  });

  test("records execution metadata and redacts supplied secret values", async () => {
    const sandbox = new ProbeSandbox([result(0, "token=super-secret", "")]);
    const [evidence] = await executeProbe({
      sandbox,
      command: "print-token",
      cwd: "repo/packages/cli",
      timeoutSeconds: 30,
      expectations: { outputMatches: "token=" },
      env: { TEST_TOKEN: "super-secret" },
      secrets: ["super-secret"],
    });
    expect(evidence?.stdout).toBe("token=[redacted]");
    expect(evidence?.cwd).toBe("repo/packages/cli");
    expect(evidence?.envNames).toEqual(["TEST_TOKEN"]);
    expect(evidence?.startedAt).toMatch(/^\d{4}-/);
    expect(evidence?.finishedAt).toMatch(/^\d{4}-/);
  });

  test("runs verified control once and reset between repeated bug probes", async () => {
    const sandbox = new ProbeSandbox([
      result(0, "healthy", ""),
      result(1, "", "TypeError"),
      result(1, "", "TypeError"),
    ]);
    const evidence = await executeProbe({
      sandbox,
      command: "run-bug-case",
      cwd: "repo",
      timeoutSeconds: 30,
      expectations: { stderrMatches: "TypeError" },
      repeat: 2,
      resetCommand: "reset-fixture",
      control: { command: "run-control", expectations: { exitCode: 0, outputMatches: "healthy" } },
    });
    expect(evidence.map((item) => item.name)).toEqual(["control", "repro", "probe_reset", "repro"]);
    expect(evidence[0]?.verification?.passed).toBe(true);
    expect(sandbox.commands).toEqual(["run-control", "run-bug-case", "reset-fixture", "run-bug-case"]);
  });
});

class ProbeSandbox implements SandboxSession {
  readonly id = "probe-sandbox";
  readonly target = "test";
  readonly commands: string[] = [];

  constructor(private readonly results: SandboxExecResult[]) {}

  async run(command: string): Promise<SandboxExecResult> {
    this.commands.push(command);
    if (command.startsWith("test -e")) {
      return result(0, "", "");
    }
    if (command === "reset-fixture") return result(0, "", "");
    const next = this.results.shift();
    if (!next) throw new Error(`Missing result for ${command}`);
    return next;
  }

  async upload(): Promise<void> {}
  async dispose(): Promise<void> {}
}

function result(exitCode: number, stdout: string, stderr: string): SandboxExecResult {
  return { exitCode, stdout, stderr, timedOut: false };
}
