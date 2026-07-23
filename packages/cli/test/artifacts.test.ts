import { describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { collectArtifacts } from "../src/artifacts";
import type { SandboxExecResult, SandboxSession } from "../src/types";

describe("artifact collection", () => {
  test("downloads one deterministic archive and records hash and size", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "relunar-artifacts-"));
    try {
      const sandbox = new ArtifactSandbox();
      const artifacts = await collectArtifacts({
        cwd,
        runId: "issue-1-test",
        sandbox,
        patterns: ["logs/**", "repro/output.txt"],
        timeoutSeconds: 30,
      });

      expect(artifacts).toHaveLength(1);
      expect(artifacts[0]).toMatchObject({
        name: "artifacts.tar.gz",
        remotePath: "/tmp/relunar-issue-1-test-artifacts.tar.gz",
        sizeBytes: 16,
      });
      expect(artifacts[0]?.sha256).toHaveLength(64);
      expect(sandbox.commands[0]).toContain("logs/**");
      expect(sandbox.downloads).toHaveLength(1);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  test("fails clearly when adapter cannot download", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "relunar-artifacts-no-download-"));
    try {
      const sandbox: SandboxSession = {
        id: "sandbox",
        target: "test",
        run: async () => ok(),
        upload: async () => undefined,
        dispose: async () => undefined,
      };
      await expect(
        collectArtifacts({ cwd, runId: "run", sandbox, patterns: ["logs/**"], timeoutSeconds: 30 }),
      ).rejects.toThrow("does not support artifact downloads");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

class ArtifactSandbox implements SandboxSession {
  readonly id = "sandbox";
  readonly target = "test";
  readonly commands: string[] = [];
  readonly downloads: string[] = [];

  async run(command: string): Promise<SandboxExecResult> {
    this.commands.push(command);
    return ok();
  }

  async upload(): Promise<void> {}
  async download(_remotePath: string, localPath: string): Promise<void> {
    this.downloads.push(localPath);
    await writeFile(localPath, "artifact-content", "utf8");
  }
  async dispose(): Promise<void> {}
}

function ok(): SandboxExecResult {
  return { exitCode: 0, stdout: "", stderr: "", timedOut: false };
}
