import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  defaultRelunarConfig,
  isRepoSlug,
  linkRepo,
  parseRelunarConfig,
  readGlobalConfig,
  writeRelunarConfig,
} from "../src/config";

test("repository slug validation rejects clone-command injection", () => {
  expect(isRepoSlug("owner/repo.name_test-1")).toBe(true);
  expect(isRepoSlug("owner/repo;touch-pwned")).toBe(false);
  expect(isRepoSlug("owner/$(touch-pwned)")).toBe(false);
  expect(isRepoSlug("owner/repo.git")).toBe(false);
  expect(isRepoSlug("owner/.hidden")).toBe(false);
});

describe("relunar config", () => {
  test("parses defaultable repo config", () => {
    expect(parseRelunarConfig("version: 1\n").baseline).toEqual(
      defaultRelunarConfig.baseline,
    );
    expect(parseRelunarConfig("version: 1\n").commandTimeoutSeconds).toBe(300);
  });

  test("rejects invalid command shapes", () => {
    expect(() => parseRelunarConfig("version: 1\nsetup: bad\n")).toThrow();
  });

  test("parses command timeout", () => {
    expect(
      parseRelunarConfig("version: 1\ncommandTimeoutSeconds: 900\n")
        .commandTimeoutSeconds,
    ).toBe(900);
    expect(() =>
      parseRelunarConfig("version: 1\ncommandTimeoutSeconds: 0\n"),
    ).toThrow();
  });

  test("parses optional custom sandbox image", () => {
    expect(
      parseRelunarConfig("version: 1\nsandbox:\n  image: node:22-bookworm\n")
        .sandbox?.image,
    ).toBe("node:22-bookworm");
    expect(() =>
      parseRelunarConfig("version: 1\nsandbox:\n  image: ''\n"),
    ).toThrow();
    expect(() =>
      parseRelunarConfig("version: 1\nsandbox:\n  resources:\n    memory: 4\n"),
    ).toThrow();
    expect(
      parseRelunarConfig("version: 1\nsandbox:\n  snapshot: snap-123\n").sandbox
        ?.snapshot,
    ).toBe("snap-123");
    expect(() =>
      parseRelunarConfig(
        "version: 1\nsandbox:\n  image: node:22\n  snapshot: snap-123\n",
      ),
    ).toThrow();
  });

  test("defaults sandbox auto-stop and sync settings", () => {
    const config = parseRelunarConfig("version: 1\n");
    expect(config.sandbox?.autoStopMinutes).toBe(60);
    expect(config.sync?.onExec).toBe(false);
    expect(config.sync?.includeUntracked).toBe(false);
  });

  test("parses sync and evidence gates", () => {
    const config = parseRelunarConfig(
      [
        "version: 1",
        "sandbox:",
        "  autoStopMinutes: 120",
        "sync:",
        "  onExec: true",
        "  includeUntracked: true",
        "  exclude:",
        "    - node_modules",
        "evidence:",
        "  reproduced:",
        "    requireNonZeroExit: true",
        "    requireOutputMatch: error|panic",
        "    requireArtifacts:",
        "      - repo/repro.log",
        "",
      ].join("\n"),
    );
    expect(config.sandbox?.autoStopMinutes).toBe(120);
    expect(config.sync).toEqual({
      onExec: true,
      includeUntracked: true,
      exclude: ["node_modules"],
    });
    expect(config.evidence?.reproduced?.requireNonZeroExit).toBe(true);
    expect(config.evidence?.reproduced?.requireOutputMatch).toBe("error|panic");
    expect(config.evidence?.reproduced?.requireArtifacts).toEqual([
      "repo/repro.log",
    ]);
  });

  test("parses terminal workspace, environment, services, and artifacts", () => {
    const config = parseRelunarConfig(
      [
        "version: 1",
        "workspace:",
        "  workdir: packages/cli",
        "  checkout: refs/tags/v1.0.0",
        "  fetchDepth: 0",
        "  submodules: true",
        "  lfs: true",
        "environment:",
        "  variables:",
        "    CI: '1'",
        "  passthrough:",
        "    - TEST_DATABASE_URL",
        "services:",
        "  - name: postgres",
        "    start: docker compose up -d postgres",
        "    ready: pg_isready",
        "    stop: docker compose down",
        "artifacts:",
        "  collect:",
        "    - logs/**",
        "    - repro/output.txt",
        "",
      ].join("\n"),
    );
    expect(config.workspace).toEqual({
      workdir: "packages/cli",
      checkout: "refs/tags/v1.0.0",
      fetchDepth: 0,
      submodules: true,
      lfs: true,
    });
    expect(config.environment).toEqual({
      variables: { CI: "1" },
      passthrough: ["TEST_DATABASE_URL"],
    });
    expect(config.services?.[0]).toEqual({
      name: "postgres",
      start: "docker compose up -d postgres",
      ready: "pg_isready",
      stop: "docker compose down",
    });
    expect(config.artifacts?.collect).toEqual(["logs/**", "repro/output.txt"]);
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

  test("detects Go, Python, shell, native, and Java repositories when writing init config", async () => {
    const dir = await mkdtemp(join(tmpdir(), "relunar-config-detect-"));
    try {
      const goDir = join(dir, "go");
      const pythonDir = join(dir, "python");
      const autotoolsDir = join(dir, "autotools");
      const cmakeDir = join(dir, "cmake");
      const mavenDir = join(dir, "maven");
      const gradleDir = join(dir, "gradle");
      const shellDir = join(dir, "shell");
      await Bun.write(
        join(goDir, "go.mod"),
        "module example.com/test\n\ngo 1.22\n",
      );
      await Bun.write(
        join(pythonDir, "pyproject.toml"),
        "[project]\nname = 'sample'\nversion = '1.0.0'\n",
      );
      await Bun.write(
        join(autotoolsDir, "configure.ac"),
        "AC_INIT([sample], [1.0])\n",
      );
      await Bun.write(
        join(autotoolsDir, "vendor", "oniguruma", ".gitkeep"),
        "",
      );
      await Bun.write(
        join(cmakeDir, "CMakeLists.txt"),
        "cmake_minimum_required(VERSION 3.20)\n",
      );
      await Bun.write(join(mavenDir, "pom.xml"), "<project/>\n");
      await Bun.write(join(gradleDir, "gradlew"), "#!/bin/sh\n");
      await Bun.write(
        join(gradleDir, "gradle", "wrapper", "gradle-wrapper.properties"),
        "distributionUrl=https\\://services.gradle.org/distributions/gradle-8.14-bin.zip\n",
      );
      await Bun.write(join(shellDir, "bin", "bats"), "#!/usr/bin/env bash\n");
      await Bun.write(
        join(shellDir, "package.json"),
        '{"scripts":{"test":"bin/bats test"}}\n',
      );
      await writeRelunarConfig(join(goDir, ".relunar.yml"));
      await writeRelunarConfig(join(pythonDir, ".relunar.yml"));
      await writeRelunarConfig(join(autotoolsDir, ".relunar.yml"));
      await writeRelunarConfig(join(cmakeDir, ".relunar.yml"));
      await writeRelunarConfig(join(mavenDir, ".relunar.yml"));
      await writeRelunarConfig(join(gradleDir, ".relunar.yml"));
      await writeRelunarConfig(join(shellDir, ".relunar.yml"));

      expect(
        parseRelunarConfig(await readFile(join(goDir, ".relunar.yml"), "utf8")),
      ).toMatchObject({
        setup: ["go mod download"],
        baseline: ["go test ./..."],
      });
      expect(
        parseRelunarConfig(
          await readFile(join(pythonDir, ".relunar.yml"), "utf8"),
        ),
      ).toMatchObject({
        setup: [
          "python3 -m venv .venv",
          ". .venv/bin/activate && python -m pip install -e .",
        ],
        baseline: [". .venv/bin/activate && python -m pip check"],
      });
      expect(
        parseRelunarConfig(
          await readFile(join(autotoolsDir, ".relunar.yml"), "utf8"),
        ),
      ).toMatchObject({
        sandbox: { image: "mcr.microsoft.com/devcontainers/cpp:1-debian-12" },
        setup: expect.arrayContaining([
          "autoreconf -i",
          "./configure --with-oniguruma=builtin --disable-docs",
          "make -j2",
        ]),
        baseline: ["make check"],
      });
      expect(
        parseRelunarConfig(
          await readFile(join(cmakeDir, ".relunar.yml"), "utf8"),
        ),
      ).toMatchObject({
        sandbox: { image: "mcr.microsoft.com/devcontainers/cpp:1-debian-12" },
        setup: expect.arrayContaining([
          "cmake -S . -B build -G Ninja",
          "cmake --build build -j2",
        ]),
        baseline: ["ctest --test-dir build --output-on-failure"],
      });
      expect(
        parseRelunarConfig(
          await readFile(join(mavenDir, ".relunar.yml"), "utf8"),
        ),
      ).toMatchObject({
        sandbox: {
          image: "mcr.microsoft.com/devcontainers/java:1-21-bookworm",
        },
        setup: ["mvn -B -DskipTests package"],
        baseline: ["mvn -B test"],
      });
      expect(
        parseRelunarConfig(
          await readFile(join(gradleDir, ".relunar.yml"), "utf8"),
        ),
      ).toMatchObject({
        sandbox: { image: "gradle:8.14-jdk21" },
        setup: ["gradle --version"],
        baseline: ["java -version && javac -version"],
      });
      expect(
        parseRelunarConfig(
          await readFile(join(shellDir, ".relunar.yml"), "utf8"),
        ),
      ).toMatchObject({
        sandbox: { image: "mcr.microsoft.com/devcontainers/base:1-debian-12" },
        setup: [],
        baseline: [
          "bin/bats --version",
          "bin/bats --tap test/fixtures/bats/passing.bats",
        ],
      });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("generates Node baselines only for scripts that exist", async () => {
    const dir = await mkdtemp(join(tmpdir(), "relunar-config-node-scripts-"));
    try {
      await Bun.write(
        join(dir, "package.json"),
        JSON.stringify({
          private: true,
          workspaces: ["packages/*"],
          scripts: { test: "bun test" },
        }),
      );
      await Bun.write(join(dir, "bun.lock"), "");
      await writeRelunarConfig(join(dir, ".relunar.yml"));

      expect(
        parseRelunarConfig(await readFile(join(dir, ".relunar.yml"), "utf8")),
      ).toMatchObject({
        setup: ["bun install --frozen-lockfile"],
        baseline: ["bun run test"],
      });
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

  test("preserves every repo link under concurrent global config updates", async () => {
    const dir = await mkdtemp(join(tmpdir(), "relunar-global-concurrent-"));
    try {
      const path = join(dir, "config.json");
      await Promise.all(
        Array.from({ length: 20 }, (_, index) =>
          linkRepo(join(dir, `repo-${index}`), `owner/repo-${index}`, path),
        ),
      );
      const config = await readGlobalConfig(path);
      expect(Object.keys(config.repoLinks)).toHaveLength(20);
      expect(JSON.parse(await readFile(path, "utf8"))).toEqual(config);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
