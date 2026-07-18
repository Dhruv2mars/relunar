import { execFile } from "node:child_process";
import { lstat, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import type { SandboxSession } from "./types";

const execFileAsync = promisify(execFile);

export type SyncOptions = {
  cwd: string;
  sandbox: SandboxSession;
  includeUntracked: boolean;
  exclude: string[];
  timeoutSeconds: number;
  /** Paths from a prior sync that should be removed if no longer present locally. */
  previouslySyncedPaths?: string[] | undefined;
};

export type SyncResult = {
  fileCount: number;
  deletedCount: number;
  archiveBytes: number;
  /** Present local paths uploaded this sync (for the next sync manifest). */
  syncedPaths: string[];
};

export const DEFAULT_SYNC_EXCLUDE = ["node_modules", ".git", ".relunar", "target", "dist", ".e2e-reports", ".agent-logs"];

/** Sync dirty local worktree into sandbox `repo/`: overlay present files and remove deletions. */
export async function syncWorktree(options: SyncOptions): Promise<SyncResult> {
  const exclude = mergeExclude(options.exclude);
  const gitlinks = await listGitlinkPaths(options.cwd);
  const files = await listWorktreeFiles(options.cwd, options.includeUntracked, exclude);
  // Gitlinks without a checkout appear in `ls-files --deleted` — never treat as removals.
  const deleted = (await listDeletedTrackedFiles(options.cwd, exclude)).filter((path) => !gitlinks.has(path));
  // Prior sync-manifest paths that disappeared locally. Keep remote copies when the local
  // leaf still exists (e.g. untracked repro script uploaded earlier, later `--sync` without
  // `--include-untracked`). Do not infer removals from sandbox `git ls-files` vs local —
  // sparse/skip-worktree checkouts omit cones that still belong in the full sandbox clone.
  const stale: string[] = [];
  for (const path of options.previouslySyncedPaths ?? []) {
    if (files.includes(path) || deleted.includes(path) || gitlinks.has(path)) {
      continue;
    }
    if (await isPresentLeaf(join(options.cwd, path))) {
      continue;
    }
    stale.push(path);
  }
  const removed = [...new Set([...deleted, ...stale])].sort();

  if (files.length === 0 && removed.length === 0) {
    return { fileCount: 0, deletedCount: 0, archiveBytes: 0, syncedPaths: [] };
  }

  // Clear deleted / stale paths and present paths before extract so
  // file↔directory swaps succeed even when leftover files keep a remote directory alive.
  // Never rm -rf submodule gitlink directories.
  const remoteClear = [...new Set([...removed, ...files])].filter((path) => !gitlinks.has(path)).sort();
  if (remoteClear.length > 0) {
    await removeRemotePaths(options.sandbox, remoteClear, options.timeoutSeconds);
  }

  let archiveBytes = 0;
  if (files.length > 0) {
    archiveBytes = await uploadAndExtract(options, files);
  }

  return { fileCount: files.length, deletedCount: removed.length, archiveBytes, syncedPaths: files };
}

export function mergeExclude(configured: string[]): string[] {
  return [...new Set([...DEFAULT_SYNC_EXCLUDE, ...configured])];
}

async function uploadAndExtract(options: SyncOptions, files: string[]): Promise<number> {
  const tempDir = await mkdtemp(join(tmpdir(), "relunar-sync-"));
  const listPath = join(tempDir, "files.txt");
  const archivePath = join(tempDir, "worktree.tgz");
  try {
    // Null-terminated + --null keeps dash-leading paths (e.g. --help.txt) verbatim.
    await writeFile(listPath, `${files.join("\0")}\0`, "utf8");
    await execFileAsync("tar", ["-czf", archivePath, "-C", options.cwd, "--null", "-T", listPath], {
      maxBuffer: 32 * 1024 * 1024,
    });
    const { size } = await stat(archivePath);
    const remoteArchive = "/tmp/relunar-worktree-sync.tgz";
    await options.sandbox.upload(archivePath, remoteArchive);
    const extract = await options.sandbox.run(
      `mkdir -p repo && tar -xzf ${shellQuote(remoteArchive)} -C repo && rm -f ${shellQuote(remoteArchive)}`,
      ".",
      options.timeoutSeconds,
    );
    if (extract.exitCode !== 0) {
      throw new Error(`Worktree sync extract failed: ${extract.stderr || extract.stdout || `exit ${extract.exitCode}`}`);
    }
    return size;
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

/** Submodule gitlink paths (mode 160000) — directories that must not be rm -rf'd. */
export async function listGitlinkPaths(cwd: string): Promise<Set<string>> {
  const { stdout } = await execFileAsync("git", ["-C", cwd, "ls-files", "-z", "--stage"], {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  const links = new Set<string>();
  for (const entry of stdout.split("\0")) {
    if (!entry.startsWith("160000 ")) {
      continue;
    }
    const tab = entry.indexOf("\t");
    if (tab >= 0) {
      links.add(entry.slice(tab + 1));
    }
  }
  return links;
}

async function removeRemotePaths(sandbox: SandboxSession, paths: string[], timeoutSeconds: number): Promise<void> {
  // Batch deletes to avoid giant command lines; paths are shell-quoted.
  // Use rm -rf so a deleted file path can be replaced by a directory on extract.
  const batchSize = 50;
  for (let index = 0; index < paths.length; index += batchSize) {
    const batch = paths.slice(index, index + batchSize);
    const quoted = batch.map((path) => shellQuote(`repo/${path}`)).join(" ");
    const result = await sandbox.run(`rm -rf ${quoted}`, ".", timeoutSeconds);
    if (result.exitCode !== 0) {
      throw new Error(`Worktree sync delete failed: ${result.stderr || result.stdout || `exit ${result.exitCode}`}`);
    }
  }
}

/** Present worktree files to overlay (skips index entries missing on disk). */
export async function listWorktreeFiles(cwd: string, includeUntracked: boolean, exclude: string[]): Promise<string[]> {
  const args = ["-C", cwd, "ls-files", "-z", "--cached"];
  if (includeUntracked) {
    args.push("--others", "--exclude-standard");
  }
  const { stdout } = await execFileAsync("git", args, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
  const candidates = stdout.split("\0").filter((path) => path.length > 0 && !isExcluded(path, exclude));

  const present: string[] = [];
  for (const path of candidates) {
    // Only upload leaves. A cached path that is now a local directory must not
    // recurse into untracked children unless includeUntracked is enabled.
    if (await isPresentLeaf(join(cwd, path))) {
      present.push(path);
    }
  }
  return present;
}

/**
 * Paths that should be removed from the sandbox: deletions and rename/copy sources
 * relative to HEAD, plus unstaged `ls-files --deleted` entries.
 */
export async function listDeletedTrackedFiles(cwd: string, exclude: string[]): Promise<string[]> {
  const paths = new Set<string>();
  try {
    const { stdout } = await execFileAsync(
      "git",
      ["-C", cwd, "diff", "--name-status", "-z", "--diff-filter=DRC", "HEAD"],
      { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
    );
    for (const path of parseNameStatusRemovals(stdout)) {
      if (!isExcluded(path, exclude)) {
        paths.add(path);
      }
    }
  } catch (error) {
    // No HEAD (empty repo) — fall through; ls-files --deleted still applies.
    if (!isNoHeadError(error)) {
      throw error;
    }
  }

  try {
    const { stdout } = await execFileAsync("git", ["-C", cwd, "ls-files", "-z", "--deleted"], {
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
    });
    for (const path of stdout.split("\0")) {
      if (path.length > 0 && !isExcluded(path, exclude)) {
        paths.add(path);
      }
    }
  } catch {
    // Ignore — empty / non-git edge cases handled by caller.
  }

  // Skip when a file or symlink still exists (`git rm --cached`, dangling links).
  // Absent paths and file→directory swaps still need remote removal.
  const deleted: string[] = [];
  for (const path of [...paths].sort()) {
    if (!(await isPresentLeaf(join(cwd, path)))) {
      deleted.push(path);
    }
  }
  return deleted;
}

/** Parse `git diff --name-status -z` and collect delete/rename/copy source paths. */
export function parseNameStatusRemovals(stdout: string): string[] {
  const tokens = stdout.split("\0").filter((token) => token.length > 0);
  const paths: string[] = [];
  for (let index = 0; index < tokens.length; ) {
    const status = tokens[index] ?? "";
    index += 1;
    if (status.startsWith("R") || status.startsWith("C")) {
      const source = tokens[index];
      index += 2; // skip source + destination
      if (source) {
        paths.push(source);
      }
      continue;
    }
    if (status.startsWith("D")) {
      const path = tokens[index];
      index += 1;
      if (path) {
        paths.push(path);
      }
      continue;
    }
    // Unknown status token — skip one path field if present.
    index += 1;
  }
  return paths;
}

function isNoHeadError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  return /unknown revision|bad revision|ambiguous argument 'HEAD'|does not have any commits/i.test(error.message);
}

export function isExcluded(path: string, exclude: string[]): boolean {
  const normalized = path.replaceAll("\\", "/");
  return exclude.some((pattern) => {
    const needle = pattern.replaceAll("\\", "/").replace(/^\/+|\/+$/g, "");
    if (!needle) {
      return false;
    }
    return normalized === needle || normalized.startsWith(`${needle}/`) || normalized.includes(`/${needle}/`);
  });
}

async function isPresentLeaf(path: string): Promise<boolean> {
  try {
    const info = await lstat(path);
    return info.isFile() || info.isSymbolicLink();
  } catch {
    return false;
  }
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'\\''`)}'`;
}
