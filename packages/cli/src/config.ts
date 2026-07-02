import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { parse, stringify } from "yaml";
import { z } from "zod";
import type { GlobalConfig, RelunarConfig, RepoSlug } from "./types";

const configSchema = z.object({
  version: z.literal(1).default(1),
  setup: z.array(z.string().min(1)).default(["bun install"]),
  baseline: z.array(z.string().min(1)).default(["bun run typecheck", "bun test"]),
  report: z
    .object({
      maxLogLines: z.number().int().positive().default(200),
    })
    .default({ maxLogLines: 200 }),
});

const globalConfigSchema = z.object({
  daytona: z
    .object({
      apiUrl: z.string().url().optional(),
      target: z.string().min(1).optional(),
    })
    .optional(),
  repoLinks: z.record(z.string(), z.custom<RepoSlug>((value) => isRepoSlug(value))).default({}),
});

export const defaultRelunarConfig: RelunarConfig = {
  version: 1,
  setup: ["bun install"],
  baseline: ["bun run typecheck", "bun test"],
  report: {
    maxLogLines: 200,
  },
};

export function isRepoSlug(value: unknown): value is RepoSlug {
  return typeof value === "string" && /^[^/\s]+\/[^/\s]+$/.test(value);
}

export function parseRelunarConfig(raw: string): RelunarConfig {
  const parsed = parse(raw) as unknown;
  return configSchema.parse(parsed);
}

export function renderRelunarConfig(config: RelunarConfig = defaultRelunarConfig): string {
  return stringify(config);
}

export async function writeRelunarConfig(path: string): Promise<void> {
  await writeFile(path, renderRelunarConfig(), { flag: "wx" });
}

function configHome(env: NodeJS.ProcessEnv = process.env): string {
  return env.XDG_CONFIG_HOME ?? join(homedir(), ".config");
}

export function globalConfigPath(env: NodeJS.ProcessEnv = process.env): string {
  return join(configHome(env), "relunar", "config.json");
}

export async function readGlobalConfig(path = globalConfigPath()): Promise<GlobalConfig> {
  try {
    const raw = await readFile(path, "utf8");
    return globalConfigSchema.parse(JSON.parse(raw) as unknown);
  } catch (error) {
    if (isNotFound(error)) {
      return { repoLinks: {} };
    }
    throw error;
  }
}

export async function writeGlobalConfig(config: GlobalConfig, path = globalConfigPath()): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(globalConfigSchema.parse(config), null, 2)}\n`, "utf8");
}

export async function linkRepo(cwd: string, repo: RepoSlug, path = globalConfigPath()): Promise<GlobalConfig> {
  const config = await readGlobalConfig(path);
  const next: GlobalConfig = {
    ...config,
    repoLinks: {
      ...config.repoLinks,
      [cwd]: repo,
    },
  };
  await writeGlobalConfig(next, path);
  return next;
}

export async function findLinkedRepo(cwd: string, path = globalConfigPath()): Promise<RepoSlug | null> {
  const config = await readGlobalConfig(path);
  return config.repoLinks[cwd] ?? null;
}

function isNotFound(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}
