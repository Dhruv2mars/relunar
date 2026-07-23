import { describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gcOrphanSandboxes, inspectSandboxes } from "../src/recovery";
import { writeRun } from "../src/runs";
import type { RunReport, SandboxProvider, SandboxSession } from "../src/types";

describe("sandbox recovery", () => {
  test("classifies referenced and orphaned Relunar sandboxes and dry-runs safely", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "relunar-recovery-"));
    try {
      await writeRun(cwd, report("sandbox-active"), 40);
      const deleted: string[] = [];
      const provider = recoveryProvider(deleted);

      const inspected = await inspectSandboxes(cwd, provider);
      expect(inspected).toEqual([
        expect.objectContaining({ id: "sandbox-active", orphaned: false, runId: "issue-1-test" }),
        expect.objectContaining({ id: "sandbox-orphan", orphaned: true, runId: "missing-run" }),
      ]);

      const dry = await gcOrphanSandboxes(cwd, provider, { dryRun: true });
      expect(dry.deleted).toEqual([]);
      expect(dry.wouldDelete).toEqual(["sandbox-orphan"]);
      expect(deleted).toEqual([]);

      const actual = await gcOrphanSandboxes(cwd, provider, { dryRun: false });
      expect(actual.deleted).toEqual(["sandbox-orphan"]);
      expect(deleted).toEqual(["sandbox-orphan"]);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

function recoveryProvider(deleted: string[]): SandboxProvider {
  return {
    createSandbox: async () => session("created"),
    resumeSandbox: async (id) => session(id),
    listRelunarSandboxes: async () => [
      { id: "sandbox-active", runId: "issue-1-test", state: "started" },
      { id: "sandbox-orphan", runId: "missing-run", state: "stopped" },
    ],
    deleteSandbox: async (id) => { deleted.push(id); },
  };
}

function session(id: string): SandboxSession {
  return {
    id,
    target: "test",
    run: async () => ({ exitCode: 0, stdout: "", stderr: "", timedOut: false }),
    upload: async () => undefined,
    dispose: async () => undefined,
  };
}

function report(sandboxId: string): RunReport {
  return {
    schemaVersion: 2,
    runId: "issue-1-test",
    status: "environment_ready",
    issue: { number: 1, title: "Bug", body: "body", state: "open", url: "https://github.com/owner/repo/issues/1" },
    repo: "owner/repo",
    commit: "abc",
    sandbox: { provider: "daytona", id: sandboxId, target: "test" },
    commands: [],
    failure: null,
    trust: "unverified",
    nextStep: "",
    startedAt: "2026-01-01T00:00:00.000Z",
    finishedAt: "2026-01-01T00:00:01.000Z",
  };
}
