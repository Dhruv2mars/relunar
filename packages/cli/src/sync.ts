import { execFile } from "node:child_process";
import { access, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
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
};

export type SyncResult = {
  fileCount: number;
  deletedCount: number;
  archiveBytes: number;
};

const DEFAULT_EXCLUDE = ["node_modules", ".git", ".relunar", "target", "dist", ".e2e-reports", ".agent-logs"];

/** Sync dirty local worktree into sandbox `repo/`: overlay present files and remove deletions. */
export async function syncWorktree(options: SyncOptions): Promise<SyncResult> {
  const exclude = options.exclude.length > 0 ? options.exclude : DEFAULT_EXCLUDE;
  const files = await listWorktreeFiles(options.cwd, options.includeUntracked, exclude);
  const deleted = await listDeletedTrackedFiles(options.cwd, exclude);

  if (files.length === 0 && deleted.length === 0) {
    return { fileCount: 0, deletedCount: 0, archiveBytes: 0 };
  }

  let archiveBytes = 0;
  if (files.length > 0) {
    archiveBytes = await uploadAndExtract(options, files);
  }

  if (deleted.length > 0) {
    await removeRemotePaths(options.sandbox, deleted, options.timeoutSeconds);
  }

  return { fileCount: files.length, deletedCount: deleted.length, archiveBytes };
}

async function uploadAndExtract(options: SyncOptions, files: string[]): Promise<number> {
  const tempDir = await mkdtemp(join(tmpdir(), "relunar-sync-"));
  const listPath = join(tempDir, "files.txt");
  const archivePath = join(tempDir, "worktree.tgz");
  try {
    await writeFile(listPath, `${files.join("\n")}\n`, "utf8");
    await execFileAsync("tar", ["-czf", archivePath, "-C", options.cwd, "-T", listPath], {
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

async function removeRemotePaths(sandbox: SandboxSession, paths: string[], timeoutSeconds: number): Promise<void> {
  // Batch deletes to avoid giant command lines; paths are shell-quoted.
  const batchSize = 50;
  for (let index = 0; index < paths.length; index += batchSize) {
    const batch = paths.slice(index, index + batchSize);
    const quoted = batch.map((path) => shellQuote(`repo/${path}`)).join(" ");
    const result = await sandbox.run(`rm -f ${quoted}`, ".", timeoutSeconds);
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
  return [...paths].sort();
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

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'\\''`)}'`;
}
