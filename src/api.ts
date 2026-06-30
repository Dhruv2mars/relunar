import { serve } from "bun";
import { loadConfig } from "./config";
import { createDb } from "./db/client";
import { PostgresRelunarStore } from "./db/store";
import { createApp } from "./http/app";
import { createLogger } from "./logger";
import { createPgBoss, PgBossReproQueue } from "./queue";

const config = loadConfig();
const logger = createLogger(config.LOG_LEVEL);
const { db } = createDb(config.DATABASE_URL);
const boss = await createPgBoss(config.DATABASE_URL);
const store = new PostgresRelunarStore(db);
const queue = new PgBossReproQueue(boss);
const app = createApp({
  webhookSecret: config.GITHUB_WEBHOOK_SECRET,
  store,
  queue,
  logger,
});

serve({
  port: config.PORT,
  fetch: app.fetch,
});

logger.info({ port: config.PORT }, "relunar api started");
