import { access, mkdir, open, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { parse, stringify } from "yaml";
import { z } from "zod";
import type { GlobalConfig, RelunarConfig, RepoSlug } from "./types";

const evidenceGateSchema = z
  .object({
    requireReproCommand: z.boolean().optional(),
    requireNonZeroExit: z.boolean().optional(),
    requireZeroExit: z.boolean().optional(),
    requireProbeOutput: z.boolean().optional(),
    requireProbeSignal: z.boolean().optional(),
    requireOutputMatch: z.string().min(1).optional(),
    requireArtifacts: z.array(z.string().min(1)).optional(),
  })
  .optional();

const configSchema = z.object({
  version: z.literal(1).default(1),
  setup: z.array(z.string().min(1)).default(["bun install"]),
  baseline: z.array(z.string().min(1)).default(["bun run typecheck", "bun test"]),
  sandbox: z
    .object({
      image: z.string().min(1).optional(),
      snapshot: z.string().min(1).optional(),
      resources: z
        .object({
          cpu: z.number().positive().optional(),
          memory: z.number().positive().optional(),
          disk: z.number().positive().optional(),
        })
        .optional(),
      autoStopMinutes: z.number().int().min(0).optional(),
    })
    .refine((sandbox) => !sandbox.resources || sandbox.image !== undefined, {
      message: "sandbox.resources requires sandbox.image",
    })
    .refine((sandbox) => !(sandbox.image && sandbox.snapshot), {
      message: "sandbox.image and sandbox.snapshot are mutually exclusive",
    })
    .optional(),
  sync: z
    .object({
      onExec: z.boolean().optional(),
      includeUntracked: z.boolean().optional(),
      exclude: z.array(z.string().min(1)).optional(),
    })
    .optional(),
  workspace: z
    .object({
      workdir: z.string().min(1).optional(),
      checkout: z.string().min(1).optional(),
      fetchDepth: z.number().int().min(0).optional(),
      submodules: z.boolean().optional(),
      lfs: z.boolean().optional(),
    })
    .optional(),
  environment: z
    .object({
      variables: z.record(z.string(), z.string()).optional(),
      passthrough: z.array(z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/)).optional(),
    })
    .optional(),
  services: z
    .array(z.object({
      name: z.string().min(1),
      start: z.string().min(1),
      ready: z.string().min(1),
      stop: z.string().min(1).optional(),
    }))
    .optional(),
  artifacts: z
    .object({ collect: z.array(z.string().min(1)).default([]) })
    .optional(),
  evidence: z
    .object({
      reproduced: evidenceGateSchema,
      not_reproduced: evidenceGateSchema,
      blocked: evidenceGateSchema,
    })
    .optional(),
  commandTimeoutSeconds: z.number().int().positive().default(300),
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

/** Default idle TTL: 60 minutes. Refreshed on each resume. */
export const DEFAULT_AUTO_STOP_MINUTES = 60;

export const defaultRelunarConfig: RelunarConfig = {
  version: 1,
  setup: ["bun install"],
  baseline: ["bun run typecheck", "bun test"],
  sandbox: {
    autoStopMinutes: DEFAULT_AUTO_STOP_MINUTES,
  },
  sync: {
    onExec: false,
    includeUntracked: false,
  },
  commandTimeoutSeconds: 300,
  report: {
    maxLogLines: 200,
  },
};

export function isRepoSlug(value: unknown): value is RepoSlug {
  return typeof value === "string" && /^[^/\s]+\/[^/\s]+$/.test(value);
}

export function parseRelunarConfig(raw: string): RelunarConfig {
  const parsed = parse(raw) as unknown;
  const config = configSchema.parse(parsed);
  return {
    ...config,
    sandbox: {
      ...config.sandbox,
      autoStopMinutes: config.sandbox?.autoStopMinutes ?? DEFAULT_AUTO_STOP_MINUTES,
    },
    sync: {
      onExec: config.sync?.onExec ?? false,
      includeUntracked: config.sync?.includeUntracked ?? false,
      ...(config.sync?.exclude ? { exclude: config.sync.exclude } : {}),
    },
    ...(config.evidence ? { evidence: config.evidence } : {}),
  };
}

export function renderRelunarConfig(config: RelunarConfig = defaultRelunarConfig): string {
  return stringify(config);
}

export async function writeRelunarConfig(path: string): Promise<void> {
  await writeFile(path, renderRelunarConfig(await detectInitConfig(dirname(path))), { flag: "wx" });
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
  await withConfigLock(path, () => writeGlobalConfigUnlocked(config, path));
}

export async function linkRepo(cwd: string, repo: RepoSlug, path = globalConfigPath()): Promise<GlobalConfig> {
  return withConfigLock(path, async () => {
    const config = await readGlobalConfig(path);
    const next: GlobalConfig = {
      ...config,
      repoLinks: {
        ...config.repoLinks,
        [cwd]: repo,
      },
    };
    await writeGlobalConfigUnlocked(next, path);
    return next;
  });
}

export async function findLinkedRepo(cwd: string, path = globalConfigPath()): Promise<RepoSlug | null> {
  const config = await readGlobalConfig(path);
  return config.repoLinks[cwd] ?? null;
}

export function resolveAutoStopMinutes(config: RelunarConfig): number {
  return config.sandbox?.autoStopMinutes ?? DEFAULT_AUTO_STOP_MINUTES;
}

function isNotFound(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

async function detectInitConfig(cwd: string): Promise<RelunarConfig> {
  if (await exists(join(cwd, "go.mod"))) {
    return { ...defaultRelunarConfig, setup: ["go mod download"], baseline: ["go test ./..."] };
  }
  if (await exists(join(cwd, "Cargo.toml"))) {
    return { ...defaultRelunarConfig, setup: ["cargo fetch"], baseline: ["cargo test --no-run"] };
  }
  if (await exists(join(cwd, "pyproject.toml")) || await exists(join(cwd, "setup.py"))) {
    return {
      ...defaultRelunarConfig,
      setup: ["python3 -m venv .venv", ". .venv/bin/activate && python -m pip install -e ."],
      baseline: [". .venv/bin/activate && python -m pip check"],
    };
  }
  if (await exists(join(cwd, "package-lock.json"))) {
    return { ...defaultRelunarConfig, setup: ["npm ci"], baseline: ["npm test"] };
  }
  if (await exists(join(cwd, "pnpm-lock.yaml"))) {
    return { ...defaultRelunarConfig, setup: ["corepack enable && pnpm install --frozen-lockfile"], baseline: ["pnpm test"] };
  }
  if (await exists(join(cwd, "yarn.lock"))) {
    return { ...defaultRelunarConfig, setup: ["corepack enable && yarn install --immutable"], baseline: ["yarn test"] };
  }
  return defaultRelunarConfig;
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function writeGlobalConfigUnlocked(config: GlobalConfig, path: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temp = `${path}.tmp-${randomUUID()}`;
  try {
    await writeFile(temp, `${JSON.stringify(globalConfigSchema.parse(config), null, 2)}\n`, "utf8");
    await rename(temp, path);
  } finally {
    await unlink(temp).catch(() => undefined);
  }
}

async function withConfigLock<T>(path: string, action: () => Promise<T>): Promise<T> {
  await mkdir(dirname(path), { recursive: true });
  const lockPath = `${path}.lock`;
  const deadline = Date.now() + 30_000;
  while (true) {
    try {
      const handle = await open(lockPath, "wx");
      await handle.close();
      try {
        return await action();
      } finally {
        await unlink(lockPath).catch(() => undefined);
      }
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "EEXIST")) throw error;
      if (Date.now() >= deadline) throw new Error("Timed out waiting for Relunar global config lock.");
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }
}
