import { describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parseArgs } from "../src/args";
import { execRepro, finishRepro, startRepro, uploadReproFile } from "../src/repro";
import { findActiveRunForIssue } from "../src/runs";
import type { Issue, SandboxExecResult, SandboxProvider, SandboxSession } from "../src/types";

describe("agent-driven repro lifecycle", () => {
  test("keeps ready sandbox, records issue evidence, then finalizes and cleans up", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "relunar-lifecycle-"));
    try {
      await writeFile(join(cwd, ".relunar.yml"), "version: 1\nsetup: []\nbaseline:\n  - bun run build\n", "utf8");
      const sandbox = new FakeSandbox();
      const provider = fakeProvider(sandbox);

      const started = await startRepro(input(cwd, provider));
      expect(started.status).toBe("environment_ready");
      expect(started.issue.body).toBe("Run repro.ts");
      expect(started.issue.state).toBe("open");
      expect(started.nextStep).toContain("not reproduced");
      expect(sandbox.disposed).toBe(false);

      const uploaded = await uploadReproFile({ cwd, runId: started.runId, localPath: "repro.ts", remotePath: "repo/repro.ts", sandboxProvider: provider });
      expect(uploaded.commands.at(-1)?.name).toBe("repro_upload");

      const executed = await execRepro({ cwd, runId: started.runId, command: "bun repro.ts", sandboxProvider: provider });
      expect(executed.commands.at(-1)?.name).toBe("repro");
      expect(executed.nextStep).toContain("Probe evidence recorded");

      const finished = await finishRepro({
        cwd,
        runId: started.runId,
        outcome: "reproduced",
        summary: "Compiler crashes with the supplied source.",
        reproSteps: "1. Run `bun repro.ts`",
        observed: "Error: boom",
        expected: "No crash",
        environmentNotes: "bun 1.2",
        sandboxProvider: provider,
      });
      expect(finished.status).toBe("reproduced");
      expect(finished.summary).toBe("Compiler crashes with the supplied source.");
      expect(finished.reproSteps).toBe("1. Run `bun repro.ts`");
      expect(finished.observed).toBe("Error: boom");
      expect(finished.expected).toBe("No crash");
      expect(finished.environmentNotes).toBe("bun 1.2");
      expect(finished.nextStep).toContain("finalized as reproduced");
      expect(sandbox.disposed).toBe(true);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  test("rejects finalization without issue-specific command evidence", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "relunar-lifecycle-gate-"));
    try {
      await writeFile(join(cwd, ".relunar.yml"), "version: 1\nsetup: []\nbaseline:\n  - bun run build\n", "utf8");
      const sandbox = new FakeSandbox();
      const provider = fakeProvider(sandbox);
      const started = await startRepro(input(cwd, provider));

      await expect(finishRepro({ cwd, runId: started.runId, outcome: "reproduced", summary: "Not enough.", sandboxProvider: provider })).rejects.toThrow("issue-specific command evidence");
      expect(sandbox.disposed).toBe(false);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  test("one-shot parse keeps finish narrative flags before passthrough probe", () => {
    const parsed = parseArgs([
      "repro",
      "42",
      "--finish",
      "--outcome",
      "reproduced",
      "--summary",
      "saw crash",
      "--repro-steps",
      "1. run bun repro.ts",
      "--observed",
      "boom",
      "--expected",
      "no crash",
      "--environment",
      "node 22",
      "--comment",
      "--",
      "bun",
      "repro.ts",
    ]);
    expect(parsed.positionals).toEqual(["repro", "42"]);
    expect(parsed.flags.finish).toBe(true);
    expect(parsed.flags.outcome).toBe("reproduced");
    expect(parsed.flags.summary).toBe("saw crash");
    expect(parsed.flags["repro-steps"]).toBe("1. run bun repro.ts");
    expect(parsed.flags.observed).toBe("boom");
    expect(parsed.flags.expected).toBe("no crash");
    expect(parsed.flags.environment).toBe("node 22");
    expect(parsed.flags.comment).toBe(true);
    expect(parsed.passthrough).toEqual(["bun", "repro.ts"]);
  });

  test("finds active environment_ready run for one-shot resume", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "relunar-oneshot-resume-"));
    try {
      await writeFile(join(cwd, ".relunar.yml"), "version: 1\nsetup: []\nbaseline:\n  - bun run build\n", "utf8");
      const sandbox = new FakeSandbox();
      const provider = fakeProvider(sandbox);
      const started = await startRepro(input(cwd, provider));
      const active = await findActiveRunForIssue(cwd, 123);
      expect(active?.runId).toBe(started.runId);

      await execRepro({ cwd, runId: started.runId, command: "bun repro.ts", sandboxProvider: provider });
      await finishRepro({ cwd, runId: started.runId, outcome: "not_reproduced", summary: "Did not crash.", sandboxProvider: provider });
      expect(await findActiveRunForIssue(cwd, 123)).toBeNull();
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

function input(cwd: string, sandboxProvider: SandboxProvider) {
  const issue: Issue = { number: 123, title: "Crash", body: "Run repro.ts", state: "open", url: "https://github.com/owner/repo/issues/123" };
  return { cwd, repo: "owner/repo" as const, issue, githubToken: "token", sandboxProvider };
}

function fakeProvider(sandbox: FakeSandbox): SandboxProvider {
  return {
    createSandbox: async () => sandbox,
    resumeSandbox: async () => sandbox,
  };
}

class FakeSandbox implements SandboxSession {
  readonly id = "sandbox-1";
  readonly target = "test";
  disposed = false;

  async run(command: string): Promise<SandboxExecResult> {
    if (command.includes("git rev-parse")) return ok("abc123\n");
    return ok(command === "bun repro.ts" ? "crash reproduced" : "ok");
  }

  async upload(localPath: string, remotePath: string): Promise<void> {
    expect(localPath).toBe("repro.ts");
    expect(remotePath).toBe("repo/repro.ts");
  }

  async dispose(): Promise<void> {
    this.disposed = true;
  }
}

function ok(stdout: string): SandboxExecResult {
  return { exitCode: 0, stdout, stderr: "", timedOut: false };
}
