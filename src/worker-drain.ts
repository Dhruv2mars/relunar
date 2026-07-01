import type { Logger } from "./logger";

export type DrainQueueJob = {
  id: string;
  data: {
    jobId?: string;
  };
};

export interface DrainableReproQueue {
  fetch(batchSize: number): Promise<DrainQueueJob[]>;
  complete(queueJobId: string): Promise<void>;
  fail(queueJobId: string, error?: unknown): Promise<void>;
}

export type DrainReproQueueResult = {
  processed: number;
  completed: number;
  failed: number;
};

export async function drainReproQueue(input: {
  queue: DrainableReproQueue;
  batchSize: number;
  maxJobs: number;
  logger: Pick<Logger, "info" | "error">;
  processJob(jobId: string): Promise<void>;
}): Promise<DrainReproQueueResult> {
  const result: DrainReproQueueResult = {
    processed: 0,
    completed: 0,
    failed: 0,
  };

  while (result.processed + result.failed < input.maxJobs) {
    const remaining = input.maxJobs - result.processed - result.failed;
    const batch = await input.queue.fetch(Math.min(input.batchSize, remaining));
    if (batch.length === 0) {
      input.logger.info(result, "worker drain found no more ready jobs");
      return result;
    }

    for (const queueJob of batch) {
      if (!queueJob.data.jobId) {
        const error = new Error("missing job id in queue message");
        await input.queue.fail(queueJob.id, error);
        result.failed += 1;
        input.logger.error({ queueJobId: queueJob.id, error }, "failed malformed queue message");
        continue;
      }

      try {
        await input.processJob(queueJob.data.jobId);
        await input.queue.complete(queueJob.id);
        result.processed += 1;
        result.completed += 1;
      } catch (error) {
        await input.queue.fail(queueJob.id, error);
        result.failed += 1;
        input.logger.error({ queueJobId: queueJob.id, jobId: queueJob.data.jobId, error }, "failed queue job");
      }
    }
  }

  input.logger.info(result, "worker drain reached max jobs");
  return result;
}
