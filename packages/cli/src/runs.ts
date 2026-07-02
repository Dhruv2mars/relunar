import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { renderMarkdownReport } from "./reports";
import type { CommandEvidence, RunReport } from "./types";

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
  await writeFile(join(dir, "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await writeFile(join(dir, "report.md"), renderMarkdownReport(report, maxLogLines), "utf8");
  await writeFile(join(dir, "logs.txt"), renderLogs(report.commands), "utf8");
  return dir;
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
    return JSON.parse(raw) as RunReport;
  } catch {
    throw new Error(`Run report is corrupt: ${runId}`);
  }
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
