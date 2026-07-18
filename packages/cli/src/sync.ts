import { execFile } from "node:child_process";
import { access, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import type { SandboxSession } from "./types";

type FsStat = Awaited<ReturnType<typeof stat>>;

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
  const files = await listWorktreeFiles(options.cwd, options.includeUntracked, exclude);
  const deleted = await listDeletedTrackedFiles(options.cwd, exclude);
  const stale = (options.previouslySyncedPaths ?? []).filter((path) => !files.includes(path) && !deleted.includes(path));
  const remoteTracked = await listRemoteTrackedFiles(options.sandbox, options.timeoutSeconds);
  const remoteOnly = remoteTracked.filter((path) => !files.includes(path) && !isExcluded(path, exclude));
  const removed = [...new Set([...deleted, ...stale, ...remoteOnly])].sort();

  if (files.length === 0 && removed.length === 0) {
    return { fileCount: 0, deletedCount: 0, archiveBytes: 0, syncedPaths: [] };
  }

  // Clear remote-only / deleted / stale paths and present paths before extract so
  // file↔directory swaps succeed even when leftover files keep a remote directory alive.
  const remoteClear = [...new Set([...removed, ...files])].sort();
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

async function listRemoteTrackedFiles(sandbox: SandboxSession, timeoutSeconds: number): Promise<string[]> {
  const result = await sandbox.run("git ls-files -z", "repo", timeoutSeconds);
  if (result.exitCode !== 0) {
    // Fresh/broken clones may not have a git index yet; treat as empty.
    return [];
  }
  return result.stdout
    .split("\0")
    .map((path) => path.trim())
    .filter((path) => path.length > 0);
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
  const candidates = stdout
    .split("\0")
    .map((path) => path.trim())
    .filter((path) => path.length > 0 && !isExcluded(path, exclude));

  const present: string[] = [];
  for (const path of candidates) {
    if (await pathExists(join(cwd, path))) {
      present.push(path);
    }
  }
  return present;
}

/**
 * Files present in HEAD but absent from the worktree (unstaged `rm` or staged `git rm`).
 * Prefer diff-against-HEAD so staged removals are included; `ls-files --deleted` only
 * covers unstaged deletions still listed in the index.
 */
export async function listDeletedTrackedFiles(cwd: string, exclude: string[]): Promise<string[]> {
  const paths = new Set<string>();
  const commands = [
    ["-C", cwd, "diff", "--name-only", "-z", "--diff-filter=D", "HEAD"],
    ["-C", cwd, "ls-files", "-z", "--deleted"],
  ];
  for (const args of commands) {
    try {
      const { stdout } = await execFileAsync("git", args, {
        encoding: "utf8",
        maxBuffer: 32 * 1024 * 1024,
      });
      for (const path of stdout.split("\0")) {
        const trimmed = path.trim();
        if (trimmed.length > 0 && !isExcluded(trimmed, exclude)) {
          paths.add(trimmed);
        }
      }
    } catch (error) {
      // No HEAD (empty repo) — fall through; ls-files --deleted still applies.
      if (!isNoHeadError(error)) {
        throw error;
      }
    }
  }

  // Skip only when a regular file still exists (`git rm --cached`).
  // Absent paths and file→directory swaps still need remote removal.
  const deleted: string[] = [];
  for (const path of [...paths].sort()) {
    if (!(await isPresentFile(join(cwd, path)))) {
      deleted.push(path);
    }
  }
  return deleted;
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

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function isPresentFile(path: string): Promise<boolean> {
  try {
    const info: FsStat = await stat(path);
    return info.isFile();
  } catch {
    return false;
  }
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'\\''`)}'`;
}
