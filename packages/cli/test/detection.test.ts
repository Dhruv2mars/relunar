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

  test("detects rust, python, go, and node toolchains", async () => {
    const cases: Array<[string, string, string]> = [
      ["rust-toolchain.toml", '[toolchain]\nchannel = "1.80.1"\n', "rust:1.80.1-bookworm"],
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
});
