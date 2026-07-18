import { describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { isExcluded, listWorktreeFiles, syncWorktree } from "../src/sync";
import type { SandboxExecResult, SandboxSession } from "../src/types";

describe("worktree sync", () => {
  test("lists tracked files and excludes prefixes", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "relunar-sync-list-"));
    try {
      execFileSync("git", ["init"], { cwd });
      await writeFile(join(cwd, "src.ts"), "export {}\n", "utf8");
      await mkdir(join(cwd, "node_modules", "pkg"), { recursive: true });
      await writeFile(join(cwd, "node_modules", "pkg", "index.js"), "module.exports = {}\n", "utf8");
      execFileSync("git", ["add", "src.ts"], { cwd });
      const files = await listWorktreeFiles(cwd, false, ["node_modules", ".git"]);
      expect(files).toContain("src.ts");
      expect(files.some((file) => file.includes("node_modules"))).toBe(false);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  test("isExcluded matches path prefixes", () => {
    expect(isExcluded("node_modules/foo", ["node_modules"])).toBe(true);
    expect(isExcluded("src/node_modules/foo", ["node_modules"])).toBe(true);
    expect(isExcluded("src/main.ts", ["node_modules"])).toBe(false);
  });

  test("syncWorktree uploads archive and extracts into repo/", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "relunar-sync-run-"));
    try {
      execFileSync("git", ["init"], { cwd });
      await writeFile(join(cwd, "probe.sh"), "echo hi\n", "utf8");
      execFileSync("git", ["add", "probe.sh"], { cwd });

      const sandbox = new RecordingSandbox();
      const result = await syncWorktree({
        cwd,
        sandbox,
        includeUntracked: false,
        exclude: ["node_modules"],
        timeoutSeconds: 30,
      });

      expect(result.fileCount).toBe(1);
      expect(result.archiveBytes).toBeGreaterThan(0);
      expect(sandbox.uploads).toHaveLength(1);
      expect(sandbox.uploads[0]?.remotePath).toBe("/tmp/relunar-worktree-sync.tgz");
      expect(sandbox.commands.some((command) => command.includes("tar -xzf"))).toBe(true);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

class RecordingSandbox implements SandboxSession {
  readonly id = "sandbox-sync";
  readonly target = "test";
  readonly uploads: Array<{ localPath: string; remotePath: string }> = [];
  readonly commands: string[] = [];

  async run(command: string): Promise<SandboxExecResult> {
    this.commands.push(command);
    return { exitCode: 0, stdout: "", stderr: "", timedOut: false };
  }

  async upload(localPath: string, remotePath: string): Promise<void> {
    this.uploads.push({ localPath, remotePath });
  }

  async dispose(): Promise<void> {}
}
