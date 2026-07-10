import { describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execRepro, finishRepro, startRepro, uploadReproFile } from "../src/repro";
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
      expect(sandbox.disposed).toBe(false);

      const uploaded = await uploadReproFile({ cwd, runId: started.runId, localPath: "repro.ts", remotePath: "repo/repro.ts", sandboxProvider: provider });
      expect(uploaded.commands.at(-1)?.name).toBe("repro_upload");

      const executed = await execRepro({ cwd, runId: started.runId, command: "bun repro.ts", sandboxProvider: provider });
      expect(executed.commands.at(-1)?.name).toBe("repro");

      const finished = await finishRepro({ cwd, runId: started.runId, outcome: "reproduced", summary: "Compiler crashes with the supplied source.", sandboxProvider: provider });
      expect(finished.status).toBe("reproduced");
      expect(finished.summary).toBe("Compiler crashes with the supplied source.");
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
