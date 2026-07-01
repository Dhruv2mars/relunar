import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runRepro } from "../src/repro";
import type { Issue, SandboxProvider, SandboxSession, SandboxExecResult } from "../src/types";

describe("repro runner", () => {
  test("runs clone, setup, baseline and writes local report", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "relunar-repro-"));
    try {
      const issue = sampleIssue();
      const sandbox = new FakeSandbox([
        { match: "git clone", result: ok("") },
        { match: "git rev-parse", result: ok("abc123\n") },
        {
          match: "cat .relunar.yml",
          result: ok("version: 1\nsetup:\n  - bun install\nbaseline:\n  - bun test\nreport:\n  maxLogLines: 5\n"),
        },
        { match: "bun install", result: ok("installed") },
        { match: "bun test", result: ok("passed") },
      ]);

      const report = await runRepro({
        cwd,
        repo: "owner/repo",
        issue,
        githubToken: "secret-token",
        sandboxProvider: provider(sandbox),
      });

      expect(report.status).toBe("passed");
      expect(report.commit).toBe("abc123");
      expect(report.commands.map((command) => command.command)).toEqual([
        "git clone --depth 1 https://x-access-token:$GITHUB_TOKEN@github.com/owner/repo.git repo",
        "bun install",
        "bun test",
      ]);
      expect(sandbox.disposed).toBe(true);

      const raw = await readFile(join(cwd, ".relunar", "runs", report.runId, "report.json"), "utf8");
      expect(JSON.parse(raw).status).toBe("passed");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  test("marks baseline failure and stops after failed command", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "relunar-repro-fail-"));
    try {
      const sandbox = new FakeSandbox([
        { match: "git clone", result: ok("") },
        { match: "git rev-parse", result: ok("abc123\n") },
        { match: "cat .relunar.yml", result: ok("version: 1\nsetup: []\nbaseline:\n  - bun test\n") },
        { match: "bun test", result: { exitCode: 1, stdout: "fail", stderr: "", timedOut: false } },
      ]);

      const report = await runRepro({
        cwd,
        repo: "owner/repo",
        issue: sampleIssue(),
        githubToken: "secret-token",
        sandboxProvider: provider(sandbox),
      });

      expect(report.status).toBe("baseline_failed");
      expect(report.failure).toBe("bun test failed");
      expect(sandbox.commands).toHaveLength(4);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

function sampleIssue(): Issue {
  return {
    number: 123,
    title: "Example issue",
    body: "Fails on test",
    state: "open",
    url: "https://github.com/owner/repo/issues/123",
  };
}

function ok(stdout: string): SandboxExecResult {
  return { exitCode: 0, stdout, stderr: "", timedOut: false };
}

function provider(session: SandboxSession): SandboxProvider {
  return {
    createSandbox: async () => session,
  };
}

class FakeSandbox implements SandboxSession {
  readonly id = "fake-sandbox";
  readonly target = "test";
  readonly commands: string[] = [];
  disposed = false;

  constructor(private readonly fixtures: Array<{ match: string; result: SandboxExecResult }>) {}

  async run(command: string): Promise<SandboxExecResult> {
    this.commands.push(command);
    const fixture = this.fixtures.find((item) => command.includes(item.match));
    if (!fixture) {
      throw new Error(`unexpected command: ${command}`);
    }
    return fixture.result;
  }

  async dispose(): Promise<void> {
    this.disposed = true;
  }
}
