import { describe, expect, test } from "bun:test";
import { assertEvidenceGates, compileOutputMatch } from "../src/evidence";
import { defaultRelunarConfig } from "../src/config";
import type { RelunarConfig, RunReport } from "../src/types";

describe("evidence gates", () => {
  test("reproduced requires probe signal by default", async () => {
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
    await expect(assertEvidenceGates(report, "reproduced", defaultRelunarConfig)).rejects.toThrow("verified passing probe assertion");
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
    ], true);
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
    ], true);
    await assertEvidenceGates(report, "reproduced", defaultRelunarConfig);
  });

  test("requireProbeOutput demands text and ignores exit status alone", async () => {
    const config: RelunarConfig = {
      ...defaultRelunarConfig,
      evidence: {
        reproduced: {
          requireProbeOutput: true,
        },
      },
    };
    const report = baseReport([
      {
        name: "repro",
        command: "false",
        status: "failed",
        exitCode: 1,
        durationMs: 1,
        stdout: "",
        stderr: "",
      },
    ], true);
    await expect(assertEvidenceGates(report, "reproduced", config)).rejects.toThrow("stdout or stderr");
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
    ], true);
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
    ], true);
    await assertEvidenceGates(report, "reproduced", config);
  });

  test("requireOutputMatch accepts documented (?i) prefix", async () => {
    expect(compileOutputMatch("(?i)error|panic").flags).toContain("i");
    const config: RelunarConfig = {
      ...defaultRelunarConfig,
      evidence: {
        reproduced: {
          requireOutputMatch: "(?i)error|panic",
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
        stdout: "ERROR: boom",
        stderr: "",
      },
    ], true);
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

  test("reproduced rejects partially matching repeated probe series", async () => {
    const commands: RunReport["commands"] = [true, false, true].map((passed, index) => ({
      name: "repro",
      command: "probe",
      status: "passed",
      exitCode: 0,
      durationMs: 1,
      stdout: "signal",
      stderr: "",
      verification: {
        verified: true,
        passed,
        attempt: index + 1,
        totalAttempts: 3,
        checks: [{ kind: "output_matches", expected: "/signal/", actual: "signal", passed }],
      },
    }));
    await expect(assertEvidenceGates(baseReport(commands), "reproduced", defaultRelunarConfig)).rejects.toThrow("all 3 repeated probe assertions");
  });
});

function baseReport(commands: RunReport["commands"], verified = false): RunReport {
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
    commands: commands.map((command) => verified && command.name === "repro"
      ? {
          ...command,
          verification: {
            verified: true,
            passed: true,
            attempt: 1,
            totalAttempts: 1,
            checks: [{ kind: "exit_code", expected: String(command.exitCode), actual: String(command.exitCode), passed: true }],
          },
        }
      : command),
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
