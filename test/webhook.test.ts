import { describe, expect, test } from "bun:test";
import { createApp } from "../src/http/app";
import { MemoryReproQueue } from "../src/queue";
import { MemoryRelunarStore } from "../src/testing/memory-store";
import { issueOpenedPayload, signBody, testLogger } from "./helpers";

describe("GitHub webhook API", () => {
  test("rejects invalid signatures", async () => {
    const store = new MemoryRelunarStore();
    const queue = new MemoryReproQueue();
    const app = createApp({
      webhookSecret: "secret",
      store,
      queue,
      logger: testLogger(),
    });

    const response = await app.request("/webhooks/github", {
      method: "POST",
      headers: {
        "x-github-event": "issues",
        "x-github-delivery": "delivery-1",
        "x-hub-signature-256": "sha256=bad",
      },
      body: JSON.stringify(issueOpenedPayload()),
    });

    expect(response.status).toBe(401);
    expect(queue.messages).toHaveLength(0);
  });

  test("queues public issues.opened deliveries", async () => {
    const store = new MemoryRelunarStore();
    const queue = new MemoryReproQueue();
    const app = createApp({
      webhookSecret: "secret",
      store,
      queue,
      logger: testLogger(),
    });
    const body = JSON.stringify(issueOpenedPayload());

    const response = await app.request("/webhooks/github", {
      method: "POST",
      headers: {
        "x-github-event": "issues",
        "x-github-delivery": "delivery-1",
        "x-hub-signature-256": signBody(body, "secret"),
      },
      body,
    });

    expect(response.status).toBe(202);
    const json = (await response.json()) as { accepted: boolean; jobId: string };
    expect(json.accepted).toBe(true);
    expect(queue.messages).toEqual([{ jobId: json.jobId }]);
    const bundle = await store.getJobBundle(json.jobId);
    expect(bundle?.repository.fullName).toBe("maintainer/demo");
    expect(bundle?.issue.number).toBe(42);
  });

  test("ignores private repositories for milestone 1", async () => {
    const store = new MemoryRelunarStore();
    const queue = new MemoryReproQueue();
    const app = createApp({
      webhookSecret: "secret",
      store,
      queue,
      logger: testLogger(),
    });
    const body = JSON.stringify(issueOpenedPayload({ privateRepository: true }));

    const response = await app.request("/webhooks/github", {
      method: "POST",
      headers: {
        "x-github-event": "issues",
        "x-github-delivery": "delivery-1",
        "x-hub-signature-256": signBody(body, "secret"),
      },
      body,
    });

    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ accepted: false, reason: "private_repository" });
    expect(queue.messages).toHaveLength(0);
  });
});
