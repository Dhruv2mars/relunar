import { describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const repoRoot = join(import.meta.dir, "..", "..", "..");

describe("release contract", () => {
  test("package is npm publishable as relunar CLI", () => {
    const packageJson = JSON.parse(readFileSync(join(repoRoot, "packages", "cli", "package.json"), "utf8"));

    expect(packageJson.name).toBe("relunar");
    expect(packageJson.private).toBeUndefined();
    expect(packageJson.bin.relunar).toBe("dist/index.js");
    expect(packageJson.files).toContain("dist");
    expect(packageJson.publishConfig.access).toBe("public");
    expect(packageJson.repository.directory).toBe("packages/cli");
  });

  test("release workflow validates tags and publishes with provenance", () => {
    const workflow = readFileSync(join(repoRoot, ".github", "workflows", "release.yml"), "utf8");

    expect(workflow).toContain("tags:");
    expect(workflow).toContain('- "v*"');
    expect(workflow).toContain("tag/version mismatch");
    expect(workflow).toContain("npm publish --provenance --access public");
    expect(workflow).toContain("NPM_TOKEN");
    expect(workflow).toContain("npm publish --access public");
    expect(workflow).toContain("id-token: write");
  });

  test("release tag script prints package version tag", () => {
    const packageJson = JSON.parse(readFileSync(join(repoRoot, "packages", "cli", "package.json"), "utf8"));
    const output = execFileSync("node", ["scripts/release-tag.mjs", "--print"], {
      cwd: repoRoot,
      encoding: "utf8",
    }).trim();

    expect(output).toBe(`v${packageJson.version}`);
  });
});
