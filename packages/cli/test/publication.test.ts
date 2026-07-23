import { describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { previewPublication, publishRunComment } from "../src/publication";
import { readRun, writeRun } from "../src/runs";
import type { RunReport } from "../src/types";

describe("retryable publication", () => {
  test("persists failed attempt then retries idempotently and stores comment URL", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "relunar-publication-"));
    try {
      await writeRun(cwd, report("verified"), 40);
      let attempts = 0;
      const publisher = {
        createComment: async () => {
          attempts += 1;
          if (attempts === 1) throw new Error("GitHub unavailable");
          return "https://github.com/owner/repo/issues/1#issuecomment-2";
        },
      };

      await expect(publishRunComment(cwd, "issue-1-test", publisher, 40)).rejects.toThrow("GitHub unavailable");
      expect((await readRun(cwd, "issue-1-test")).publication).toMatchObject({ status: "failed", attempts: 1 });

      const posted = await publishRunComment(cwd, "issue-1-test", publisher, 40);
      expect(posted.publication).toMatchObject({
        status: "posted",
        attempts: 2,
        commentUrl: "https://github.com/owner/repo/issues/1#issuecomment-2",
      });

      const again = await publishRunComment(cwd, "issue-1-test", publisher, 40);
      expect(again.publication?.attempts).toBe(2);
      expect(attempts).toBe(2);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  test("blocks unverified public comments", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "relunar-publication-unverified-"));
    try {
      await writeRun(cwd, report("unverified"), 40);
      await expect(
        publishRunComment(cwd, "issue-1-test", { createComment: async () => "unused" }, 40),
      ).rejects.toThrow("Unverified runs cannot be posted");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  test("previews exact maintainer markdown without mutation", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "relunar-publication-preview-"));
    try {
      await writeRun(cwd, report("verified"), 40);
      const preview = await previewPublication(cwd, "issue-1-test", 40);
      expect(preview).toContain("## Repro: Reproduced");
      expect((await readRun(cwd, "issue-1-test")).publication).toBeUndefined();
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  test("serializes concurrent posts so GitHub receives one comment", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "relunar-publication-concurrent-"));
    try {
      await writeRun(cwd, report("verified"), 40);
      let calls = 0;
      const publisher = {
        createComment: async () => {
          calls += 1;
          await Bun.sleep(30);
          return "https://github.com/owner/repo/issues/1#issuecomment-2";
        },
      };

      const [left, right] = await Promise.all([
        publishRunComment(cwd, "issue-1-test", publisher, 40),
        publishRunComment(cwd, "issue-1-test", publisher, 40),
      ]);

      expect(calls).toBe(1);
      expect(left.publication?.status).toBe("posted");
      expect(right.publication?.status).toBe("posted");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

function report(trust: "verified" | "unverified"): RunReport {
  return {
    schemaVersion: 2,
    runId: "issue-1-test",
    status: "reproduced",
    issue: { number: 1, title: "Bug", body: "body", state: "open", url: "https://github.com/owner/repo/issues/1" },
    repo: "owner/repo",
    commit: "abc",
    sandbox: { provider: "daytona", id: "sandbox", target: "test" },
    commands: [],
    failure: null,
    summary: "Verified crash.",
    reproSteps: "1. Run command",
    observed: "crash",
    expected: "success",
    environmentNotes: "node 22",
    trust,
    nextStep: "",
    startedAt: "2026-01-01T00:00:00.000Z",
    finishedAt: "2026-01-01T00:00:01.000Z",
  };
}
