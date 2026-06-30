import { describe, expect, test } from "bun:test";
import { runBaselineJob } from "../src/runner";
import { FakeSandboxProvider } from "../src/sandbox/fake";
import { MemoryRelunarStore } from "../src/testing/memory-store";
import { issueOpenedPayload, testLogger } from "./helpers";
import { parseIssueOpenedWebhook } from "../src/github/webhook";

describe("baseline runner", () => {
  test("passes baseline when install, build, and test pass", async () => {
    const store = new MemoryRelunarStore();
    const { jobId } = await store.createIssueJob(jobInputFromPayload());
    const bundle = await store.getJobBundle(jobId);
    if (!bundle) {
      throw new Error("missing test bundle");
    }

    const sandbox = new FakeSandboxProvider([
      { match: /^git clone /, result: ok("cloned") },
      { match: "git rev-parse HEAD", result: ok("abc123\n") },
      { match: /^for f in /, result: ok("bun.lock\npackage.json\n") },
      { match: "bun install", result: ok("installed") },
      { match: "cat package.json", result: ok(JSON.stringify({ scripts: { build: "tsc", test: "bun test" } })) },
      { match: "bun run build", result: ok("built") },
      { match: "bun test", result: ok("passed") },
    ]);

    const result = await runBaselineJob({
      bundle,
      store,
      sandboxProvider: sandbox,
      logger: testLogger(),
      options: {
        commandTimeoutSeconds: 300,
        jobTimeoutSeconds: 900,
      },
    });

    const updated = await store.getJobBundle(jobId);
    expect(updated?.job.state).toBe("completed");
    expect(updated?.job.result).toBe("baseline_passed");
    expect(updated?.job.commitSha).toBe("abc123");
    expect(updated?.job.packageManager).toBe("bun");
    expect(result.commentBody).toContain("Status: Baseline passed");
    expect(result.commentBody).toContain("`bun run build` -> passed");
    expect(result.commentBody).toContain("`bun test` -> passed");
  });

  test("marks build failure as baseline_failed", async () => {
    const store = new MemoryRelunarStore();
    const { jobId } = await store.createIssueJob(jobInputFromPayload());
    const bundle = await store.getJobBundle(jobId);
    if (!bundle) {
      throw new Error("missing test bundle");
    }

    const sandbox = new FakeSandboxProvider([
      { match: /^git clone /, result: ok("cloned") },
      { match: "git rev-parse HEAD", result: ok("def456\n") },
      { match: /^for f in /, result: ok("package-lock.json\npackage.json\n") },
      { match: "npm ci", result: ok("installed") },
      { match: "cat package.json", result: ok(JSON.stringify({ scripts: { build: "tsc" } })) },
      { match: "npm run build", result: fail("src/index.ts:1:1 error") },
    ]);

    const result = await runBaselineJob({
      bundle,
      store,
      sandboxProvider: sandbox,
      logger: testLogger(),
      options: {
        commandTimeoutSeconds: 300,
        jobTimeoutSeconds: 900,
      },
    });

    const updated = await store.getJobBundle(jobId);
    expect(updated?.job.result).toBe("baseline_failed");
    expect(updated?.job.errorCategory).toBe("command_failed");
    expect(result.commentBody).toContain("Status: Baseline failed");
    expect(result.commentBody).toContain("npm run build");
    expect(result.commentBody).toContain("src/index.ts:1:1 error");
  });

  test("blocks unsupported repositories before install", async () => {
    const store = new MemoryRelunarStore();
    const { jobId } = await store.createIssueJob(jobInputFromPayload());
    const bundle = await store.getJobBundle(jobId);
    if (!bundle) {
      throw new Error("missing test bundle");
    }

    const sandbox = new FakeSandboxProvider([
      { match: /^git clone /, result: ok("cloned") },
      { match: "git rev-parse HEAD", result: ok("abc123\n") },
      { match: /^for f in /, result: ok("") },
    ]);

    const result = await runBaselineJob({
      bundle,
      store,
      sandboxProvider: sandbox,
      logger: testLogger(),
      options: {
        commandTimeoutSeconds: 300,
        jobTimeoutSeconds: 900,
      },
    });

    const updated = await store.getJobBundle(jobId);
    expect(updated?.job.result).toBe("blocked");
    expect(updated?.job.errorCategory).toBe("package_detection_error");
    expect(result.commentBody).toContain("Status: Blocked");
    expect(result.commentBody).toContain("No supported JavaScript or TypeScript package shape was detected.");
  });

  test("stops before running commands when the job deadline is already expired", async () => {
    const store = new MemoryRelunarStore();
    const { jobId } = await store.createIssueJob(jobInputFromPayload());
    const bundle = await store.getJobBundle(jobId);
    if (!bundle) {
      throw new Error("missing test bundle");
    }

    const sandbox = new FakeSandboxProvider([]);

    const result = await runBaselineJob({
      bundle,
      store,
      sandboxProvider: sandbox,
      logger: testLogger(),
      options: {
        commandTimeoutSeconds: 300,
        jobTimeoutSeconds: 0,
      },
    });

    const updated = await store.getJobBundle(jobId);
    expect(updated?.job.state).toBe("completed");
    expect(updated?.job.result).toBe("run_failed");
    expect(updated?.job.errorCategory).toBe("command_timeout");
    expect(sandbox.commands).toHaveLength(0);
    expect(result.commentBody).toContain("Status: Run failed");
    expect(result.commentBody).toContain("Job exceeded the hard timeout before the next command could start.");
  });
});

function ok(stdout: string) {
  return {
    exitCode: 0,
    stdout,
    stderr: "",
    timedOut: false,
  };
}

function fail(stderr: string) {
  return {
    exitCode: 1,
    stdout: "",
    stderr,
    timedOut: false,
  };
}

function jobInputFromPayload() {
  const body = JSON.stringify(issueOpenedPayload());
  const parsed = parseIssueOpenedWebhook({
    eventName: "issues",
    deliveryId: "delivery-1",
    rawBody: body,
  });
  if (!parsed.supported) {
    throw new Error("test payload was not supported");
  }
  return parsed.jobInput;
}
