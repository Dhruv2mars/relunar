import { execFile } from "node:child_process";
import { platform } from "node:os";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const servicePrefix = "relunar";

export type SecretName = "github-token" | "daytona-api-key";

export async function resolveGithubToken(env: NodeJS.ProcessEnv = process.env): Promise<string | null> {
  if (env.RELUNAR_GITHUB_TOKEN) {
    return env.RELUNAR_GITHUB_TOKEN;
  }

  const ghToken = await readGhAuthToken();
  if (ghToken) {
    return ghToken;
  }

  return readSecret("github-token");
}

export async function resolveDaytonaApiKey(env: NodeJS.ProcessEnv = process.env): Promise<string | null> {
  return env.RELUNAR_DAYTONA_API_KEY ?? (await readSecret("daytona-api-key"));
}

export async function writeSecret(name: SecretName, value: string): Promise<void> {
  if (platform() !== "darwin") {
    throw new Error(`OS keychain write unsupported on ${platform()}; set ${envName(name)} instead`);
  }

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

export async function readSecret(name: SecretName): Promise<string | null> {
  if (platform() !== "darwin") {
    return null;
  }

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

function envName(name: SecretName): string {
  return name === "github-token" ? "RELUNAR_GITHUB_TOKEN" : "RELUNAR_DAYTONA_API_KEY";
}
