import { Hono } from "hono";
import type { Logger } from "../logger";
import type { ReproQueue } from "../queue";
import type { RelunarStore } from "../store";
import { parseIssueOpenedWebhook, verifyGitHubSignature } from "../github/webhook";

export type CreateAppDependencies = {
  webhookSecret: string;
  store: RelunarStore;
  queue: ReproQueue;
  logger: Logger;
};

export function createApp(dependencies: CreateAppDependencies) {
  const app = new Hono();

  app.get("/health", (c) => c.json({ ok: true }));

  app.post("/webhooks/github", async (c) => {
    const rawBody = await c.req.text();
    const signature = c.req.header("x-hub-signature-256") ?? null;
    const eventName = c.req.header("x-github-event") ?? null;
    const deliveryId = c.req.header("x-github-delivery") ?? null;

    if (!verifyGitHubSignature(rawBody, signature, dependencies.webhookSecret)) {
      dependencies.logger.warn({ eventName, deliveryId }, "rejected GitHub webhook signature");
      return c.json({ error: "invalid signature" }, 401);
    }

    const parsed = parseIssueOpenedWebhook({ eventName, deliveryId, rawBody });
    if (!parsed.supported) {
      if (parsed.malformed) {
        dependencies.logger.warn({ eventName, deliveryId, reason: parsed.reason }, "rejected malformed GitHub webhook");
        return c.json({ error: "invalid JSON payload" }, 400);
      }

      dependencies.logger.info(
        { eventName, deliveryId, reason: parsed.reason, diagnostics: parsed.diagnostics },
        "ignored GitHub webhook",
      );
      return c.json({ accepted: false, reason: parsed.reason }, 202);
    }

    const { jobId } = await dependencies.store.createIssueJob(parsed.jobInput);
    const queueJobId = await dependencies.queue.enqueue({ jobId });
    await dependencies.store.setQueueJobId(jobId, queueJobId);

    dependencies.logger.info(
      {
        jobId,
        queueJobId,
        repository: parsed.jobInput.repository.fullName,
        issueNumber: parsed.jobInput.issue.number,
        githubDeliveryId: deliveryId,
      },
      "queued repro job",
    );

    return c.json({ accepted: true, jobId }, 202);
  });

  return app;
}
