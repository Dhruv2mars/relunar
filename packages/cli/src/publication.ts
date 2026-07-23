import { renderMarkdownReport } from "./reports";
import { readRun, withRunLock, writeRun } from "./runs";
import type { RepoSlug, RunReport } from "./types";

export type IssueCommentPublisher = {
  createComment(repo: RepoSlug, issueNumber: number, body: string): Promise<string>;
  findComment(repo: RepoSlug, issueNumber: number, marker: string): Promise<string | null>;
};

export async function previewPublication(cwd: string, runId: string, maxLogLines: number): Promise<string> {
  const report = await readRun(cwd, runId);
  assertPublishable(report);
  return renderMarkdownReport(report, maxLogLines);
}

export async function publishRunComment(
  cwd: string,
  runId: string,
  publisher: IssueCommentPublisher,
  maxLogLines: number,
): Promise<RunReport> {
  return withRunLock(cwd, runId, async () => {
    const report = await readRun(cwd, runId);
    assertPublishable(report);
    if (report.publication?.status === "posted") return report;

    const attempts = (report.publication?.attempts ?? 0) + 1;
    report.publication = {
      status: "pending",
      attempts,
      commentUrl: null,
      error: null,
      updatedAt: new Date().toISOString(),
    };
    await writeRun(cwd, report, maxLogLines);

    const marker = `<!-- relunar-run:${report.runId} -->`;
    try {
      const existingUrl = await publisher.findComment(
        report.repo,
        report.issue.number,
        marker,
      );
      const commentUrl = existingUrl ?? await publisher.createComment(
        report.repo,
        report.issue.number,
        `${renderMarkdownReport(report, maxLogLines)}\n${marker}\n`,
      );
      report.publication = {
        status: "posted",
        attempts,
        commentUrl,
        error: null,
        updatedAt: new Date().toISOString(),
      };
      await writeRun(cwd, report, maxLogLines);
      return report;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      report.publication = {
        status: "failed",
        attempts,
        commentUrl: null,
        error: message,
        updatedAt: new Date().toISOString(),
      };
      await writeRun(cwd, report, maxLogLines);
      throw error;
    }
  });
}

function assertPublishable(report: RunReport): void {
  if (report.status !== "reproduced" && report.status !== "not_reproduced") {
    throw new Error(`Run ${report.runId} is not publishable: status is ${report.status}.`);
  }
  if (report.trust !== "verified") {
    throw new Error("Unverified runs cannot be posted to GitHub.");
  }
  const required = [
    ["summary", report.summary],
    ["repro steps", report.reproSteps],
    ["observed behavior", report.observed],
    ["expected behavior", report.expected],
    ["environment", report.environmentNotes],
  ] as const;
  const missing = required.filter(([, value]) => !value?.trim()).map(([name]) => name);
  if (missing.length > 0) {
    throw new Error(`Run has incomplete maintainer narrative: missing ${missing.join(", ")}.`);
  }
}
