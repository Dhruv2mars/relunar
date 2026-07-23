import { describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parseArgs } from "../src/args";
import { cleanupRepro, execRepro, finishRepro, startRepro, uploadReproFile } from "../src/repro";
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

      const executed = await execRepro({
        cwd,
        runId: started.runId,
        command: "bun repro.ts",
        expectations: { outputMatches: "crash reproduced" },
        repeat: 2,
        claim: "Compiler crashes with the supplied source",
        sandboxProvider: provider,
      });
      expect(executed.commands.at(-1)?.name).toBe("repro");
      expect(executed.commands.filter((command) => command.name === "repro")).toHaveLength(2);
      expect(executed.commands.at(-1)?.verification?.passed).toBe(true);
      expect(executed.commands.at(-1)?.evidenceId).toBe("probe-1");
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
        evidenceIds: ["probe-1"],
        sandboxProvider: provider,
      });
      expect(finished.status).toBe("reproduced");
      expect(finished.summary).toBe("Compiler crashes with the supplied source.");
      expect(finished.reproSteps).toBe("1. Run `bun repro.ts`");
      expect(finished.observed).toBe("Error: boom");
      expect(finished.expected).toBe("No crash");
      expect(finished.environmentNotes).toBe("bun 1.2");
      expect(finished.trust).toBe("verified");
      expect(finished.selectedEvidenceIds).toEqual(["probe-1"]);
      expect(finished.nextStep).toContain("finalized as reproduced");
      expect(sandbox.disposed).toBe(false);
      const cleaned = await cleanupRepro({ cwd, runId: started.runId, sandboxProvider: provider });
      expect(cleaned.cleanup?.status).toBe("completed");
      expect(sandbox.disposed).toBe(true);
      const cleanedAgain = await cleanupRepro({ cwd, runId: started.runId, sandboxProvider: provider });
      expect(cleanedAgain.cleanup?.status).toBe("completed");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  test("cannot finish from an unrelated passing diagnostic", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "relunar-lifecycle-claim-link-"));
    try {
      await writeFile(join(cwd, ".relunar.yml"), "version: 1\nsetup: []\nbaseline:\n  - bun run build\n", "utf8");
      const sandbox = new FakeSandbox();
      const provider = fakeProvider(sandbox);
      const started = await startRepro(input(cwd, provider));
      await execRepro({ cwd, runId: started.runId, command: "bun repro.ts", expectations: { outputMatches: "missing" }, claim: "Compiler crashes", sandboxProvider: provider });
      await execRepro({ cwd, runId: started.runId, command: "echo PROBE_COMPLETE", expectations: { outputMatches: "PROBE_COMPLETE" }, claim: "Environment can execute shell commands", sandboxProvider: provider });

      await expect(finishRepro({
        cwd,
        runId: started.runId,
        outcome: "reproduced",
        summary: "Compiler crashes.",
        reproSteps: "1. Run repro",
        observed: "crash",
        expected: "no crash",
        environmentNotes: "test",
        evidenceIds: ["probe-1"],
        sandboxProvider: provider,
      })).rejects.toThrow("verified passing probe assertion");
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

      await expect(finishRepro({ cwd, runId: started.runId, outcome: "reproduced", summary: "Not enough.", sandboxProvider: provider })).rejects.toThrow("explicit --evidence selection");
      expect(sandbox.disposed).toBe(false);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  test("rejects reproduced finish when probe has output but no explicit assertion", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "relunar-lifecycle-output-gate-"));
    try {
      await writeFile(join(cwd, ".relunar.yml"), "version: 1\nsetup: []\nbaseline:\n  - bun run build\n", "utf8");
      const sandbox = new FakeSandbox();
      const provider = fakeProvider(sandbox);
      const started = await startRepro(input(cwd, provider));
      await execRepro({ cwd, runId: started.runId, command: "bun repro.ts", claim: "Compiler crashes", sandboxProvider: provider });

      await expect(
        finishRepro({ cwd, runId: started.runId, outcome: "reproduced", summary: "Claimed repro with empty probe.", evidenceIds: ["probe-1"], sandboxProvider: provider }),
      ).rejects.toThrow("verified passing probe assertion");
      expect(sandbox.disposed).toBe(false);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  test("not-reproduced requires an evaluated assertion that did not match", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "relunar-lifecycle-not-reproduced-"));
    try {
      await writeFile(join(cwd, ".relunar.yml"), "version: 1\nsetup: []\nbaseline:\n  - bun run build\n", "utf8");
      const sandbox = new FakeSandbox();
      const provider = fakeProvider(sandbox);
      const started = await startRepro(input(cwd, provider));
      await execRepro({
        cwd,
        runId: started.runId,
        command: "bun repro.ts",
        expectations: { outputMatches: "segmentation fault" },
        claim: "Compiler segfaults",
        sandboxProvider: provider,
      });

      const finished = await finishRepro({
        cwd,
        runId: started.runId,
        outcome: "not_reproduced",
        summary: "Expected crash signature did not occur.",
        evidenceIds: ["probe-1"],
        sandboxProvider: provider,
      });
      expect(finished.trust).toBe("verified");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  test("reproduced requires complete maintainer narrative", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "relunar-lifecycle-narrative-"));
    try {
      await writeFile(join(cwd, ".relunar.yml"), "version: 1\nsetup: []\nbaseline:\n  - bun run build\n", "utf8");
      const sandbox = new FakeSandbox();
      const provider = fakeProvider(sandbox);
      const started = await startRepro(input(cwd, provider));
      await execRepro({ cwd, runId: started.runId, command: "bun repro.ts", expectations: { outputMatches: "crash" }, claim: "Compiler crashes", sandboxProvider: provider });

      await expect(
        finishRepro({
          cwd,
          runId: started.runId,
          outcome: "reproduced",
          summary: "Crash observed.",
          evidenceIds: ["probe-1"],
          sandboxProvider: provider,
        }),
      ).rejects.toThrow("requires --repro-steps, --observed, --expected, and --environment");
      expect(sandbox.disposed).toBe(false);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  test("refreshes idle TTL on exec while keeping sandbox warm until finish", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "relunar-lifecycle-warm-"));
    try {
      await writeFile(join(cwd, ".relunar.yml"), "version: 1\nsetup: []\nbaseline:\n  - bun run build\n", "utf8");
      const sandbox = new FakeSandbox();
      const provider = fakeProvider(sandbox);
      const started = await startRepro(input(cwd, provider));
      expect(sandbox.disposed).toBe(false);
      await execRepro({ cwd, runId: started.runId, command: "bun repro.ts", expectations: { outputMatches: "crash" }, claim: "Compiler crashes", sandboxProvider: provider });
      expect(sandbox.touchCount).toBeGreaterThan(0);
      expect(sandbox.disposed).toBe(false);
      await finishRepro({
        cwd,
        runId: started.runId,
        outcome: "reproduced",
        summary: "Warm until finish, then disposed.",
        reproSteps: "1. Run bun repro.ts",
        observed: "crash reproduced",
        expected: "no crash",
        environmentNotes: "bun test",
        evidenceIds: ["probe-1"],
        sandboxProvider: provider,
      });
      expect(sandbox.disposed).toBe(false);
      await cleanupRepro({ cwd, runId: started.runId, sandboxProvider: provider });
      expect(sandbox.disposed).toBe(true);
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
      const active = await findActiveRunForIssue(cwd, 123, "owner/repo");
      expect(active?.runId).toBe(started.runId);
      expect(await findActiveRunForIssue(cwd, 123, "other/repo")).toBeNull();

      await execRepro({ cwd, runId: started.runId, command: "bun repro.ts", expectations: { outputMatches: "missing signature" }, claim: "Compiler crashes", sandboxProvider: provider });
      await finishRepro({ cwd, runId: started.runId, outcome: "not_reproduced", summary: "Did not crash.", evidenceIds: ["probe-1"], sandboxProvider: provider });
      expect(await findActiveRunForIssue(cwd, 123, "owner/repo")).toBeNull();
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  test("skip gates remains unverified and therefore cannot become publishable evidence", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "relunar-lifecycle-skipped-"));
    try {
      await writeFile(join(cwd, ".relunar.yml"), "version: 1\nsetup: []\nbaseline:\n  - bun run build\n", "utf8");
      const sandbox = new FakeSandbox();
      const provider = fakeProvider(sandbox);
      const started = await startRepro(input(cwd, provider));
      const finished = await finishRepro({
        cwd,
        runId: started.runId,
        outcome: "blocked",
        summary: "External service unavailable.",
        skipEvidenceGates: true,
        sandboxProvider: provider,
      });

      expect(finished.trust).toBe("unverified");
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
  touchCount = 0;

  async run(command: string): Promise<SandboxExecResult> {
    if (command.includes("git rev-parse")) return ok("abc123\n");
    if (command === "true") return ok("");
    return ok(command === "bun repro.ts" ? "crash reproduced" : "ok");
  }

  async upload(localPath: string, remotePath: string): Promise<void> {
    expect(localPath).toBe("repro.ts");
    expect(remotePath).toBe("repo/repro.ts");
  }

  async touchIdle(): Promise<void> {
    this.touchCount += 1;
  }

  async dispose(): Promise<void> {
    this.disposed = true;
  }
}

function ok(stdout: string): SandboxExecResult {
  return { exitCode: 0, stdout, stderr: "", timedOut: false };
}
