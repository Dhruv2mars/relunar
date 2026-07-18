import { describe, expect, test } from "bun:test";
import { agentNextStep, isFinalizedRepro, renderMarkdownReport } from "../src/reports";
import type { RunReport } from "../src/types";

describe("reports", () => {
  test("renders compact markdown with issue body and failed command excerpt", () => {
    const report: RunReport = {
      runId: "issue-1-demo",
      status: "baseline_failed",
      issue: {
        number: 1,
        title: "Broken test",
        body: "Steps: run bun test",
        state: "open",
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
      nextStep: "Baseline failed before probing.",
      startedAt: "2026-01-01T00:00:00.000Z",
      finishedAt: "2026-01-01T00:00:01.000Z",
    };

    const markdown = renderMarkdownReport(report, 2);
    expect(markdown).toContain("Status: Baseline failed");
    expect(markdown).toContain("Evidence: environment baseline only");
    expect(markdown).toContain("Steps: run bun test");
    expect(markdown).toContain("- bun test: failed (1)");
    expect(markdown).toContain("line 2\nline 3");
    expect(markdown).not.toContain("line 1\nline 2\nline 3");
  });

  test("allows comments only for finalized issue-specific evidence", () => {
    const report: RunReport = {
      runId: "issue-2-demo",
      status: "reproduced",
      issue: { number: 2, title: "Crash", body: "Run repro.ts", state: "open", url: "https://github.com/owner/repo/issues/2" },
      repo: "owner/repo",
      commit: "abc123",
      sandbox: { provider: "daytona", id: "sandbox-2", target: "us" },
      commands: [{ name: "repro", command: "bun repro.ts", status: "failed", exitCode: 1, durationMs: 10, stdout: "crash", stderr: "" }],
      failure: null,
      summary: "Compiler crashes with supplied source.",
      nextStep: "Run finalized as reproduced. Sandbox disposed.",
      startedAt: "2026-01-01T00:00:00.000Z",
      finishedAt: "2026-01-01T00:00:01.000Z",
    };

    expect(isFinalizedRepro(report)).toBe(true);
    expect(renderMarkdownReport(report, 20)).toContain("Evidence: issue-specific commands captured");
    expect(isFinalizedRepro({ ...report, status: "environment_ready" })).toBe(false);
    expect(isFinalizedRepro({ ...report, commands: [] })).toBe(false);
  });

  test("environment_ready nextStep says probing is still required", () => {
    const ready: RunReport = {
      runId: "issue-3-demo",
      status: "environment_ready",
      issue: { number: 3, title: "Bug", body: "Reproduce with fixture", state: "open", url: "https://github.com/owner/repo/issues/3" },
      repo: "owner/repo",
      commit: "abc123",
      sandbox: { provider: "daytona", id: "sandbox-3", target: "us" },
      commands: [{ name: "baseline", command: "bun test", status: "passed", exitCode: 0, durationMs: 5, stdout: "ok", stderr: "" }],
      failure: null,
      nextStep: "",
      startedAt: "2026-01-01T00:00:00.000Z",
      finishedAt: "2026-01-01T00:00:01.000Z",
    };

    expect(agentNextStep(ready)).toContain("not reproduced");
    expect(agentNextStep(ready)).toContain("issue.body");
    expect(renderMarkdownReport({ ...ready, nextStep: agentNextStep(ready) }, 20)).toContain("not reproduced — probing still required");

    const probed = {
      ...ready,
      commands: [
        ...ready.commands,
        { name: "repro" as const, command: "bun repro.ts", status: "failed" as const, exitCode: 1, durationMs: 10, stdout: "crash", stderr: "" },
      ],
    };
    expect(agentNextStep(probed)).toContain("Probe evidence recorded");
    expect(agentNextStep(probed)).toContain("not a final outcome");
  });
});
