import { describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { isExcluded, listDeletedTrackedFiles, listWorktreeFiles, syncWorktree } from "../src/sync";
import type { SandboxExecResult, SandboxSession } from "../src/types";

describe("worktree sync", () => {
  test("lists tracked files and excludes prefixes", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "relunar-sync-list-"));
    try {
      initRepo(cwd);
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
      initRepo(cwd);
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
      expect(result.deletedCount).toBe(0);
      expect(result.archiveBytes).toBeGreaterThan(0);
      expect(sandbox.uploads).toHaveLength(1);
      expect(sandbox.uploads[0]?.remotePath).toBe("/tmp/relunar-worktree-sync.tgz");
      expect(sandbox.commands.some((command) => command.includes("tar -xzf"))).toBe(true);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  test("syncWorktree removes unstaged deleted tracked files remotely", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "relunar-sync-delete-"));
    try {
      initRepo(cwd);
      await writeFile(join(cwd, "keep.ts"), "keep\n", "utf8");
      await writeFile(join(cwd, "gone.ts"), "gone\n", "utf8");
      execFileSync("git", ["add", "keep.ts", "gone.ts"], { cwd });
      commit(cwd, "init");
      await rm(join(cwd, "gone.ts"));

      expect(await listDeletedTrackedFiles(cwd, [])).toEqual(["gone.ts"]);
      expect(await listWorktreeFiles(cwd, false, [])).toEqual(["keep.ts"]);

      const sandbox = new RecordingSandbox();
      const result = await syncWorktree({
        cwd,
        sandbox,
        includeUntracked: false,
        exclude: [],
        timeoutSeconds: 30,
      });

      expect(result.fileCount).toBe(1);
      expect(result.deletedCount).toBe(1);
      expect(sandbox.commands.some((command) => command.includes("rm -f") && command.includes("repo/gone.ts"))).toBe(true);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  test("does not treat git rm --cached as a remote deletion", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "relunar-sync-cached-"));
    try {
      initRepo(cwd);
      await writeFile(join(cwd, "kept-on-disk.ts"), "still here\n", "utf8");
      execFileSync("git", ["add", "kept-on-disk.ts"], { cwd });
      commit(cwd, "init");
      execFileSync("git", ["rm", "--cached", "kept-on-disk.ts"], { cwd });

      expect(await listDeletedTrackedFiles(cwd, [])).toEqual([]);
      expect(await listWorktreeFiles(cwd, true, [])).toContain("kept-on-disk.ts");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  test("syncWorktree removes staged git rm deletions remotely", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "relunar-sync-gitrm-"));
    try {
      initRepo(cwd);
      await writeFile(join(cwd, "keep.ts"), "keep\n", "utf8");
      await writeFile(join(cwd, "staged-gone.ts"), "gone\n", "utf8");
      execFileSync("git", ["add", "keep.ts", "staged-gone.ts"], { cwd });
      commit(cwd, "init");
      execFileSync("git", ["rm", "staged-gone.ts"], { cwd });

      expect(await listDeletedTrackedFiles(cwd, [])).toEqual(["staged-gone.ts"]);
      expect(await listWorktreeFiles(cwd, false, [])).toEqual(["keep.ts"]);

      const sandbox = new RecordingSandbox();
      const result = await syncWorktree({
        cwd,
        sandbox,
        includeUntracked: false,
        exclude: [],
        timeoutSeconds: 30,
      });

      expect(result.deletedCount).toBe(1);
      expect(sandbox.commands.some((command) => command.includes("rm -f") && command.includes("repo/staged-gone.ts"))).toBe(true);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

function commit(cwd: string, message: string): void {
  execFileSync("git", ["-c", "user.email=test@example.com", "-c", "user.name=Test", "commit", "-m", message], { cwd });
}

function initRepo(cwd: string): void {
  execFileSync("git", ["init"], { cwd });
}

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
