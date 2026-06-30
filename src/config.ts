import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  GITHUB_APP_ID: z.coerce.number().int().positive(),
  GITHUB_PRIVATE_KEY: z.string().min(1),
  GITHUB_WEBHOOK_SECRET: z.string().min(1),
  DAYTONA_API_KEY: z.string().min(1),
  DAYTONA_API_URL: z.string().url().optional(),
  DAYTONA_TARGET: z.string().min(1).optional(),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.string().default("info"),
  JOB_TIMEOUT_SECONDS: z.coerce.number().int().positive().default(900),
  COMMAND_TIMEOUT_SECONDS: z.coerce.number().int().positive().default(300),
});

export type AppConfig = z.infer<typeof envSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return envSchema.parse(env);
}
