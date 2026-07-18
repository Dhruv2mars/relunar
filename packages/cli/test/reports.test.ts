import { describe, expect, test } from "bun:test";
import { agentNextStep, evidenceExcerpt, isFinalizedRepro, renderMarkdownReport } from "../src/reports";
import type { RunReport } from "../src/types";

function baseReport(overrides: Partial<RunReport> = {}): RunReport {
  return {
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
    ...overrides,
  };
}

describe("reports", () => {
  test("renders maintainer markdown without harness slop", () => {
    const report = baseReport();
    const markdown = renderMarkdownReport(report, 2);

    expect(markdown).toContain("## Repro: Baseline failed");
    expect(markdown).toContain("bun test failed");
    expect(markdown).toContain("### Observed");
    expect(markdown).toContain("line 2\nline 3");
    expect(markdown).toContain("- Repo: `owner/repo` @ `abc123`");
    expect(markdown).toContain("Artifacts: `.relunar/runs/issue-1-demo`");
    expect(markdown).not.toContain("line 1\nline 2\nline 3");
    expect(markdown).not.toContain("Next step:");
    expect(markdown).not.toContain("Sandbox:");
    expect(markdown).not.toContain("Issue body:");
    expect(markdown).not.toContain("Steps: run bun test");
    expect(markdown).not.toContain("Commands:");
  });

  test("finalized report uses agent narrative and omits invented steps", () => {
    const report = baseReport({
      runId: "issue-2-demo",
      status: "reproduced",
      issue: { number: 2, title: "Crash", body: "Run repro.ts", state: "open", url: "https://github.com/owner/repo/issues/2" },
      sandbox: { provider: "daytona", id: "sandbox-2", target: "us" },
      commands: [
        { name: "setup", command: "bun install", status: "passed", exitCode: 0, durationMs: 5, stdout: "ok", stderr: "" },
        { name: "repro", command: "bun repro.ts", status: "failed", exitCode: 1, durationMs: 10, stdout: "crash dump noise", stderr: "Error: boom" },
      ],
      failure: null,
      summary: "Compiler crashes with supplied source.",
      observed: "Error: boom",
      expected: "Compile succeeds.",
      environmentNotes: "tsc 5.9-dev\nnode 22",
      nextStep: "Run finalized as reproduced. Sandbox disposed.",
    });

    expect(isFinalizedRepro(report)).toBe(true);
    const markdown = renderMarkdownReport(report, 20);
    expect(markdown).toContain("## Repro: Reproduced");
    expect(markdown).toContain("Compiler crashes with supplied source.");
    expect(markdown).toContain("### Observed");
    expect(markdown).toContain("Error: boom");
    expect(markdown).toContain("### Expected");
    expect(markdown).toContain("Compile succeeds.");
    expect(markdown).toContain("- tsc 5.9-dev");
    expect(markdown).toContain("- node 22");
    expect(markdown).not.toContain("### Steps to reproduce");
    expect(markdown).not.toContain("bun install");
    expect(markdown).not.toContain("Evidence: issue-specific");
    expect(isFinalizedRepro({ ...report, status: "environment_ready" })).toBe(false);
    expect(isFinalizedRepro({ ...report, commands: [] })).toBe(false);
  });

  test("includes agent repro steps when supplied and does not invent them from logs", () => {
    const report = baseReport({
      status: "reproduced",
      summary: "Parameter property newline still errors.",
      reproSteps: "1. Save repro.ts\n2. Run `node built/local/tsc.js --noEmit repro.ts`",
      commands: [{ name: "repro", command: "node tsc.js", status: "failed", exitCode: 2, durationMs: 10, stdout: "", stderr: "TS1005" }],
      failure: null,
    });

    const markdown = renderMarkdownReport(report, 20);
    expect(markdown).toContain("### Steps to reproduce");
    expect(markdown).toContain("1. Save repro.ts");
    expect(markdown).toContain("TS1005");
  });

  test("evidenceExcerpt prefers last failing repro output", () => {
    const excerpt = evidenceExcerpt(
      [
        { name: "baseline", command: "bun test", status: "passed", exitCode: 0, durationMs: 1, stdout: "ok", stderr: "" },
        { name: "repro", command: "first", status: "passed", exitCode: 0, durationMs: 1, stdout: "noop", stderr: "" },
        { name: "repro", command: "second", status: "failed", exitCode: 1, durationMs: 1, stdout: "out", stderr: "err-signal" },
      ],
      10,
    );
    expect(excerpt).toContain("err-signal");
    expect(excerpt).toContain("out");
    expect(excerpt).not.toContain("noop");
  });

  test("environment_ready nextStep says probing is still required", () => {
    const ready = baseReport({
      runId: "issue-3-demo",
      status: "environment_ready",
      issue: { number: 3, title: "Bug", body: "Reproduce with fixture", state: "open", url: "https://github.com/owner/repo/issues/3" },
      sandbox: { provider: "daytona", id: "sandbox-3", target: "us" },
      commands: [{ name: "baseline", command: "bun test", status: "passed", exitCode: 0, durationMs: 5, stdout: "ok", stderr: "" }],
      failure: null,
      nextStep: "",
    });

    expect(agentNextStep(ready)).toContain("not reproduced");
    expect(agentNextStep(ready)).toContain("issue.body");
    expect(renderMarkdownReport({ ...ready, nextStep: agentNextStep(ready) }, 20)).toContain("## Repro: Environment ready");
    expect(renderMarkdownReport({ ...ready, nextStep: agentNextStep(ready) }, 20)).not.toContain("Next step:");

    const probed = {
      ...ready,
      commands: [
        ...ready.commands,
        { name: "repro" as const, command: "bun repro.ts", status: "failed" as const, exitCode: 1, durationMs: 10, stdout: "crash", stderr: "" },
      ],
    };
    expect(agentNextStep(probed)).toContain("Probe evidence recorded");
    expect(agentNextStep(probed)).toContain("not a final outcome");
    expect(agentNextStep(probed)).toContain("--repro-steps");
  });

  test("sample #5026-style comment stays maintainer-useful", () => {
    const report = baseReport({
      runId: "issue-5026-2026-07-18T064254146Z",
      status: "reproduced",
      issue: {
        number: 5026,
        title: "parameter property's modifier may not be followed by newline",
        body: "long issue template…",
        state: "open",
        url: "https://github.com/Dhruv2mars/typescript-relunar-testbed/issues/5026",
      },
      repo: "Dhruv2mars/typescript-relunar-testbed",
      commit: "a8e129925",
      sandbox: { provider: "daytona", id: "b1ea336e-4359-458c-a05e-f2f31b587e6a", target: "us" },
      commands: [
        { name: "setup", command: "bun install", status: "passed", exitCode: 0, durationMs: 1, stdout: "", stderr: "" },
        { name: "baseline", command: "bun run build", status: "passed", exitCode: 0, durationMs: 1, stdout: "", stderr: "" },
        {
          name: "repro",
          command: "bash -lc 'huge setup script…'",
          status: "passed",
          exitCode: 0,
          durationMs: 1,
          stdout: "=== COMPILE ===\nrepro.ts(2,14): error TS1005: ',' expected.\nTSC_EXIT=2\n",
          stderr: "",
        },
      ],
      failure: null,
      summary:
        "Reproduced on built local tsc 6.0.0-dev: a newline after a constructor parameter-property modifier still yields `TS1005 ',' expected` (treated as two params).",
      reproSteps: [
        "1. Build local `tsc` (`bun run build`).",
        "2. Save as `repro.ts`:",
        "",
        "```ts",
        "class Foo {",
        "  constructor(public",
        "    foo: string) {}",
        "}",
        "```",
        "",
        "3. Run:",
        "",
        "```sh",
        "node built/local/tsc.js --noEmit --pretty false repro.ts",
        "```",
      ].join("\n"),
      observed: "repro.ts(2,14): error TS1005: ',' expected.\nTSC_EXIT=2",
      expected: "Treat as a parameter property (or document that a newline after the modifier is invalid).",
      environmentNotes: "tsc 6.0.0-dev (built/local)",
      nextStep: "Run finalized as reproduced. Sandbox disposed.",
    });

    const markdown = renderMarkdownReport(report, 40);
    expect(markdown).toMatchSnapshot();
    expect(markdown).not.toContain("Sandbox:");
    expect(markdown).not.toContain("Next step:");
    expect(markdown).not.toContain("long issue template");
    expect(markdown).not.toContain("bun install");
    expect(markdown).not.toContain("huge setup script");
    expect(markdown).toContain("### Steps to reproduce");
    expect(markdown).toContain("TS1005");
  });
});
