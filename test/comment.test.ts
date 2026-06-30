import { describe, expect, test } from "bun:test";
import { renderBaselineComment } from "../src/domain/comment";

describe("baseline comment rendering", () => {
  test("reports evidence without claiming issue-specific reproduction", () => {
    const body = renderBaselineComment({
      result: "baseline_failed",
      repositoryFullName: "maintainer/demo",
      commitSha: "abc123",
      packageManager: "bun",
      sandbox: {
        id: "sandbox-1",
        target: "us",
        runtime: "daytona",
      },
      errorMessage: "bun test failed with exit code 1",
      commands: [
        {
          sequence: 1,
          phase: "install",
          command: "bun install",
          cwd: "repo",
          startedAt: new Date("2026-06-30T00:00:00Z"),
          finishedAt: new Date("2026-06-30T00:00:01Z"),
          durationMs: 1000,
          exitCode: 0,
          timedOut: false,
          stdoutExcerpt: "installed",
          stderrExcerpt: "",
        },
        {
          sequence: 2,
          phase: "test",
          command: "bun test",
          cwd: "repo",
          startedAt: new Date("2026-06-30T00:00:02Z"),
          finishedAt: new Date("2026-06-30T00:00:03Z"),
          durationMs: 1000,
          exitCode: 1,
          timedOut: false,
          stdoutExcerpt: "expected true to be false",
          stderrExcerpt: "",
        },
      ],
    });

    expect(body).toContain("Status: Baseline failed");
    expect(body).toContain("- Commit: abc123");
    expect(body).toContain("- Package manager: bun");
    expect(body).toContain("- Runtime: daytona");
    expect(body).toContain("`bun test` -> failed with exit code 1");
    expect(body).toContain("- Exit code: 1");
    expect(body).toContain("expected true to be false");
    expect(body).toContain("did not attempt issue-specific reproduction");
    expect(body).not.toContain("AI");
    expect(body).not.toContain("reproduced the bug");
  });
});
