import { describe, expect, test } from "bun:test";
import { drainReproQueue, type DrainableReproQueue } from "../src/worker-drain";

describe("worker drain", () => {
  test("processes ready jobs once and exits when queue is empty", async () => {
    const queue = new FakeDrainQueue([
      [{ id: "queue-1", data: { jobId: "job-1" } }],
      [{ id: "queue-2", data: { jobId: "job-2" } }],
      [],
    ]);
    const processed: string[] = [];

    const result = await drainReproQueue({
      queue,
      batchSize: 1,
      maxJobs: 10,
      logger: silentLogger,
      processJob: async (jobId) => {
        processed.push(jobId);
      },
    });

    expect(result).toEqual({ processed: 2, completed: 2, failed: 0 });
    expect(processed).toEqual(["job-1", "job-2"]);
    expect(queue.completed).toEqual(["queue-1", "queue-2"]);
    expect(queue.failed).toEqual([]);
    expect(queue.fetchCalls).toBe(3);
  });

  test("fails malformed queue messages without processing", async () => {
    const queue = new FakeDrainQueue([
      [{ id: "queue-1", data: {} }],
      [],
    ]);

    const result = await drainReproQueue({
      queue,
      batchSize: 1,
      maxJobs: 10,
      logger: silentLogger,
      processJob: async () => {
        throw new Error("should not process missing job id");
      },
    });

    expect(result).toEqual({ processed: 0, completed: 0, failed: 1 });
    expect(queue.completed).toEqual([]);
    expect(queue.failed).toEqual(["queue-1"]);
  });

  test("fails queue messages when processing throws", async () => {
    const queue = new FakeDrainQueue([
      [{ id: "queue-1", data: { jobId: "job-1" } }],
      [],
    ]);

    const result = await drainReproQueue({
      queue,
      batchSize: 1,
      maxJobs: 10,
      logger: silentLogger,
      processJob: async () => {
        throw new Error("sandbox unavailable");
      },
    });

    expect(result).toEqual({ processed: 0, completed: 0, failed: 1 });
    expect(queue.completed).toEqual([]);
    expect(queue.failed).toEqual(["queue-1"]);
  });

  test("stops after max jobs even when backlog remains", async () => {
    const queue = new FakeDrainQueue([
      [
        { id: "queue-1", data: { jobId: "job-1" } },
        { id: "queue-2", data: { jobId: "job-2" } },
      ],
    ]);
    const processed: string[] = [];

    const result = await drainReproQueue({
      queue,
      batchSize: 2,
      maxJobs: 1,
      logger: silentLogger,
      processJob: async (jobId) => {
        processed.push(jobId);
      },
    });

    expect(result).toEqual({ processed: 1, completed: 1, failed: 0 });
    expect(processed).toEqual(["job-1"]);
    expect(queue.completed).toEqual(["queue-1"]);
    expect(queue.failed).toEqual([]);
    expect(queue.fetchCalls).toBe(1);
  });
});

class FakeDrainQueue implements DrainableReproQueue {
  readonly completed: string[] = [];
  readonly failed: string[] = [];
  fetchCalls = 0;

  constructor(private readonly batches: Array<Array<{ id: string; data: { jobId?: string } }>>) {}

  async fetch(batchSize: number): Promise<Array<{ id: string; data: { jobId?: string } }>> {
    this.fetchCalls += 1;
    return (this.batches.shift() ?? []).slice(0, batchSize);
  }

  async complete(queueJobId: string): Promise<void> {
    this.completed.push(queueJobId);
  }

  async fail(queueJobId: string): Promise<void> {
    this.failed.push(queueJobId);
  }
}

const silentLogger = {
  info: () => undefined,
  error: () => undefined,
};
