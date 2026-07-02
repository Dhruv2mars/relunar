import { describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runCli } from "../src/cli";
import { linkRepo } from "../src/config";
import type { SecretName } from "../src/credentials";
import type { SetupPrompter } from "../src/setup";

describe("cli", () => {
  test("prints help", async () => {
    const output = await invoke(["help"]);
    expect(output.code).toBe(0);
    expect(output.stdout).toContain("relunar repro <issue-number>");
    expect(output.stdout).toContain("Agent workflow");
    expect(output.stdout).toContain("Machine setup");
  });

  test("prints supported skills", async () => {
    const output = await invoke(["skills", "list"]);
    expect(output.code).toBe(0);
    expect(output.stdout).toContain("codex");
  });

  test("shows missing doctor checks", async () => {
    const dir = await mkdtemp(join(tmpdir(), "relunar-cli-"));
    try {
      const output = await invoke(["doctor", "--json"], dir, { XDG_CONFIG_HOME: join(dir, "config"), RELUNAR_SKIP_GH_AUTH_TOKEN: "1" });
      expect(output.code).toBe(1);
      expect(JSON.parse(output.stdout)[0].name).toBe("repo linked");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("repo link persists for current cwd", async () => {
    const dir = await mkdtemp(join(tmpdir(), "relunar-link-"));
    try {
      const env = { XDG_CONFIG_HOME: join(dir, "config"), RELUNAR_SKIP_GH_AUTH_TOKEN: "1" };
      const output = await invoke(["repo", "link", "owner/repo"], dir, env);
      expect(output.code).toBe(0);
      await linkRepo(join(dir, "other"), "owner/other", join(dir, "config", "relunar", "config.json"));
      const doctor = await invoke(["doctor", "--json"], dir, env);
      expect(JSON.parse(doctor.stdout)[0].detail).toBe("owner/repo");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("setup prompts for missing Daytona auth and writes config", async () => {
    const dir = await mkdtemp(join(tmpdir(), "relunar-setup-"));
    try {
      const secrets: Array<{ name: SecretName; value: string }> = [];
      const output = await invoke(["setup"], dir, { XDG_CONFIG_HOME: join(dir, "config"), RELUNAR_GITHUB_TOKEN: "gh-token" }, {
        prompt: scriptedPrompt(["daytona-key", "https://daytona.example/api", "us", "owner/repo"]),
        secretWriter: async (name, value) => {
          secrets.push({ name, value });
        },
      });

      expect(output.code).toBe(0);
      expect(output.stdout).toContain("Relunar setup complete");
      expect(secrets).toEqual([
        { name: "daytona-api-key", value: "daytona-key" },
      ]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("auth commands use injected secret writer and do not require keychain for env credentials", async () => {
    const dir = await mkdtemp(join(tmpdir(), "relunar-auth-"));
    try {
      const secrets: Array<{ name: SecretName; value: string }> = [];
      const github = await invoke(["auth", "github", "--token", "gh-token"], dir, { XDG_CONFIG_HOME: join(dir, "config") }, {
        secretWriter: async (name, value) => {
          secrets.push({ name, value });
        },
      });
      expect(github.code).toBe(0);
      expect(github.stdout).toContain("GitHub auth saved");

      const daytona = await invoke(["auth", "daytona"], dir, {
        XDG_CONFIG_HOME: join(dir, "config"),
        RELUNAR_DAYTONA_API_KEY: "daytona-from-env",
      }, {
        secretWriter: async () => {
          throw new Error("should not write env key");
        },
      });
      expect(daytona.code).toBe(0);
      expect(daytona.stdout).toContain("Daytona auth available from environment");
      expect(secrets).toEqual([{ name: "github-token", value: "gh-token" }]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("init reports existing config without overwriting it", async () => {
    const dir = await mkdtemp(join(tmpdir(), "relunar-init-"));
    try {
      expect((await invoke(["init"], dir)).code).toBe(0);
      const second = await invoke(["init"], dir);
      expect(second.code).toBe(1);
      expect(second.stderr).toContain(".relunar.yml already exists");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("first run starts interactive setup when setup is incomplete", async () => {
    const dir = await mkdtemp(join(tmpdir(), "relunar-first-run-"));
    try {
      const output = await invoke([], dir, { XDG_CONFIG_HOME: join(dir, "config"), RELUNAR_SKIP_GH_AUTH_TOKEN: "1" }, {
        prompt: scriptedPrompt(["", "", "https://app.daytona.io/api", "", ""]),
        secretWriter: async () => undefined,
      });

      expect(output.code).toBe(1);
      expect(output.stdout).toContain("Relunar CLI");
      expect(output.stdout).toContain("Relunar setup");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

async function invoke(
  argv: string[],
  cwd = process.cwd(),
  env: NodeJS.ProcessEnv = {},
  extra: {
    prompt?: SetupPrompter;
    secretWriter?: (name: SecretName, value: string) => Promise<void>;
  } = {},
) {
  let stdout = "";
  let stderr = "";
  const code = await runCli(argv, {
    cwd,
    env,
    ...extra,
    io: {
      stdout: (message) => {
        stdout += message;
      },
      stderr: (message) => {
        stderr += message;
      },
    },
  });
  return { code, stdout, stderr };
}

function scriptedPrompt(answers: string[]): SetupPrompter {
  const queue = [...answers];
  return {
    text: async (_message, options) => {
      const answer = queue.shift();
      return answer === undefined || answer === "" ? options?.defaultValue ?? "" : answer;
    },
    confirm: async () => false,
  };
}
