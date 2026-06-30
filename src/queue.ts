import { PgBoss } from "pg-boss";

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
