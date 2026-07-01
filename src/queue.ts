import { PgBoss } from "pg-boss";
import type { DrainQueueJob, DrainableReproQueue } from "./worker-drain";

export const reproQueueName = "repro_jobs";

export type ReproJobMessage = {
  jobId: string;
};

export interface ReproQueue {
  enqueue(message: ReproJobMessage): Promise<string>;
}

export class PgBossReproQueue implements ReproQueue {
  constructor(private readonly boss: PgBoss) {}

  async enqueue(message: ReproJobMessage): Promise<string> {
    const id = await this.boss.send(reproQueueName, message, {
      retryLimit: 2,
      retryBackoff: true,
      expireInSeconds: 900,
    });

    if (!id) {
      throw new Error("pg-boss returned no job id");
    }

    return id;
  }
}

export class PgBossDrainableReproQueue implements DrainableReproQueue {
  constructor(private readonly boss: PgBoss) {}

  async fetch(batchSize: number): Promise<DrainQueueJob[]> {
    return await this.boss.fetch<ReproJobMessage>(reproQueueName, { batchSize });
  }

  async complete(queueJobId: string): Promise<void> {
    await this.boss.complete(reproQueueName, queueJobId);
  }

  async fail(queueJobId: string, error?: unknown): Promise<void> {
    const message = error instanceof Error ? error.message : "unknown worker drain error";
    await this.boss.fail(reproQueueName, queueJobId, { error: message });
  }
}

export async function createPgBoss(databaseUrl: string): Promise<PgBoss> {
  const boss = new PgBoss({
    connectionString: databaseUrl,
    application_name: "relunar",
  });
  await boss.start();
  await boss.createQueue(reproQueueName, {
    retryLimit: 2,
    retryBackoff: true,
    expireInSeconds: 900,
  });
  return boss;
}

export class MemoryReproQueue implements ReproQueue {
  readonly messages: ReproJobMessage[] = [];

  async enqueue(message: ReproJobMessage): Promise<string> {
    this.messages.push(message);
    return `queue-${this.messages.length}`;
  }
}
