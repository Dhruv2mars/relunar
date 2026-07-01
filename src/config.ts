import { z } from "zod";

const baseEnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.string().default("info"),
});

const apiEnvSchema = baseEnvSchema.extend({
  GITHUB_WEBHOOK_SECRET: z.string().min(1),
});

const workerEnvSchema = baseEnvSchema.extend({
  GITHUB_APP_ID: z.coerce.number().int().positive(),
  GITHUB_PRIVATE_KEY: z.string().min(1),
  DAYTONA_API_KEY: z.string().min(1),
  DAYTONA_API_URL: z.string().url().optional(),
  DAYTONA_TARGET: z.string().min(1).optional(),
  JOB_TIMEOUT_SECONDS: z.coerce.number().int().positive().default(900),
  COMMAND_TIMEOUT_SECONDS: z.coerce.number().int().positive().default(300),
  WORKER_BATCH_SIZE: z.coerce.number().int().positive().default(1),
  WORKER_MAX_JOBS: z.coerce.number().int().positive().default(5),
});

export type ApiConfig = z.infer<typeof apiEnvSchema>;
export type WorkerConfig = z.infer<typeof workerEnvSchema>;

export function loadApiConfig(env: NodeJS.ProcessEnv = process.env): ApiConfig {
  return apiEnvSchema.parse(env);
}

export function loadWorkerConfig(env: NodeJS.ProcessEnv = process.env): WorkerConfig {
  return workerEnvSchema.parse(env);
}
