import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
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
    expect(output.stdout).toContain("relunar repro start <issue-number>");
    expect(output.stdout).toContain(
      "relunar repro <issue-number> --claim <issue-behavior> [--sync]",
    );
    expect(output.stdout).toContain("relunar repro sync <run-id>");
    expect(output.stdout).toContain("relunar repro evidence <run-id>");
    expect(output.stdout).toContain("relunar repro finish <run-id>");
    expect(output.stdout).toContain("Agent workflow");
    expect(output.stdout).toContain(
      "environment_ready means the sandbox is ready",
    );
    expect(output.stdout).toContain("Sandbox stays warm until finish/abort");
    expect(output.stdout).toContain("derives trust from assertions");
    expect(output.stdout).toContain("Machine setup");
    expect(output.stdout).toContain("--expect-exit");
    expect(output.stdout).toContain("--output-match");
    expect(output.stdout).toContain("--repeat");
  });

  test("prints help for the conventional --help flag", async () => {
    const output = await invoke(["--help"]);
    expect(output.code).toBe(0);
    expect(output.stdout).toContain("Agent workflow");
    expect(output.stdout).toContain("relunar skills list|get|install [agent]");
    expect(output.stdout).not.toContain("Setup complete. Useful next commands");
  });

  test("prints the packaged version without requiring setup", async () => {
    const flag = await invoke(["--version"]);
    expect(flag).toEqual({ code: 0, stdout: "0.3.0\n", stderr: "" });

    const command = await invoke(["version"]);
    expect(command).toEqual({ code: 0, stdout: "0.3.0\n", stderr: "" });
  });

  test("prints focused help for repro lifecycle subcommands", async () => {
    const exec = await invoke(["repro", "exec", "--help"]);
    expect(exec.code).toBe(0);
    expect(exec.stdout).toContain("Usage: relunar repro exec <run-id>");
    expect(exec.stdout).toContain("return an evidenceId");
    expect(exec.stdout).not.toContain("Human setup");

    const finish = await invoke(["repro", "finish", "--help"]);
    expect(finish.code).toBe(0);
    expect(finish.stdout).toContain("Select only evidence for the issue claim");

    const evidence = await invoke(["repro", "evidence", "--help"]);
    expect(evidence.code).toBe(0);
    expect(evidence.stdout).toContain("exact selectable evidence IDs");
  });

  test("probe assertion flags validate before auth and network work", async () => {
    const dir = await mkdtemp(join(tmpdir(), "relunar-probe-flags-"));
    try {
      const output = await invoke(
        ["repro", "exec", "run-1", "--repeat", "0", "--", "echo", "hello"],
        dir,
        {
          XDG_CONFIG_HOME: join(dir, "config"),
          RELUNAR_SKIP_GH_AUTH_TOKEN: "1",
        },
      );
      expect(output.code).toBe(1);
      expect(output.stderr).toContain("--repeat must be a positive integer");
      expect(output.stderr).not.toContain("No repo linked");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("lists concise evidence without auth or sandbox access", async () => {
    const dir = await mkdtemp(join(tmpdir(), "relunar-evidence-"));
    try {
      const runDir = join(dir, ".relunar", "runs", "run-1");
      await mkdir(runDir, { recursive: true });
      await Bun.write(join(runDir, "report.json"), JSON.stringify({
        schemaVersion: 2,
        runId: "run-1",
        trust: "unverified",
        commands: [{
          name: "repro",
          command: "echo panic",
          claim: "Command emits panic",
          evidenceId: "probe-1",
          verification: { verified: true, passed: true, attempt: 1, totalAttempts: 1, checks: [] },
        }],
      }));
      const output = await invoke(["repro", "evidence", "run-1", "--json"], dir, {
        XDG_CONFIG_HOME: join(dir, "config"),
        RELUNAR_SKIP_GH_AUTH_TOKEN: "1",
      });
      expect(output.code).toBe(0);
      expect(JSON.parse(output.stdout)).toEqual([expect.objectContaining({
        evidenceId: "probe-1",
        claim: "Command emits panic",
        passed: true,
      })]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("refuses to clean up an unfinished run before auth or sandbox access", async () => {
    const dir = await mkdtemp(join(tmpdir(), "relunar-cleanup-guard-"));
    try {
      const runDir = join(dir, ".relunar", "runs", "run-1");
      await mkdir(runDir, { recursive: true });
      await Bun.write(join(runDir, "report.json"), JSON.stringify({
        schemaVersion: 2,
        runId: "run-1",
        status: "environment_ready",
        trust: "unverified",
        commands: [],
      }));
      const output = await invoke(["repro", "cleanup", "run-1"], dir, {
        XDG_CONFIG_HOME: join(dir, "config"),
        RELUNAR_SKIP_GH_AUTH_TOKEN: "1",
      });
      expect(output.code).toBe(1);
      expect(output.stderr).toContain("Cannot clean up an unfinished run");
      expect(output.stderr).toContain("repro abort");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("cleanup does not require repository or GitHub configuration", async () => {
    const dir = await mkdtemp(join(tmpdir(), "relunar-cleanup-prereqs-"));
    try {
      const runDir = join(dir, ".relunar", "runs", "run-1");
      await mkdir(runDir, { recursive: true });
      await Bun.write(join(runDir, "report.json"), JSON.stringify({
        schemaVersion: 2,
        runId: "run-1",
        status: "reproduced",
        trust: "verified",
        sandbox: { provider: "daytona", id: null, target: null },
        commands: [],
      }));
      const output = await invoke(["repro", "cleanup", "run-1"], dir, {
        XDG_CONFIG_HOME: join(dir, "config"),
        RELUNAR_SKIP_GH_AUTH_TOKEN: "1",
      });
      expect(output.code).toBe(1);
      expect(output.stderr).not.toContain("No repo linked");
      expect(output.stderr).not.toContain("GitHub token");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("prints supported skills", async () => {
    const output = await invoke(["skills", "list"]);
    expect(output.code).toBe(0);
    expect(output.stdout).toContain("codex");
  });

  test("prints agent skill with safe workflow rules", async () => {
    const output = await invoke(["skills", "get", "codex"]);
    expect(output.code).toBe(0);
    expect(output.stdout).toContain("Start with `relunar doctor --json`");
    expect(output.stdout).toContain(
      "relunar issues list --state open --limit 20 --json",
    );
    expect(output.stdout).toContain("Put `--comment` only on `repro finish`");
    expect(output.stdout).toContain(
      "explicit assertions until issue-specific evidence exists",
    );
    expect(output.stdout).toContain("Raw output is not verified proof");
    expect(output.stdout).toContain("relunar runs show <run-id> --json");

    const cursor = await invoke(["skills", "get", "cursor"]);
    expect(cursor.code).toBe(0);
    expect(cursor.stdout).toContain("-- bash -c '<script>'");
    expect(cursor.stdout).toContain("avoid login shells");
  });

  test("shows missing doctor checks", async () => {
    const dir = await mkdtemp(join(tmpdir(), "relunar-cli-"));
    try {
      const output = await invoke(["doctor", "--json"], dir, {
        XDG_CONFIG_HOME: join(dir, "config"),
        RELUNAR_SKIP_GH_AUTH_TOKEN: "1",
      });
      expect(output.code).toBe(1);
      expect(JSON.parse(output.stdout)[0].name).toBe("repo linked");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("repo link persists for current cwd", async () => {
    const dir = await mkdtemp(join(tmpdir(), "relunar-link-"));
    try {
      const env = {
        XDG_CONFIG_HOME: join(dir, "config"),
        RELUNAR_SKIP_GH_AUTH_TOKEN: "1",
      };
      const output = await invoke(["repo", "link", "owner/repo"], dir, env);
      expect(output.code).toBe(0);
      await linkRepo(
        join(dir, "other"),
        "owner/other",
        join(dir, "config", "relunar", "config.json"),
      );
      const doctor = await invoke(["doctor", "--json"], dir, env);
      expect(JSON.parse(doctor.stdout)[0].detail).toBe("owner/repo");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("issues list rejects invalid state before network work", async () => {
    const dir = await mkdtemp(join(tmpdir(), "relunar-issues-state-"));
    try {
      const env = {
        XDG_CONFIG_HOME: join(dir, "config"),
        RELUNAR_GITHUB_TOKEN: "gh-token",
      };
      await invoke(["repo", "link", "owner/repo"], dir, env);
      const output = await invoke(
        ["issues", "list", "--state", "merged"],
        dir,
        env,
      );
      expect(output.code).toBe(1);
      expect(output.stderr).toContain("Invalid issue state");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("issues list rejects invalid limit before network work", async () => {
    const dir = await mkdtemp(join(tmpdir(), "relunar-issues-limit-"));
    try {
      const env = {
        XDG_CONFIG_HOME: join(dir, "config"),
        RELUNAR_GITHUB_TOKEN: "gh-token",
      };
      await invoke(["repo", "link", "owner/repo"], dir, env);
      const output = await invoke(
        ["issues", "list", "--limit", "nope"],
        dir,
        env,
      );
      expect(output.code).toBe(1);
      expect(output.stderr).toContain("Invalid limit");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("repro all-open rejects invalid limit before Daytona setup", async () => {
    const dir = await mkdtemp(join(tmpdir(), "relunar-repro-limit-"));
    try {
      const env = {
        XDG_CONFIG_HOME: join(dir, "config"),
        RELUNAR_GITHUB_TOKEN: "gh-token",
        RELUNAR_DAYTONA_API_KEY: "daytona-key",
      };
      await invoke(["repo", "link", "owner/repo"], dir, env);
      const output = await invoke(
        ["repro", "--all-open", "--limit", "0"],
        dir,
        env,
      );
      expect(output.code).toBe(1);
      expect(output.stderr).toContain("Invalid limit");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("setup prompts for missing Daytona auth and writes config", async () => {
    const dir = await mkdtemp(join(tmpdir(), "relunar-setup-"));
    try {
      const secrets: Array<{ name: SecretName; value: string }> = [];
      const output = await invoke(
        ["setup"],
        dir,
        {
          XDG_CONFIG_HOME: join(dir, "config"),
          RELUNAR_GITHUB_TOKEN: "gh-token",
          RELUNAR_SECRET_STORE: "local",
        },
        {
          prompt: scriptedPrompt([
            "daytona-key",
            "https://daytona.example/api",
            "us",
            "owner/repo",
          ]),
          secretWriter: async (name, value) => {
            secrets.push({ name, value });
          },
        },
      );

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
      const github = await invoke(
        ["auth", "github", "--token", "gh-token"],
        dir,
        { XDG_CONFIG_HOME: join(dir, "config") },
        {
          secretWriter: async (name, value) => {
            secrets.push({ name, value });
          },
        },
      );
      expect(github.code).toBe(0);
      expect(github.stdout).toContain("GitHub auth saved");

      const daytona = await invoke(
        ["auth", "daytona"],
        dir,
        {
          XDG_CONFIG_HOME: join(dir, "config"),
          RELUNAR_DAYTONA_API_KEY: "daytona-from-env",
        },
        {
          secretWriter: async () => {
            throw new Error("should not write env key");
          },
        },
      );
      expect(daytona.code).toBe(0);
      expect(daytona.stdout).toContain(
        "Daytona auth available from environment",
      );
      expect(secrets).toEqual([{ name: "github-token", value: "gh-token" }]);

      const savedDaytona = await invoke(
        ["auth", "daytona", "--api-key", "daytona-from-arg"],
        dir,
        {
          XDG_CONFIG_HOME: join(dir, "config"),
        },
        {
          secretWriter: async (name, value) => {
            secrets.push({ name, value });
            return "local";
          },
        },
      );
      expect(savedDaytona.code).toBe(0);
      expect(savedDaytona.stdout).toContain(
        "Daytona auth saved to local secret store",
      );
      expect(secrets).toContainEqual({
        name: "daytona-api-key",
        value: "daytona-from-arg",
      });
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

  test("runs commands have useful empty and usage output", async () => {
    const dir = await mkdtemp(join(tmpdir(), "relunar-runs-"));
    try {
      const list = await invoke(["runs", "list"], dir);
      expect(list.code).toBe(0);
      expect(list.stdout).toContain("No runs found");

      const show = await invoke(["runs", "show"], dir);
      expect(show.code).toBe(1);
      expect(show.stderr).toContain("Usage: relunar runs show <run-id>");

      const missing = await invoke(["runs", "show", "missing-run"], dir);
      expect(missing.code).toBe(1);
      expect(missing.stderr).toContain("Run not found: missing-run");
      expect(missing.stderr).not.toContain(dir);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("first run starts interactive setup when setup is incomplete", async () => {
    const dir = await mkdtemp(join(tmpdir(), "relunar-first-run-"));
    try {
      const output = await invoke(
        [],
        dir,
        {
          XDG_CONFIG_HOME: join(dir, "config"),
          RELUNAR_SKIP_GH_AUTH_TOKEN: "1",
          RELUNAR_SECRET_STORE: "local",
        },
        {
          prompt: scriptedPrompt([
            "",
            "",
            "https://app.daytona.io/api",
            "",
            "",
          ]),
          secretWriter: async () => undefined,
        },
      );

      expect(output.code).toBe(1);
      expect(output.stdout).toContain("Relunar CLI");
      expect(output.stdout).toContain("Relunar setup");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("first run does not claim setup complete without repo config", async () => {
    const dir = await mkdtemp(join(tmpdir(), "relunar-first-run-partial-"));
    try {
      const output = await invoke([], dir, {
        XDG_CONFIG_HOME: join(dir, "config"),
        RELUNAR_GITHUB_TOKEN: "gh-token",
        RELUNAR_DAYTONA_API_KEY: "daytona-key",
      });

      expect(output.code).toBe(1);
      expect(output.stdout).toContain("Setup incomplete");
      expect(output.stdout).toContain("relunar init");
      expect(output.stdout).toContain("relunar repo link owner/repo");
      expect(output.stdout).not.toContain("Setup complete");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("repro validates issue number before setup and network work", async () => {
    const dir = await mkdtemp(join(tmpdir(), "relunar-repro-usage-"));
    const cases = [[], ["abc"], ["123abc"], ["0"]];

    try {
      for (const args of cases) {
        const output = await invoke(["repro", ...args], dir, {
          XDG_CONFIG_HOME: join(dir, "config"),
          RELUNAR_SKIP_GH_AUTH_TOKEN: "1",
        });
        expect(output.code).toBe(1);
        expect(output.stderr).toContain("Usage: relunar repro <issue-number>");
        expect(output.stderr).not.toContain("No repo linked");
        expect(output.stderr).not.toContain("Missing GitHub token");
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("one-shot finish flags require outcome and summary before network work", async () => {
    const dir = await mkdtemp(join(tmpdir(), "relunar-oneshot-flags-"));
    try {
      const output = await invoke(
        ["repro", "12", "--finish", "--", "bun", "test"],
        dir,
        {
          XDG_CONFIG_HOME: join(dir, "config"),
          RELUNAR_SKIP_GH_AUTH_TOKEN: "1",
        },
      );
      expect(output.code).toBe(1);
      expect(output.stderr).toContain(
        "Usage: relunar repro <issue-number> --finish --outcome",
      );
      expect(output.stderr).not.toContain("No repo linked");
      expect(output.stderr).not.toContain("Missing GitHub token");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("finish without a probe command does not fall through to start", async () => {
    const dir = await mkdtemp(join(tmpdir(), "relunar-finish-no-probe-"));
    try {
      const output = await invoke(
        [
          "repro",
          "12",
          "--finish",
          "--outcome",
          "reproduced",
          "--summary",
          "claimed",
        ],
        dir,
        {
          XDG_CONFIG_HOME: join(dir, "config"),
          RELUNAR_SKIP_GH_AUTH_TOKEN: "1",
        },
      );
      expect(output.code).toBe(1);
      expect(output.stderr).toContain(
        "Usage: relunar repro <issue-number> --finish --outcome",
      );
      expect(output.stderr).toContain("-- <probe-command>");
      expect(output.stderr).not.toContain("No repo linked");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("commands reject flags that require missing values", async () => {
    const dir = await mkdtemp(join(tmpdir(), "relunar-flag-values-"));
    try {
      const env = {
        XDG_CONFIG_HOME: join(dir, "config"),
        RELUNAR_GITHUB_TOKEN: "gh-token",
      };
      await invoke(["repo", "link", "owner/repo"], dir, env);

      const state = await invoke(["issues", "list", "--state"], dir, env);
      expect(state.code).toBe(1);
      expect(state.stderr).toContain("Missing value for --state");

      const limit = await invoke(["issues", "list", "--limit"], dir, env);
      expect(limit.code).toBe(1);
      expect(limit.stderr).toContain("Invalid limit");

      const token = await invoke(["auth", "github", "--token"], dir, env);
      expect(token.code).toBe(1);
      expect(token.stderr).toContain("Missing value for --token");

      const apiKey = await invoke(["auth", "daytona", "--api-key"], dir, env);
      expect(apiKey.code).toBe(1);
      expect(apiKey.stderr).toContain("Missing value for --api-key");
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
    secretWriter?: (
      name: SecretName,
      value: string,
    ) => Promise<"keychain" | "local" | void>;
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
      return answer === undefined || answer === ""
        ? (options?.defaultValue ?? "")
        : answer;
    },
    confirm: async () => false,
  };
}
