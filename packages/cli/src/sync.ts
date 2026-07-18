import { execFile } from "node:child_process";
import { mkdtemp, rm, stat, writeFile } from "node:fs/promises";
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
  archiveBytes: number;
};

const DEFAULT_EXCLUDE = ["node_modules", ".git", ".relunar", "target", "dist", ".e2e-reports", ".agent-logs"];

/** Sync dirty local worktree files into sandbox `repo/` via tar upload + extract. */
export async function syncWorktree(options: SyncOptions): Promise<SyncResult> {
  const exclude = options.exclude.length > 0 ? options.exclude : DEFAULT_EXCLUDE;
  const files = await listWorktreeFiles(options.cwd, options.includeUntracked, exclude);
  if (files.length === 0) {
    return { fileCount: 0, archiveBytes: 0 };
  }

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
    return { fileCount: files.length, archiveBytes: size };
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

export async function listWorktreeFiles(cwd: string, includeUntracked: boolean, exclude: string[]): Promise<string[]> {
  const args = ["-C", cwd, "ls-files", "-z", "--cached"];
  if (includeUntracked) {
    args.push("--others", "--exclude-standard");
  }
  const { stdout } = await execFileAsync("git", args, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
  return stdout
    .split("\0")
    .map((path) => path.trim())
    .filter((path) => path.length > 0 && !isExcluded(path, exclude));
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

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'\\''`)}'`;
}
