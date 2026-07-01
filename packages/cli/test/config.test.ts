import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { defaultRelunarConfig, linkRepo, parseRelunarConfig, readGlobalConfig, writeRelunarConfig } from "../src/config";

describe("relunar config", () => {
  test("parses defaultable repo config", () => {
    expect(parseRelunarConfig("version: 1\n").baseline).toEqual(defaultRelunarConfig.baseline);
  });

  test("rejects invalid command shapes", () => {
    expect(() => parseRelunarConfig("version: 1\nsetup: bad\n")).toThrow();
  });

  test("writes init config without overwriting existing file", async () => {
    const dir = await mkdtemp(join(tmpdir(), "relunar-config-"));
    try {
      const path = join(dir, ".relunar.yml");
      await writeRelunarConfig(path);
      const raw = await readFile(path, "utf8");
      expect(raw).toContain("baseline:");
      await expect(writeRelunarConfig(path)).rejects.toThrow();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("links repo in global config by cwd", async () => {
    const dir = await mkdtemp(join(tmpdir(), "relunar-global-"));
    try {
      const path = join(dir, "config.json");
      const cwd = join(dir, "repo");
      await linkRepo(cwd, "owner/repo", path);
      expect((await readGlobalConfig(path)).repoLinks[cwd]).toBe("owner/repo");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
