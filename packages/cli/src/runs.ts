import { mkdir, readdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { renderMarkdownReport } from "./reports";
import { reclaimDeadLock, tryCreateOwnedLock } from "./locks";
import type { CommandEvidence, RepoSlug, RunReport } from "./types";

export function runStoreDir(cwd: string): string {
  return join(cwd, ".relunar", "runs");
}

export function createRunId(issueNumber: number, now = new Date()): string {
  const stamp = now.toISOString().replaceAll(":", "").replaceAll(".", "");
  return `issue-${issueNumber}-${stamp}`;
}

export async function writeRun(cwd: string, report: RunReport, maxLogLines: number): Promise<string> {
  const dir = join(runStoreDir(cwd), report.runId);
  await mkdir(dir, { recursive: true });
  await Promise.all([
    atomicWrite(join(dir, "report.json"), `${JSON.stringify(report, null, 2)}\n`),
    atomicWrite(join(dir, "report.md"), renderMarkdownReport(report, maxLogLines)),
    atomicWrite(join(dir, "logs.txt"), renderLogs(report.commands)),
  ]);
  return dir;
}

export async function updateRun(
  cwd: string,
  runId: string,
  maxLogLines: number,
  mutate: (report: RunReport) => RunReport | Promise<RunReport>,
): Promise<RunReport> {
  return withRunLock(cwd, runId, async () => {
    const next = await mutate(await readRun(cwd, runId));
    await writeRun(cwd, next, maxLogLines);
    return next;
  });
}

export async function withRunLock<T>(cwd: string, runId: string, action: () => Promise<T>): Promise<T> {
  const release = await acquireRunLock(cwd, runId);
  try {
    return await action();
  } finally {
    await release();
  }
}

export async function listRuns(cwd: string): Promise<RunReport[]> {
  const dir = runStoreDir(cwd);
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }

  const reports = await Promise.all(
    entries.map(async (entry) => {
      const raw = await readFile(join(dir, entry, "report.json"), "utf8");
      return JSON.parse(raw) as RunReport;
    }),
  );

  return reports.sort((left, right) => right.startedAt.localeCompare(left.startedAt));
}

export async function readRun(cwd: string, runId: string): Promise<RunReport> {
  const path = join(runStoreDir(cwd), runId, "report.json");
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch (error) {
    if (isNotFound(error)) {
      throw new Error(`Run not found: ${runId}`);
    }
    throw error;
  }

  try {
    return migrateRun(JSON.parse(raw) as RunReport);
  } catch {
    throw new Error(`Run report is corrupt: ${runId}`);
  }
}

function migrateRun(report: RunReport): RunReport {
  return {
    ...report,
    schemaVersion: 2,
    trust: report.trust ?? "unverified",
  };
}

async function atomicWrite(path: string, contents: string): Promise<void> {
  const temp = `${path}.tmp-${randomUUID()}`;
  try {
    await writeFile(temp, contents, "utf8");
    await rename(temp, path);
  } finally {
    await unlink(temp).catch(() => undefined);
  }
}

async function acquireRunLock(cwd: string, runId: string): Promise<() => Promise<void>> {
  const dir = join(runStoreDir(cwd), runId);
  await mkdir(dir, { recursive: true });
  const path = join(dir, "run.lock");
  const deadline = Date.now() + 30_000;
  while (true) {
    if (await tryCreateOwnedLock(path)) {
      return async () => {
        await unlink(path).catch(() => undefined);
      };
    }
    if (await reclaimDeadLock(path)) continue;
    if (Date.now() >= deadline) throw new Error(`Timed out waiting for run lock: ${runId}`);
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

export async function findActiveRunForIssue(cwd: string, issueNumber: number, repo: RepoSlug): Promise<RunReport | null> {
  const runs = await listRuns(cwd);
  return (
    runs.find(
      (run) => run.issue.number === issueNumber && run.repo === repo && run.status === "environment_ready",
    ) ?? null
  );
}

function renderLogs(commands: CommandEvidence[]): string {
  return commands
    .map((command) => {
      const parts = [
        `$ ${command.command}`,
        `status=${command.status} exitCode=${command.exitCode ?? "null"} durationMs=${command.durationMs}`,
      ];
      if (command.stdout) {
        parts.push("stdout:", command.stdout);
      }
      if (command.stderr) {
        parts.push("stderr:", command.stderr);
      }
      return parts.join("\n");
    })
    .join("\n\n");
}

function isNotFound(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}
