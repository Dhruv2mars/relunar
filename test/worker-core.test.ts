import { describe, expect, test } from "bun:test";
import type { GitHubIssueCommenter } from "../src/github/client";
import { parseIssueOpenedWebhook } from "../src/github/webhook";
import { FakeSandboxProvider } from "../src/sandbox/fake";
import { MemoryRelunarStore } from "../src/testing/memory-store";
import { processReproJob } from "../src/worker-core";
import { issueOpenedPayload, testLogger } from "./helpers";

describe("worker processing", () => {
  test("runs a queued job and records one GitHub issue comment", async () => {
    const store = new MemoryRelunarStore();
    const parsed = parseIssueOpenedWebhook({
      eventName: "issues",
      deliveryId: "delivery-1",
      rawBody: JSON.stringify(issueOpenedPayload()),
    });
    if (!parsed.supported) {
      throw new Error("test payload was not supported");
    }

    const { jobId } = await store.createIssueJob(parsed.jobInput);
    const sandbox = new FakeSandboxProvider([
      { match: /^git clone /, result: ok("cloned") },
      { match: "git rev-parse HEAD", result: ok("abc123\n") },
      { match: /^for f in /, result: ok("package.json\n") },
      { match: "npm install", result: ok("installed") },
      { match: "cat package.json", result: ok(JSON.stringify({ scripts: { test: "echo ok" } })) },
      { match: "npm test", result: ok("ok") },
    ]);
    const github = new FakeGitHub();

    await processReproJob(jobId, {
      store,
      sandboxProvider: sandbox,
      github,
      logger: testLogger(),
      runnerOptions: {
        commandTimeoutSeconds: 300,
        jobTimeoutSeconds: 900,
      },
    });

    const bundle = await store.getJobBundle(jobId);
    expect(bundle?.job.state).toBe("completed");
    expect(bundle?.job.result).toBe("baseline_passed");
    expect(github.comments).toHaveLength(1);
    expect(github.comments[0]).toMatchObject({
      owner: "maintainer",
      repo: "demo",
      issueNumber: 42,
    });
    expect(github.comments[0]?.body).toContain("Status: Baseline passed");
    expect(store.comments).toHaveLength(1);
    expect(store.comments[0]?.githubCommentId).toBe("comment-1");
  });
});

class FakeGitHub implements GitHubIssueCommenter {
  readonly comments: Array<{
    installationId: string;
    owner: string;
    repo: string;
    issueNumber: number;
    body: string;
  }> = [];

  async createIssueComment(input: {
    installationId: string;
    owner: string;
    repo: string;
    issueNumber: number;
    body: string;
  }): Promise<{ id: string }> {
    this.comments.push(input);
    return { id: `comment-${this.comments.length}` };
  }
}

function ok(stdout: string) {
  return {
    exitCode: 0,
    stdout,
    stderr: "",
    timedOut: false,
  };
}
