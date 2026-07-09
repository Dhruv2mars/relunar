import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveDaytonaApiKey, resolveGithubToken, writeSecret } from "../src/credentials";

describe("credentials", () => {
  test("stores and resolves local Daytona secrets", async () => {
      const dir = await mkdtemp(join(tmpdir(), "relunar-secrets-daytona-"));
    try {
      const env = localSecretEnv(dir);
      await expect(writeSecret("daytona-api-key", "daytona-local", env)).resolves.toBe("local");

      expect(await resolveDaytonaApiKey(env)).toBe("daytona-local");
      expect(await readSecretFile(dir)).toContain("daytona-local");
      expect(await hasOwnerOnlyPermissions(dir)).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("stores and resolves local GitHub secrets when gh lookup is disabled", async () => {
    const dir = await mkdtemp(join(tmpdir(), "relunar-secrets-github-"));
    try {
      const env = {
        ...localSecretEnv(dir),
        RELUNAR_SKIP_GH_AUTH_TOKEN: "1",
      };
      await writeSecret("github-token", "github-local", env);

      expect(await resolveGithubToken(env)).toBe("github-local");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("environment variables override stored secrets", async () => {
    const dir = await mkdtemp(join(tmpdir(), "relunar-secrets-env-"));
    try {
      const env = localSecretEnv(dir);
      await writeSecret("daytona-api-key", "daytona-local", env);

      expect(await resolveDaytonaApiKey({ ...env, RELUNAR_DAYTONA_API_KEY: "daytona-env" })).toBe("daytona-env");
      expect(await resolveDaytonaApiKey({ ...env, RELUNAR_DAYTONA_API_KEY: "" })).toBe("daytona-local");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

function localSecretEnv(dir: string): NodeJS.ProcessEnv {
  return {
    XDG_CONFIG_HOME: join(dir, "config"),
    RELUNAR_SECRET_STORE: "local",
  };
}

async function readSecretFile(dir: string): Promise<string> {
  return readFile(join(dir, "config", "relunar", "secrets.json"), "utf8");
}

async function hasOwnerOnlyPermissions(dir: string): Promise<boolean> {
  if (process.platform === "win32") {
    return true;
  }
  const mode = (await stat(join(dir, "config", "relunar", "secrets.json"))).mode & 0o777;
  return mode === 0o600;
}
