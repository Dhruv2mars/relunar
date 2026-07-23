import { readFile } from "node:fs/promises";
import { join } from "node:path";

export async function detectSandboxImage(cwd: string): Promise<string | undefined> {
  const devcontainer = await optionalRead(join(cwd, ".devcontainer", "devcontainer.json"));
  if (devcontainer) {
    const match = /"image"\s*:\s*"((?:\\.|[^"\\])+)"/.exec(devcontainer);
    if (match?.[1]) return JSON.parse(`"${match[1]}"`) as string;
  }

  const rust = await optionalRead(join(cwd, "rust-toolchain.toml")) ?? await optionalRead(join(cwd, "rust-toolchain"));
  if (rust) {
    const version = /channel\s*=\s*"([^"]+)"/.exec(rust)?.[1] ?? rust.trim().split(/\s+/)[0];
    if (version) return legacyVersion(version, 1, 70) ? "rust:bookworm" : `rust:${version}-bookworm`;
  }

  const python = (await optionalRead(join(cwd, ".python-version")))?.trim().split(/\s+/)[0];
  if (python && /^\d+\.\d+(?:\.\d+)?$/.test(python)) {
    return legacyVersion(python, 3, 9) ? "python:bookworm" : `python:${python}-bookworm`;
  }

  const go = await optionalRead(join(cwd, "go.mod"));
  const goVersion = go ? /^go\s+(\d+\.\d+(?:\.\d+)?)/m.exec(go)?.[1] : undefined;
  if (goVersion) return legacyVersion(goVersion, 1, 20) ? "golang:bookworm" : `golang:${goVersion}-bookworm`;

  if (await optionalRead(join(cwd, "configure.ac")) || await optionalRead(join(cwd, "CMakeLists.txt"))) {
    return "mcr.microsoft.com/devcontainers/cpp:1-debian-12";
  }

  const packageJson = await optionalRead(join(cwd, "package.json"));
  if (packageJson) {
    try {
      const parsed = JSON.parse(packageJson) as { engines?: { node?: string } };
      const major = parsed.engines?.node ? /(?:^|[^\d])(\d{2,})(?:\D|$)/.exec(parsed.engines.node)?.[1] : undefined;
      if (major) return Number(major) < 18 ? "node:bookworm" : `node:${major}-bookworm`;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function legacyVersion(value: string, minimumMajor: number, minimumMinor: number): boolean {
  const [major, minor] = value.split(".").map(Number);
  if (!Number.isFinite(major) || !Number.isFinite(minor)) return false;
  return major! < minimumMajor || (major === minimumMajor && minor! < minimumMinor);
}

async function optionalRead(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return undefined;
    throw error;
  }
}
