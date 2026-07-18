import { describe, expect, test } from "bun:test";
import { assertEvidenceGates } from "../src/evidence";
import { defaultRelunarConfig } from "../src/config";
import type { RelunarConfig, RunReport } from "../src/types";

describe("evidence gates", () => {
  test("reproduced requires probe output by default", async () => {
    const report = baseReport([
      {
        name: "repro",
        command: "true",
        status: "passed",
        exitCode: 0,
        durationMs: 1,
        stdout: "",
        stderr: "",
      },
    ]);
    await expect(assertEvidenceGates(report, "reproduced", defaultRelunarConfig)).rejects.toThrow("stdout or stderr");
  });

  test("reproduced accepts failing probe with output", async () => {
    const report = baseReport([
      {
        name: "repro",
        command: "rg --bad",
        status: "failed",
        exitCode: 2,
        durationMs: 3,
        stdout: "",
        stderr: "unrecognized flag",
      },
    ]);
    await assertEvidenceGates(report, "reproduced", defaultRelunarConfig);
  });

  test("reproduced accepts failing probe even when streams are empty", async () => {
    const report = baseReport([
      {
        name: "repro",
        command: "node -e 'throw new Error()'",
        status: "failed",
        exitCode: 1,
        durationMs: 2,
        stdout: "",
        stderr: "",
      },
    ]);
    await assertEvidenceGates(report, "reproduced", defaultRelunarConfig);
  });

  test("requireNonZeroExit rejects all-passing probes", async () => {
    const config: RelunarConfig = {
      ...defaultRelunarConfig,
      evidence: {
        reproduced: {
          requireNonZeroExit: true,
        },
      },
    };
    const report = baseReport([
      {
        name: "repro",
        command: "echo bug",
        status: "passed",
        exitCode: 0,
        durationMs: 1,
        stdout: "bug",
        stderr: "",
      },
    ]);
    await expect(assertEvidenceGates(report, "reproduced", config)).rejects.toThrow("failing or timed-out");
  });

  test("requireOutputMatch enforces regex", async () => {
    const config: RelunarConfig = {
      ...defaultRelunarConfig,
      evidence: {
        reproduced: {
          requireOutputMatch: "panic|segfault",
        },
      },
    };
    const report = baseReport([
      {
        name: "repro",
        command: "cargo test",
        status: "failed",
        exitCode: 1,
        durationMs: 10,
        stdout: "thread panicked at src/lib.rs",
        stderr: "",
      },
    ]);
    await assertEvidenceGates(report, "reproduced", config);
  });

  test("skip bypasses gates", async () => {
    const report = baseReport([]);
    await assertEvidenceGates(report, "reproduced", defaultRelunarConfig, { skip: true });
  });

  test("blocked does not require repro command by default", async () => {
    const report = baseReport([]);
    await assertEvidenceGates(report, "blocked", defaultRelunarConfig);
  });
});

function baseReport(commands: RunReport["commands"]): RunReport {
  return {
    runId: "issue-1-test",
    status: "environment_ready",
    issue: {
      number: 1,
      title: "Bug",
      body: "body",
      state: "open",
      url: "https://github.com/owner/repo/issues/1",
    },
    repo: "owner/repo",
    commit: "abc",
    sandbox: { provider: "daytona", id: "sb", target: "test" },
    commands,
    failure: null,
    summary: null,
    reproSteps: null,
    observed: null,
    expected: null,
    environmentNotes: null,
    nextStep: "",
    startedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
  };
}
