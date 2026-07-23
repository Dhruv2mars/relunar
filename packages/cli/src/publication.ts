import { renderMarkdownReport } from "./reports";
import { readRun, withRunLock, writeRun } from "./runs";
import type { RepoSlug, RunReport } from "./types";

export type IssueCommentPublisher = {
  createComment(repo: RepoSlug, issueNumber: number, body: string): Promise<string>;
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

    try {
      const commentUrl = await publisher.createComment(
        report.repo,
        report.issue.number,
        renderMarkdownReport(report, maxLogLines),
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
  if (!report.summary?.trim()) {
    throw new Error("Run has no maintainer summary.");
  }
}
