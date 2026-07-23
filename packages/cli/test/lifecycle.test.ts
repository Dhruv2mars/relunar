import { describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parseArgs } from "../src/args";
import { parseRelunarConfig } from "../src/config";
import { cleanupRepro, execRepro, finishRepro, SandboxUnavailableError, startRepro, uploadReproFile } from "../src/repro";
import { findActiveRunForIssue, readRun } from "../src/runs";
import type { Issue, SandboxExecResult, SandboxProvider, SandboxSession } from "../src/types";

describe("agent-driven repro lifecycle", () => {
  test("serializes concurrent lifecycle mutations without losing evidence", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "relunar-lifecycle-concurrent-"));
    try {
      await writeFile(join(cwd, ".relunar.yml"), "version: 1\nsetup: []\nbaseline: []\n", "utf8");
      const sandbox = new ConcurrentProbeSandbox();
      const provider = fakeProvider(sandbox);
      const started = await startRepro(input(cwd, provider));
      expect(started).toMatchObject({ status: "environment_ready", failure: null });

      await Promise.all([
        execRepro({ cwd, runId: started.runId, command: "probe-one", expectations: { exitCode: 0 }, sandboxProvider: provider }),
        execRepro({ cwd, runId: started.runId, command: "probe-two", expectations: { exitCode: 0 }, sandboxProvider: provider }),
      ]);

      const stored = await readRun(cwd, started.runId);
      expect(stored.commands.filter((command) => command.name === "repro").map((command) => command.command).sort())
        .toEqual(["probe-one", "probe-two"]);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  test("keeps active runs retryable after transient provider failures", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "relunar-lifecycle-transient-resume-"));
    try {
      await writeFile(join(cwd, ".relunar.yml"), "version: 1\nsetup: []\nbaseline: []\n", "utf8");
      const sandbox = new FakeSandbox();
      const started = await startRepro(input(cwd, fakeProvider(sandbox)));
      const provider: SandboxProvider = {
        createSandbox: async () => sandbox,
        resumeSandbox: async () => { throw new Error("provider network unavailable"); },
      };

      await expect(execRepro({
        cwd,
        runId: started.runId,
        command: "probe",
        expectations: { exitCode: 0 },
        sandboxProvider: provider,
      })).rejects.toThrow("provider network unavailable");
      expect((await readRun(cwd, started.runId)).status).toBe("environment_ready");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  test("marks a definitively missing sandbox inactive with a typed error", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "relunar-lifecycle-missing-resume-"));
    try {
      await writeFile(join(cwd, ".relunar.yml"), "version: 1\nsetup: []\nbaseline: []\n", "utf8");
      const sandbox = new FakeSandbox();
      const started = await startRepro(input(cwd, fakeProvider(sandbox)));
      const provider: SandboxProvider = {
        createSandbox: async () => sandbox,
        resumeSandbox: async () => { throw new Error("404 sandbox not found"); },
      };

      let caught: unknown;
      try {
        await execRepro({
          cwd,
          runId: started.runId,
          command: "probe",
          expectations: { exitCode: 0 },
          sandboxProvider: provider,
        });
      } catch (error) {
        caught = error;
      }
      expect(caught).toBeInstanceOf(SandboxUnavailableError);
      expect((await readRun(cwd, started.runId)).status).toBe("aborted");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  test("cannot verify repeated evidence after fixture reset fails", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "relunar-lifecycle-reset-failure-"));
    try {
      await writeFile(join(cwd, ".relunar.yml"), "version: 1\nsetup: []\nbaseline: []\n", "utf8");
      const sandbox = new FailingResetSandbox();
      const provider = fakeProvider(sandbox);
      const started = await startRepro(input(cwd, provider));
      const executed = await execRepro({
        cwd,
        runId: started.runId,
        command: "probe",
        expectations: { exitCode: 0 },
        repeat: 3,
        resetCommand: "reset-fixture",
        claim: "Probe reproduces after an independent reset",
        sandboxProvider: provider,
      });
      expect(executed.commands.filter((command) => command.evidenceId === "probe-1")).toHaveLength(2);
      await expect(finishRepro({
        cwd,
        runId: started.runId,
        outcome: "reproduced",
        summary: "Probe reproduced.",
        reproSteps: "Run probe",
        observed: "failure",
        expected: "success",
        environmentNotes: "test",
        evidenceIds: ["probe-1"],
        sandboxProvider: provider,
      })).rejects.toThrow("requires all 3 repeated probe assertions to pass");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  test("cleanup disposes the sandbox when passthrough variables are no longer available", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "relunar-lifecycle-cleanup-env-"));
    try {
      await writeFile(join(cwd, ".relunar.yml"), "version: 1\nsetup: []\nbaseline: []\nenvironment:\n  passthrough: [RELUNAR_TEST_EPHEMERAL]\n", "utf8");
      const sandbox = new FakeSandbox();
      const provider = fakeProvider(sandbox);
      const started = await startRepro({
        ...input(cwd, provider),
        hostEnv: { RELUNAR_TEST_EPHEMERAL: "available-at-start" },
      });
      await finishRepro({
        cwd,
        runId: started.runId,
        outcome: "blocked",
        summary: "No issue-specific probe was available.",
        sandboxProvider: provider,
      });

      const cleaned = await cleanupRepro({ cwd, runId: started.runId, sandboxProvider: provider });
      expect(cleaned.cleanup?.status).toBe("completed");
      expect(sandbox.disposed).toBe(true);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  test("cleanup disposes the sandbox when a service stop command fails", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "relunar-lifecycle-cleanup-stop-"));
    try {
      await writeFile(join(cwd, ".relunar.yml"), "version: 1\nsetup: []\nbaseline: []\nservices:\n  - name: fixture\n    start: start-service\n    ready: service-ready\n    stop: stop-service\n", "utf8");
      const sandbox = new FailingStopSandbox();
      const provider = fakeProvider(sandbox);
      const started = await startRepro(input(cwd, provider));
      await finishRepro({
        cwd,
        runId: started.runId,
        outcome: "blocked",
        summary: "No issue-specific probe was available.",
        sandboxProvider: provider,
      });

      const cleaned = await cleanupRepro({ cwd, runId: started.runId, sandboxProvider: provider });
      expect(cleaned.cleanup?.status).toBe("completed");
      expect(sandbox.disposed).toBe(true);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  test("installs dependencies before launching services and runs baseline after readiness", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "relunar-lifecycle-service-order-"));
    try {
      await writeFile(join(cwd, ".relunar.yml"), "version: 1\nsetup: [install-deps]\nbaseline: [run-baseline]\nservices:\n  - name: web\n    start: run-server\n    ready: server-ready\n", "utf8");
      const sandbox = new FakeSandbox();
      const started = await startRepro(input(cwd, fakeProvider(sandbox)));

      expect(started.status).toBe("environment_ready");
      const commands = sandbox.invocations.map((invocation) => invocation.command);
      const setupIndex = commands.indexOf("install-deps");
      const startIndex = commands.findIndex((command) => command.includes("nohup sh -c 'run-server'"));
      const readyIndex = commands.indexOf("server-ready");
      const baselineIndex = commands.indexOf("run-baseline");
      expect(setupIndex).toBeGreaterThan(-1);
      expect(startIndex).toBeGreaterThan(setupIndex);
      expect(readyIndex).toBeGreaterThan(startIndex);
      expect(baselineIndex).toBeGreaterThan(readyIndex);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  test("persists failed service readiness evidence", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "relunar-lifecycle-service-failure-"));
    try {
      await writeFile(join(cwd, ".relunar.yml"), "version: 1\nsetup: []\nbaseline: []\ncommandTimeoutSeconds: 1\nservices:\n  - name: web\n    start: run-server\n    ready: never-ready\n", "utf8");
      const report = await startRepro(input(cwd, fakeProvider(new FailingServiceReadySandbox())));

      expect(report.status).toBe("setup_failed");
      expect(report.failure).toContain("Service web did not become ready");
      expect(report.commands.at(-1)).toMatchObject({ name: "service_ready", status: "failed", stderr: "connection refused" });
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  test("uses and persists repository configuration before sandbox creation", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "relunar-lifecycle-remote-config-"));
    try {
      const sandbox = new FakeSandbox();
      let createInput: Parameters<SandboxProvider["createSandbox"]>[0] | undefined;
      const provider: SandboxProvider = {
        createSandbox: async (value) => { createInput = value; return sandbox; },
        resumeSandbox: async () => sandbox,
      };
      const repositoryConfig = parseRelunarConfig("version: 1\nsetup: []\nbaseline: []\ncommandTimeoutSeconds: 91\nsandbox:\n  snapshot: snap-123\nworkspace:\n  workdir: packages/cli\n");
      const started = await startRepro({ ...input(cwd, provider), repositoryConfig });
      expect(createInput).toMatchObject({ snapshot: "snap-123", timeoutSeconds: 91 });
      expect(createInput?.image).toBeUndefined();
      expect(started.effectiveConfig?.workspace?.workdir).toBe("packages/cli");
      await execRepro({ cwd, runId: started.runId, command: "true", expectations: { exitCode: 0 }, sandboxProvider: provider });
      expect(sandbox.invocations.at(-1)?.cwd).toBe("repo/packages/cli");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  test("records the commit selected by workspace checkout", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "relunar-lifecycle-checkout-commit-"));
    try {
      const sandbox = new CheckoutSandbox();
      const report = await startRepro({
        ...input(cwd, fakeProvider(sandbox)),
        repositoryConfig: parseRelunarConfig("version: 1\nsetup: []\nbaseline: []\nworkspace:\n  checkout: refs/tags/v2.0.0\n"),
      });

      expect(report.status).toBe("environment_ready");
      expect(report.commit).toBe("checked-out-sha");
      expect(report.commands).toContainEqual(expect.objectContaining({
        name: "workspace",
        command: "git fetch origin 'refs/tags/v2.0.0' && git checkout --detach FETCH_HEAD",
        status: "passed",
      }));
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
  test("keeps ready sandbox, records issue evidence, then finalizes and cleans up", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "relunar-lifecycle-"));
    try {
      await writeFile(join(cwd, ".relunar.yml"), "version: 1\nsetup: []\nbaseline:\n  - bun run build\n", "utf8");
      const sandbox = new FakeSandbox();
      const provider = fakeProvider(sandbox);

      const started = await startRepro(input(cwd, provider));
      expect(started.status).toBe("environment_ready");
      expect(started.issue.body).toBe("Run repro.ts");
      expect(started.issue.state).toBe("open");
      expect(started.nextStep).toContain("not reproduced");
      expect(sandbox.disposed).toBe(false);

      const uploaded = await uploadReproFile({ cwd, runId: started.runId, localPath: "repro.ts", remotePath: "repro.ts", sandboxProvider: provider });
      expect(uploaded.commands.at(-1)?.name).toBe("repro_upload");
      expect(sandbox.uploads.at(-1)).toEqual({ localPath: "repro.ts", remotePath: "repo/repro.ts" });

      const executed = await execRepro({
        cwd,
        runId: started.runId,
        command: "bun repro.ts",
        expectations: { outputMatches: "crash reproduced" },
        repeat: 2,
        claim: "Compiler crashes with the supplied source",
        sandboxProvider: provider,
      });
      expect(executed.commands.at(-1)?.name).toBe("repro");
      expect(executed.commands.filter((command) => command.name === "repro")).toHaveLength(2);
      expect(executed.commands.at(-1)?.verification?.passed).toBe(true);
      expect(executed.commands.at(-1)?.evidenceId).toBe("probe-1");
      expect(executed.nextStep).toContain("Probe evidence recorded");

      const finished = await finishRepro({
        cwd,
        runId: started.runId,
        outcome: "reproduced",
        summary: "Compiler crashes with the supplied source.",
        reproSteps: "1. Run `bun repro.ts`",
        observed: "Error: boom",
        expected: "No crash",
        environmentNotes: "bun 1.2",
        evidenceIds: ["probe-1"],
        sandboxProvider: provider,
      });
      expect(finished.status).toBe("reproduced");
      expect(finished.summary).toBe("Compiler crashes with the supplied source.");
      expect(finished.reproSteps).toBe("1. Run `bun repro.ts`");
      expect(finished.observed).toBe("Error: boom");
      expect(finished.expected).toBe("No crash");
      expect(finished.environmentNotes).toBe("bun 1.2");
      expect(finished.trust).toBe("verified");
      expect(finished.selectedEvidenceIds).toEqual(["probe-1"]);
      expect(finished.nextStep).toContain("finalized as reproduced");
      expect(sandbox.disposed).toBe(false);
      const cleaned = await cleanupRepro({ cwd, runId: started.runId, sandboxProvider: provider });
      expect(cleaned.cleanup?.status).toBe("completed");
      expect(sandbox.disposed).toBe(true);
      const cleanedAgain = await cleanupRepro({ cwd, runId: started.runId, sandboxProvider: provider });
      expect(cleanedAgain.cleanup?.status).toBe("completed");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  test("links only explicitly selected passing evidence to the outcome", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "relunar-lifecycle-claim-link-"));
    try {
      await writeFile(join(cwd, ".relunar.yml"), "version: 1\nsetup: []\nbaseline:\n  - bun run build\n", "utf8");
      const sandbox = new FakeSandbox();
      const provider = fakeProvider(sandbox);
      const started = await startRepro(input(cwd, provider));
      await execRepro({ cwd, runId: started.runId, command: "bun repro.ts", expectations: { outputMatches: "missing" }, claim: "Compiler crashes", sandboxProvider: provider });
      await execRepro({ cwd, runId: started.runId, command: "echo PROBE_COMPLETE", expectations: { outputMatches: "ok" }, claim: "Environment can execute shell commands", sandboxProvider: provider });

      const finished = await finishRepro({
        cwd,
        runId: started.runId,
        outcome: "reproduced",
        summary: "Compiler crashes.",
        reproSteps: "1. Run repro",
        observed: "crash",
        expected: "no crash",
        environmentNotes: "test",
        evidenceIds: ["probe-2"],
        sandboxProvider: provider,
      });
      expect(finished.selectedEvidenceIds).toEqual(["probe-2"]);
      expect(finished.commands.find((command) => command.evidenceId === "probe-2")?.claim)
        .toBe("Environment can execute shell commands");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  test("uploads relative to the configured repository workdir and rejects traversal", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "relunar-lifecycle-upload-"));
    try {
      await writeFile(join(cwd, ".relunar.yml"), "version: 1\nsetup: []\nbaseline: []\nworkspace:\n  workdir: packages/cli\n", "utf8");
      const sandbox = new FakeSandbox();
      const provider = fakeProvider(sandbox);
      const started = await startRepro(input(cwd, provider));
      await uploadReproFile({ cwd, runId: started.runId, localPath: "probe.ts", remotePath: "probes/probe.ts", sandboxProvider: provider });
      expect(sandbox.uploads.at(-1)?.remotePath).toBe("repo/packages/cli/probes/probe.ts");
      await expect(uploadReproFile({ cwd, runId: started.runId, localPath: "probe.ts", remotePath: "../probe.ts", sandboxProvider: provider })).rejects.toThrow("Unsafe remote upload path");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  test("rejects finalization without issue-specific command evidence", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "relunar-lifecycle-gate-"));
    try {
      await writeFile(join(cwd, ".relunar.yml"), "version: 1\nsetup: []\nbaseline:\n  - bun run build\n", "utf8");
      const sandbox = new FakeSandbox();
      const provider = fakeProvider(sandbox);
      const started = await startRepro(input(cwd, provider));

      await expect(finishRepro({ cwd, runId: started.runId, outcome: "reproduced", summary: "Not enough.", sandboxProvider: provider })).rejects.toThrow("explicit --evidence selection");
      expect(sandbox.disposed).toBe(false);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  test("rejects reproduced finish when probe has output but no explicit assertion", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "relunar-lifecycle-output-gate-"));
    try {
      await writeFile(join(cwd, ".relunar.yml"), "version: 1\nsetup: []\nbaseline:\n  - bun run build\n", "utf8");
      const sandbox = new FakeSandbox();
      const provider = fakeProvider(sandbox);
      const started = await startRepro(input(cwd, provider));
      await execRepro({ cwd, runId: started.runId, command: "bun repro.ts", claim: "Compiler crashes", sandboxProvider: provider });

      await expect(
        finishRepro({ cwd, runId: started.runId, outcome: "reproduced", summary: "Claimed repro with empty probe.", evidenceIds: ["probe-1"], sandboxProvider: provider }),
      ).rejects.toThrow("verified passing probe assertion");
      expect(sandbox.disposed).toBe(false);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  test("not-reproduced requires an evaluated assertion that did not match", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "relunar-lifecycle-not-reproduced-"));
    try {
      await writeFile(join(cwd, ".relunar.yml"), "version: 1\nsetup: []\nbaseline:\n  - bun run build\n", "utf8");
      const sandbox = new FakeSandbox();
      const provider = fakeProvider(sandbox);
      const started = await startRepro(input(cwd, provider));
      await execRepro({
        cwd,
        runId: started.runId,
        command: "bun repro.ts",
        expectations: { outputMatches: "segmentation fault" },
        claim: "Compiler segfaults",
        sandboxProvider: provider,
      });

      const finished = await finishRepro({
        cwd,
        runId: started.runId,
        outcome: "not_reproduced",
        summary: "Expected crash signature did not occur.",
        reproSteps: "1. Run bun repro.ts",
        observed: "Crash signature absent",
        expected: "Compiler crash",
        environmentNotes: "bun test",
        evidenceIds: ["probe-1"],
        sandboxProvider: provider,
      });
      expect(finished.trust).toBe("verified");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  test("conclusive outcomes require complete maintainer narrative", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "relunar-lifecycle-narrative-"));
    try {
      await writeFile(join(cwd, ".relunar.yml"), "version: 1\nsetup: []\nbaseline:\n  - bun run build\n", "utf8");
      const sandbox = new FakeSandbox();
      const provider = fakeProvider(sandbox);
      const started = await startRepro(input(cwd, provider));
      await execRepro({ cwd, runId: started.runId, command: "bun repro.ts", expectations: { outputMatches: "crash" }, claim: "Compiler crashes", sandboxProvider: provider });

      await expect(
        finishRepro({
          cwd,
          runId: started.runId,
          outcome: "reproduced",
          summary: "Crash observed.",
          evidenceIds: ["probe-1"],
          sandboxProvider: provider,
        }),
      ).rejects.toThrow("requires --repro-steps, --observed, --expected, and --environment");
      expect(sandbox.disposed).toBe(false);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  test("refreshes idle TTL on exec while keeping sandbox warm until finish", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "relunar-lifecycle-warm-"));
    try {
      await writeFile(join(cwd, ".relunar.yml"), "version: 1\nsetup: []\nbaseline:\n  - bun run build\n", "utf8");
      const sandbox = new FakeSandbox();
      const provider = fakeProvider(sandbox);
      const started = await startRepro(input(cwd, provider));
      expect(sandbox.disposed).toBe(false);
      await execRepro({ cwd, runId: started.runId, command: "bun repro.ts", expectations: { outputMatches: "crash" }, claim: "Compiler crashes", sandboxProvider: provider });
      expect(sandbox.touchCount).toBeGreaterThan(0);
      expect(sandbox.disposed).toBe(false);
      await finishRepro({
        cwd,
        runId: started.runId,
        outcome: "reproduced",
        summary: "Warm until finish, then disposed.",
        reproSteps: "1. Run bun repro.ts",
        observed: "crash reproduced",
        expected: "no crash",
        environmentNotes: "bun test",
        evidenceIds: ["probe-1"],
        sandboxProvider: provider,
      });
      expect(sandbox.disposed).toBe(false);
      await cleanupRepro({ cwd, runId: started.runId, sandboxProvider: provider });
      expect(sandbox.disposed).toBe(true);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  test("one-shot parse keeps finish narrative flags before passthrough probe", () => {
    const parsed = parseArgs([
      "repro",
      "42",
      "--finish",
      "--outcome",
      "reproduced",
      "--summary",
      "saw crash",
      "--repro-steps",
      "1. run bun repro.ts",
      "--observed",
      "boom",
      "--expected",
      "no crash",
      "--environment",
      "node 22",
      "--comment",
      "--",
      "bun",
      "repro.ts",
    ]);
    expect(parsed.positionals).toEqual(["repro", "42"]);
    expect(parsed.flags.finish).toBe(true);
    expect(parsed.flags.outcome).toBe("reproduced");
    expect(parsed.flags.summary).toBe("saw crash");
    expect(parsed.flags["repro-steps"]).toBe("1. run bun repro.ts");
    expect(parsed.flags.observed).toBe("boom");
    expect(parsed.flags.expected).toBe("no crash");
    expect(parsed.flags.environment).toBe("node 22");
    expect(parsed.flags.comment).toBe(true);
    expect(parsed.passthrough).toEqual(["bun", "repro.ts"]);
  });

  test("finds active environment_ready run for one-shot resume", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "relunar-oneshot-resume-"));
    try {
      await writeFile(join(cwd, ".relunar.yml"), "version: 1\nsetup: []\nbaseline:\n  - bun run build\n", "utf8");
      const sandbox = new FakeSandbox();
      const provider = fakeProvider(sandbox);
      const started = await startRepro(input(cwd, provider));
      const active = await findActiveRunForIssue(cwd, 123, "owner/repo");
      expect(active?.runId).toBe(started.runId);
      expect(await findActiveRunForIssue(cwd, 123, "other/repo")).toBeNull();

      await execRepro({ cwd, runId: started.runId, command: "bun repro.ts", expectations: { outputMatches: "missing signature" }, claim: "Compiler crashes", sandboxProvider: provider });
      await finishRepro({ cwd, runId: started.runId, outcome: "not_reproduced", summary: "Did not crash.", reproSteps: "1. Run bun repro.ts", observed: "No crash", expected: "Compiler crash", environmentNotes: "bun test", evidenceIds: ["probe-1"], sandboxProvider: provider });
      expect(await findActiveRunForIssue(cwd, 123, "owner/repo")).toBeNull();
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  test("skip gates remains unverified and therefore cannot become publishable evidence", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "relunar-lifecycle-skipped-"));
    try {
      await writeFile(join(cwd, ".relunar.yml"), "version: 1\nsetup: []\nbaseline:\n  - bun run build\n", "utf8");
      const sandbox = new FakeSandbox();
      const provider = fakeProvider(sandbox);
      const started = await startRepro(input(cwd, provider));
      await execRepro({ cwd, runId: started.runId, command: "bun repro.ts", expectations: { outputMatches: "missing" }, claim: "Compiler crashes", sandboxProvider: provider });
      const finished = await finishRepro({
        cwd,
        runId: started.runId,
        outcome: "not_reproduced",
        summary: "Crash signature was absent.",
        reproSteps: "1. Run bun repro.ts",
        observed: "Crash signature absent",
        expected: "Compiler crash",
        environmentNotes: "bun test",
        evidenceIds: ["probe-1"],
        skipEvidenceGates: true,
        sandboxProvider: provider,
      });

      expect(finished.trust).toBe("unverified");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

function input(cwd: string, sandboxProvider: SandboxProvider) {
  const issue: Issue = { number: 123, title: "Crash", body: "Run repro.ts", state: "open", url: "https://github.com/owner/repo/issues/123" };
  return { cwd, repo: "owner/repo" as const, issue, githubToken: "token", sandboxProvider };
}

function fakeProvider(sandbox: FakeSandbox): SandboxProvider {
  return {
    createSandbox: async () => sandbox,
    resumeSandbox: async () => sandbox,
  };
}

class FakeSandbox implements SandboxSession {
  readonly id = "sandbox-1";
  readonly target = "test";
  disposed = false;
  touchCount = 0;
  readonly uploads: Array<{ localPath: string; remotePath: string }> = [];
  readonly invocations: Array<{ command: string; cwd: string | undefined }> = [];

  async run(command: string, cwd?: string): Promise<SandboxExecResult> {
    this.invocations.push({ command, cwd });
    if (command.includes("git rev-parse")) return ok("abc123\n");
    if (command === "true") return ok("");
    return ok(command === "bun repro.ts" ? "crash reproduced" : "ok");
  }

  async upload(localPath: string, remotePath: string): Promise<void> {
    this.uploads.push({ localPath, remotePath });
  }

  async touchIdle(): Promise<void> {
    this.touchCount += 1;
  }

  async dispose(): Promise<void> {
    this.disposed = true;
  }
}

class ConcurrentProbeSandbox extends FakeSandbox {
  override async run(command: string, cwd?: string): Promise<SandboxExecResult> {
    if (command === "probe-one" || command === "probe-two") {
      if (command === "probe-one") await Bun.sleep(30);
      this.invocations.push({ command, cwd });
      return ok("ok");
    }
    return super.run(command, cwd);
  }
}

class FailingResetSandbox extends FakeSandbox {
  override async run(command: string, cwd?: string): Promise<SandboxExecResult> {
    if (command === "reset-fixture") {
      this.invocations.push({ command, cwd });
      return { exitCode: 1, stdout: "", stderr: "reset failed", timedOut: false };
    }
    return super.run(command, cwd);
  }
}

class FailingStopSandbox extends FakeSandbox {
  override async run(command: string, cwd?: string): Promise<SandboxExecResult> {
    if (command === "stop-service") {
      this.invocations.push({ command, cwd });
      throw new Error("stop failed");
    }
    return super.run(command, cwd);
  }
}

class FailingServiceReadySandbox extends FakeSandbox {
  override async run(command: string, cwd?: string): Promise<SandboxExecResult> {
    if (command === "never-ready") {
      this.invocations.push({ command, cwd });
      return { exitCode: 1, stdout: "", stderr: "connection refused", timedOut: false };
    }
    return super.run(command, cwd);
  }
}

class CheckoutSandbox extends FakeSandbox {
  private checkedOut = false;

  override async run(command: string, cwd?: string): Promise<SandboxExecResult> {
    if (command.includes("git checkout --detach FETCH_HEAD")) {
      this.checkedOut = true;
      return super.run(command, cwd);
    }
    if (command.includes("git rev-parse")) return ok(this.checkedOut ? "checked-out-sha\n" : "clone-sha\n");
    return super.run(command, cwd);
  }
}

function ok(stdout: string): SandboxExecResult {
  return { exitCode: 0, stdout, stderr: "", timedOut: false };
}
