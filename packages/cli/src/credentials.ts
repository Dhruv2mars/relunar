import { execFile } from "node:child_process";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir, platform } from "node:os";
import { dirname, join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const servicePrefix = "relunar";

export type SecretName = "github-token" | "daytona-api-key";

export async function resolveGithubToken(env: NodeJS.ProcessEnv = process.env): Promise<string | null> {
  if (env.RELUNAR_GITHUB_TOKEN) {
    return env.RELUNAR_GITHUB_TOKEN;
  }

  if (env.RELUNAR_SKIP_GH_AUTH_TOKEN !== "1") {
    const ghToken = await readGhAuthToken();
    if (ghToken) {
      return ghToken;
    }
  }

  return readSecret("github-token", env);
}

export async function resolveDaytonaApiKey(env: NodeJS.ProcessEnv = process.env): Promise<string | null> {
  return env.RELUNAR_DAYTONA_API_KEY ?? (await readSecret("daytona-api-key", env));
}

export async function writeSecret(name: SecretName, value: string, env: NodeJS.ProcessEnv = process.env): Promise<void> {
  if (env.RELUNAR_SECRET_STORE === "local") {
    await writeLocalSecret(name, value, env);
    return;
  }

  if (platform() === "darwin") {
    try {
      await writeKeychainSecret(name, value);
      return;
    } catch (error) {
      if (env.RELUNAR_SECRET_STORE === "keychain") {
        throw error;
      }
    }
  }

  await writeLocalSecret(name, value, env);
}

async function readSecret(name: SecretName, env: NodeJS.ProcessEnv): Promise<string | null> {
  if (env.RELUNAR_SECRET_STORE !== "local" && platform() === "darwin") {
    const keychainSecret = await readKeychainSecret(name);
    if (keychainSecret) {
      return keychainSecret;
    }
  }

  return readLocalSecret(name, env);
}

async function writeKeychainSecret(name: SecretName, value: string): Promise<void> {
  await execFileAsync("security", [
    "add-generic-password",
    "-a",
    servicePrefix,
    "-s",
    serviceName(name),
    "-w",
    value,
    "-U",
  ]);
}

async function readKeychainSecret(name: SecretName): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync("security", [
      "find-generic-password",
      "-a",
      servicePrefix,
      "-s",
      serviceName(name),
      "-w",
    ]);
    const token = stdout.trim();
    return token.length > 0 ? token : null;
  } catch {
    return null;
  }
}

async function writeLocalSecret(name: SecretName, value: string, env: NodeJS.ProcessEnv): Promise<void> {
  const path = localSecretPath(env);
  const current = await readLocalSecrets(path);
  const next: LocalSecrets = {
    ...current,
    [name]: value,
  };
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(next, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  await chmod(path, 0o600).catch(() => undefined);
}

async function readLocalSecret(name: SecretName, env: NodeJS.ProcessEnv): Promise<string | null> {
  const value = (await readLocalSecrets(localSecretPath(env)))[name];
  return typeof value === "string" && value.length > 0 ? value : null;
}

async function readLocalSecrets(path: string): Promise<LocalSecrets> {
  try {
    const raw = await readFile(path, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!isLocalSecrets(parsed)) {
      return {};
    }
    return parsed;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return {};
    }
    throw error;
  }
}

async function readGhAuthToken(): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync("gh", ["auth", "token"]);
    const token = stdout.trim();
    return token.length > 0 ? token : null;
  } catch {
    return null;
  }
}

function serviceName(name: SecretName): string {
  return `${servicePrefix}:${name}`;
}

function localSecretPath(env: NodeJS.ProcessEnv): string {
  const configHome = env.XDG_CONFIG_HOME ?? join(homedir(), ".config");
  return join(configHome, "relunar", "secrets.json");
}

function isLocalSecrets(value: unknown): value is LocalSecrets {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const secrets = value as Record<string, unknown>;
  return Object.values(secrets).every((secret) => typeof secret === "string");
}

type LocalSecrets = Partial<Record<SecretName, string>>;
