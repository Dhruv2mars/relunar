import { loadWorkerConfig } from "./config";
import { createDb } from "./db/client";
import { PostgresRelunarStore } from "./db/store";
import { GitHubAppClient } from "./github/client";
import { createLogger } from "./logger";
import { createPgBoss, reproQueueName, type ReproJobMessage } from "./queue";
import { DaytonaSandboxProvider } from "./sandbox/daytona";
import { processReproJob } from "./worker-core";

const config = loadWorkerConfig();
const logger = createLogger(config.LOG_LEVEL);
const { db } = createDb(config.DATABASE_URL);
const boss = await createPgBoss(config.DATABASE_URL);
const store = new PostgresRelunarStore(db);
const daytonaOptions: ConstructorParameters<typeof DaytonaSandboxProvider>[0] = {
  apiKey: config.DAYTONA_API_KEY,
};
if (config.DAYTONA_API_URL) {
  daytonaOptions.apiUrl = config.DAYTONA_API_URL;
}
if (config.DAYTONA_TARGET) {
  daytonaOptions.target = config.DAYTONA_TARGET;
}
const sandboxProvider = new DaytonaSandboxProvider(daytonaOptions);
const github = new GitHubAppClient({
  appId: config.GITHUB_APP_ID,
  privateKey: config.GITHUB_PRIVATE_KEY,
});

await boss.work<ReproJobMessage>(reproQueueName, async (jobs) => {
  for (const job of jobs) {
    if (!job.data.jobId) {
      throw new Error("missing job id in queue message");
    }

    await processReproJob(job.data.jobId, {
      store,
      sandboxProvider,
      github,
      logger,
      runnerOptions: {
        commandTimeoutSeconds: config.COMMAND_TIMEOUT_SECONDS,
        jobTimeoutSeconds: config.JOB_TIMEOUT_SECONDS,
      },
    });
  }
});

logger.info({ queue: reproQueueName }, "relunar worker started");
