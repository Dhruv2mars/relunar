import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { detectSandboxImage } from "../src/detection";

describe("sandbox image detection", () => {
  test("prefers devcontainer image", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "relunar-detect-devcontainer-"));
    try {
      await mkdir(join(cwd, ".devcontainer"));
      await writeFile(join(cwd, ".devcontainer", "devcontainer.json"), '{\n // pinned toolchain\n "image": "mcr.microsoft.com/devcontainers/typescript-node:22"\n}\n');
      expect(await detectSandboxImage(cwd)).toBe("mcr.microsoft.com/devcontainers/typescript-node:22");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  test("reads only the top-level image from JSONC", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "relunar-detect-jsonc-"));
    try {
      await mkdir(join(cwd, ".devcontainer"));
      await writeFile(join(cwd, ".devcontainer", "devcontainer.json"), `{
        // "image": "attacker/commented:latest",
        "customizations": { "image": "attacker/nested:latest" },
        "image": "node:22-bookworm",
      }`);
      expect(await detectSandboxImage(cwd)).toBe("node:22-bookworm");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  test("detects rust, python, go, and node toolchains", async () => {
    const cases: Array<[string, string, string]> = [
      ["rust-toolchain.toml", '[toolchain]\nchannel = "1.80.1"\n', "rust:1.80.1-bookworm"],
      ["Cargo.toml", '[package]\nname = "cli"\nrust-version = "1.96"\n', "rust:1.96-bookworm"],
      [".python-version", "3.12.4\n", "python:3.12.4-bookworm"],
      ["go.mod", "module example.com/test\n\ngo 1.23\n", "golang:1.23-bookworm"],
      ["package.json", '{"engines":{"node":">=22"}}\n', "node:22-bookworm"],
    ];
    for (const [file, content, expected] of cases) {
      const cwd = await mkdtemp(join(tmpdir(), "relunar-detect-toolchain-"));
      try {
        await writeFile(join(cwd, file), content);
        expect(await detectSandboxImage(cwd)).toBe(expected);
      } finally {
        await rm(cwd, { recursive: true, force: true });
      }
    }
  });

  test("uses the rolling Rust image when Cargo.toml does not declare a minimum", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "relunar-detect-cargo-"));
    try {
      await writeFile(join(cwd, "Cargo.toml"), '[package]\nname = "cli"\n');
      expect(await detectSandboxImage(cwd)).toBe("rust:bookworm");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  test("uses available rolling images for legacy minimum toolchains", async () => {
    const cases: Array<[string, string, string]> = [
      ["rust-toolchain", "1.45.0\n", "rust:bookworm"],
      [".python-version", "3.7.9\n", "python:bookworm"],
      ["go.mod", "module example.com/test\n\ngo 1.12\n", "golang:bookworm"],
      ["package.json", '{"engines":{"node":">=10"}}\n', "node:bookworm"],
    ];
    for (const [file, content, expected] of cases) {
      const cwd = await mkdtemp(join(tmpdir(), "relunar-detect-legacy-"));
      try {
        await writeFile(join(cwd, file), content);
        expect(await detectSandboxImage(cwd)).toBe(expected);
      } finally {
        await rm(cwd, { recursive: true, force: true });
      }
    }
  });

  test("detects autotools and CMake native projects", async () => {
    for (const file of ["configure.ac", "CMakeLists.txt"]) {
      const cwd = await mkdtemp(join(tmpdir(), "relunar-detect-native-"));
      try {
        await writeFile(join(cwd, file), "native project\n");
        expect(await detectSandboxImage(cwd)).toBe("mcr.microsoft.com/devcontainers/cpp:1-debian-12");
      } finally {
        await rm(cwd, { recursive: true, force: true });
      }
    }
  });

  test("detects Maven and pinned Gradle Java projects", async () => {
    const maven = await mkdtemp(join(tmpdir(), "relunar-detect-maven-"));
    const gradle = await mkdtemp(join(tmpdir(), "relunar-detect-gradle-"));
    try {
      await writeFile(join(maven, "pom.xml"), "<project/>\n");
      await writeFile(join(gradle, "gradlew"), "#!/bin/sh\n");
      await mkdir(join(gradle, "gradle", "wrapper"), { recursive: true });
      await writeFile(join(gradle, "gradle", "wrapper", "gradle-wrapper.properties"), "distributionUrl=https\\://services.gradle.org/distributions/gradle-8.14-bin.zip\n");
      expect(await detectSandboxImage(maven)).toBe("mcr.microsoft.com/devcontainers/java:1-21-bookworm");
      expect(await detectSandboxImage(gradle)).toBe("gradle:8.14-jdk21");
    } finally {
      await rm(maven, { recursive: true, force: true });
      await rm(gradle, { recursive: true, force: true });
    }
  });
});
