import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readRun, updateRun, writeRun } from "../src/runs";
import type { RunReport } from "../src/types";

describe("durable run store", () => {
  test("serializes concurrent updates without losing writes", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "relunar-runs-lock-"));
    try {
      await writeRun(cwd, report(), 40);
      await Promise.all(
        Array.from({ length: 20 }, () =>
          updateRun(cwd, "issue-1-test", 40, (current) => {
            const attempts = current.publication?.attempts ?? 0;
            current.publication = {
              status: "failed",
              attempts: attempts + 1,
              commentUrl: null,
              error: "test",
              updatedAt: new Date().toISOString(),
            };
            return current;
          }),
        ),
      );
      expect((await readRun(cwd, "issue-1-test")).publication?.attempts).toBe(20);
      expect((await readdir(join(cwd, ".relunar", "runs", "issue-1-test"))).every((name) => !name.includes(".tmp-"))).toBe(true);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  test("migrates legacy reports to current schema defaults", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "relunar-runs-migrate-"));
    try {
      const legacy = report();
      delete legacy.schemaVersion;
      delete legacy.trust;
      await writeRun(cwd, legacy, 40);
      const migrated = await readRun(cwd, "issue-1-test");
      expect(migrated.schemaVersion).toBe(2);
      expect(migrated.trust).toBe("unverified");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  test("reclaims a run lock left by a dead process", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "relunar-runs-stale-lock-"));
    try {
      await writeRun(cwd, report(), 40);
      const dir = join(cwd, ".relunar", "runs", "issue-1-test");
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, "run.lock"), `999999 ${new Date().toISOString()}\n`);
      await updateRun(cwd, "issue-1-test", 40, (current) => ({ ...current, summary: "recovered" }));
      expect((await readRun(cwd, "issue-1-test")).summary).toBe("recovered");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

function report(): RunReport {
  return {
    schemaVersion: 2,
    runId: "issue-1-test",
    status: "environment_ready",
    issue: { number: 1, title: "Bug", body: "body", state: "open", url: "https://github.com/owner/repo/issues/1" },
    repo: "owner/repo",
    commit: "abc",
    sandbox: { provider: "daytona", id: "sandbox", target: "test" },
    commands: [],
    failure: null,
    trust: "unverified",
    nextStep: "",
    startedAt: "2026-01-01T00:00:00.000Z",
    finishedAt: "2026-01-01T00:00:01.000Z",
  };
}
