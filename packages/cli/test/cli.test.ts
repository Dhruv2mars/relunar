import { describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runCli } from "../src/cli";
import { linkRepo } from "../src/config";

describe("cli", () => {
  test("prints help", async () => {
    const output = await invoke(["help"]);
    expect(output.code).toBe(0);
    expect(output.stdout).toContain("relunar repro <issue-number>");
  });

  test("prints supported skills", async () => {
    const output = await invoke(["skills", "list"]);
    expect(output.code).toBe(0);
    expect(output.stdout).toContain("codex");
  });

  test("shows missing doctor checks", async () => {
    const dir = await mkdtemp(join(tmpdir(), "relunar-cli-"));
    try {
      const output = await invoke(["doctor", "--json"], dir, { XDG_CONFIG_HOME: join(dir, "config") });
      expect(output.code).toBe(1);
      expect(JSON.parse(output.stdout)[0].name).toBe("repo linked");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("repo link persists for current cwd", async () => {
    const dir = await mkdtemp(join(tmpdir(), "relunar-link-"));
    try {
      const env = { XDG_CONFIG_HOME: join(dir, "config") };
      const output = await invoke(["repo", "link", "owner/repo"], dir, env);
      expect(output.code).toBe(0);
      await linkRepo(join(dir, "other"), "owner/other", join(dir, "config", "relunar", "config.json"));
      const doctor = await invoke(["doctor", "--json"], dir, env);
      expect(JSON.parse(doctor.stdout)[0].detail).toBe("owner/repo");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

async function invoke(argv: string[], cwd = process.cwd(), env: NodeJS.ProcessEnv = {}) {
  let stdout = "";
  let stderr = "";
  const code = await runCli(argv, {
    cwd,
    env,
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
