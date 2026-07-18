import { describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import {
  isExcluded,
  listDeletedTrackedFiles,
  listGitlinkPaths,
  listWorktreeFiles,
  mergeExclude,
  parseNameStatusRemovals,
  syncWorktree,
} from "../src/sync";
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

  test("mergeExclude keeps built-ins when config adds paths", () => {
    const merged = mergeExclude(["coverage"]);
    expect(merged).toContain("node_modules");
    expect(merged).toContain(".relunar");
    expect(merged).toContain("coverage");
  });

  test("keeps tracked dangling symlinks in the sync upload set", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "relunar-sync-symlink-"));
    try {
      initRepo(cwd);
      await symlink("missing-target", join(cwd, "link"));
      execFileSync("git", ["add", "link"], { cwd });
      commit(cwd, "init");

      expect(await listWorktreeFiles(cwd, false, [])).toEqual(["link"]);
      expect(await listDeletedTrackedFiles(cwd, [])).toEqual([]);

      const sandbox = new RecordingSandbox();
      const result = await syncWorktree({
        cwd,
        sandbox,
        includeUntracked: false,
        exclude: [],
        timeoutSeconds: 30,
      });
      expect(result.syncedPaths).toContain("link");
      expect(result.fileCount).toBe(1);
      expect(sandbox.uploads).toHaveLength(1);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  test("does not delete submodule gitlink directories from the sandbox", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "relunar-sync-submodule-"));
    try {
      initRepo(cwd);
      await writeFile(join(cwd, "keep.ts"), "keep\n", "utf8");
      execFileSync("git", ["add", "keep.ts"], { cwd });
      commit(cwd, "init");
      // Simulate a gitlink entry without a full submodule clone.
      execFileSync("git", ["update-index", "--add", "--cacheinfo", "160000", "0123456789abcdef0123456789abcdef01234567", "vendor/lib"], { cwd });
      expect((await listGitlinkPaths(cwd)).has("vendor/lib")).toBe(true);

      const sandbox = new RecordingSandbox();
      await syncWorktree({
        cwd,
        sandbox,
        includeUntracked: false,
        exclude: [],
        timeoutSeconds: 30,
      });
      expect(sandbox.commands.some((command) => command.includes("rm -rf") && command.includes("repo/vendor/lib"))).toBe(false);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  test("removes rename source paths after git mv", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "relunar-sync-rename-"));
    try {
      initRepo(cwd);
      await writeFile(join(cwd, "old.ts"), "export {}\n", "utf8");
      execFileSync("git", ["add", "old.ts"], { cwd });
      commit(cwd, "init");
      execFileSync("git", ["mv", "old.ts", "new.ts"], { cwd });

      expect(await listDeletedTrackedFiles(cwd, [])).toEqual(["old.ts"]);
      expect(parseNameStatusRemovals("R100\0old.ts\0new.ts\0")).toEqual(["old.ts"]);

      const sandbox = new RecordingSandbox();
      await syncWorktree({
        cwd,
        sandbox,
        includeUntracked: false,
        exclude: [],
        timeoutSeconds: 30,
      });

      expect(sandbox.commands.some((command) => command.includes("rm -rf") && command.includes("repo/old.ts"))).toBe(true);
      expect(sandbox.commands.some((command) => command.includes("rm -rf") && command.includes("repo/new.ts"))).toBe(true);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  test("does not delete sandbox files omitted by sparse checkout", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "relunar-sync-sparse-"));
    try {
      initRepo(cwd);
      await mkdir(join(cwd, "src"), { recursive: true });
      await writeFile(join(cwd, "keep.ts"), "keep\n", "utf8");
      await writeFile(join(cwd, "src", "deep.ts"), "deep\n", "utf8");
      execFileSync("git", ["add", "keep.ts", "src/deep.ts"], { cwd });
      commit(cwd, "init");
      execFileSync("git", ["sparse-checkout", "init", "--cone"], { cwd });
      execFileSync("git", ["sparse-checkout", "set", "."], { cwd });
      // Cone root keeps top-level files; src/deep.ts is absent locally but still tracked.
      expect(await listDeletedTrackedFiles(cwd, [])).not.toContain("src/deep.ts");

      const sandbox = new RecordingSandbox();
      await syncWorktree({
        cwd,
        sandbox,
        includeUntracked: false,
        exclude: [],
        timeoutSeconds: 30,
      });

      expect(sandbox.commands.some((command) => command.includes("rm -rf") && command.includes("repo/src/deep.ts"))).toBe(false);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  test("removes previously synced paths that disappeared locally", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "relunar-sync-stale-"));
    try {
      initRepo(cwd);
      await writeFile(join(cwd, "keep.ts"), "keep\n", "utf8");
      execFileSync("git", ["add", "keep.ts"], { cwd });
      commit(cwd, "init");

      const sandbox = new RecordingSandbox();
      await syncWorktree({
        cwd,
        sandbox,
        includeUntracked: true,
        exclude: [],
        timeoutSeconds: 30,
        previouslySyncedPaths: ["keep.ts", "stale-untracked.ts"],
      });

      expect(sandbox.commands.some((command) => command.includes("rm -rf") && command.includes("repo/stale-untracked.ts"))).toBe(true);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  test("syncWorktree uploads archive and extracts into repo/", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "relunar-sync-run-"));
    try {
      initRepo(cwd);
      await writeFile(join(cwd, "probe.sh"), "echo hi\n", "utf8");
      await writeFile(join(cwd, "--dash.txt"), "dash\n", "utf8");
      execFileSync("git", ["add", "probe.sh", "--", "--dash.txt"], { cwd });

      const sandbox = new RecordingSandbox();
      const result = await syncWorktree({
        cwd,
        sandbox,
        includeUntracked: false,
        exclude: ["node_modules"],
        timeoutSeconds: 30,
      });

      expect(result.fileCount).toBe(2);
      expect(result.deletedCount).toBe(0);
      expect(result.archiveBytes).toBeGreaterThan(0);
      expect(sandbox.uploads).toHaveLength(1);
      expect(sandbox.uploads[0]?.remotePath).toBe("/tmp/relunar-worktree-sync.tgz");
      expect(sandbox.commands.some((command) => command.includes("tar -xzf"))).toBe(true);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  test("syncWorktree deletes remote paths before extract for file-to-directory swaps", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "relunar-sync-swap-"));
    try {
      initRepo(cwd);
      await writeFile(join(cwd, "foo"), "file\n", "utf8");
      execFileSync("git", ["add", "foo"], { cwd });
      commit(cwd, "init");
      await rm(join(cwd, "foo"));
      await mkdir(join(cwd, "foo"), { recursive: true });
      await writeFile(join(cwd, "foo", "bar.ts"), "export {}\n", "utf8");
      execFileSync("git", ["add", "-A"], { cwd });

      const sandbox = new RecordingSandbox();
      await syncWorktree({
        cwd,
        sandbox,
        includeUntracked: false,
        exclude: [],
        timeoutSeconds: 30,
      });

      const deleteIndex = sandbox.commands.findIndex((command) => command.includes("rm -rf") && command.includes("repo/foo"));
      const extractIndex = sandbox.commands.findIndex((command) => command.includes("tar -xzf"));
      expect(deleteIndex).toBeGreaterThanOrEqual(0);
      expect(extractIndex).toBeGreaterThan(deleteIndex);
      // Present paths are cleared too (directory→file / leftover dir contents).
      expect(sandbox.commands.some((command) => command.includes("rm -rf") && command.includes("repo/foo/bar.ts"))).toBe(true);
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
      expect(sandbox.commands.some((command) => command.includes("rm -rf") && command.includes("repo/gone.ts"))).toBe(true);
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

      const sandbox = new RecordingSandbox();
      await syncWorktree({
        cwd,
        sandbox,
        includeUntracked: false,
        exclude: [],
        timeoutSeconds: 30,
      });
      expect(sandbox.commands.some((command) => command.includes("rm -rf") && command.includes("repo/kept-on-disk.ts"))).toBe(false);
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
      expect(sandbox.commands.some((command) => command.includes("rm -rf") && command.includes("repo/staged-gone.ts"))).toBe(true);
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
