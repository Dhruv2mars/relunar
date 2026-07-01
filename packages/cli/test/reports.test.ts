import { describe, expect, test } from "bun:test";
import { renderMarkdownReport } from "../src/reports";
import type { RunReport } from "../src/types";

describe("reports", () => {
  test("renders compact markdown with failed command excerpt", () => {
    const report: RunReport = {
      runId: "issue-1-demo",
      status: "baseline_failed",
      issue: {
        number: 1,
        title: "Broken test",
        url: "https://github.com/owner/repo/issues/1",
      },
      repo: "owner/repo",
      commit: "abc123",
      sandbox: {
        provider: "daytona",
        id: "sandbox-1",
        target: "us",
      },
      commands: [
        {
          name: "baseline",
          command: "bun test",
          status: "failed",
          exitCode: 1,
          durationMs: 20,
          stdout: "line 1\nline 2\nline 3",
          stderr: "",
        },
      ],
      failure: "bun test failed",
      startedAt: "2026-01-01T00:00:00.000Z",
      finishedAt: "2026-01-01T00:00:01.000Z",
    };

    const markdown = renderMarkdownReport(report, 2);
    expect(markdown).toContain("Status: Baseline failed");
    expect(markdown).toContain("- bun test: failed (1)");
    expect(markdown).toContain("line 2\nline 3");
    expect(markdown).not.toContain("line 1\nline 2\nline 3");
  });
});
