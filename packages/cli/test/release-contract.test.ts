import { describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const repoRoot = join(import.meta.dir, "..", "..", "..");

describe("release contract", () => {
  test("package is npm publishable as relunar CLI", () => {
    const rootPackageJson = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"));
    const packageJson = JSON.parse(readFileSync(join(repoRoot, "packages", "cli", "package.json"), "utf8"));

    expect(packageJson.name).toBe("@dhruv2mars/relunar");
    expect(rootPackageJson.version).toBe(packageJson.version);
    expect(packageJson.private).toBeUndefined();
    expect(packageJson.bin.relunar).toBe("dist/index.js");
    expect(packageJson.files).toContain("dist");
    expect(packageJson.files).toContain("LICENSE");
    expect(packageJson.publishConfig.access).toBe("public");
    expect(packageJson.repository.directory).toBe("packages/cli");
  });

  test("release workflow validates tags and publishes with provenance", () => {
    const workflow = readFileSync(join(repoRoot, ".github", "workflows", "release.yml"), "utf8");

    expect(workflow).toContain("tags:");
    expect(workflow).toContain('- "v*"');
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).toContain("repository_dispatch:");
    expect(workflow).toContain("release-rerun");
    expect(workflow).toContain("resolve_tag:");
    expect(workflow).toContain("ref: ${{ needs.resolve_tag.outputs.release_tag }}");
    expect(workflow).toContain("FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true");
    expect(workflow).toContain("actions/checkout@v5");
    expect(workflow).toContain("actions/setup-node@v5");
    expect(workflow).toContain("tag/version mismatch");
    expect(workflow).toContain("npm view @dhruv2mars/relunar version");
    expect(workflow).toContain("npm install -g npm@11.17.0");
    expect(workflow).toContain("publish via npm trusted publisher");
    expect(workflow).toContain("npm publish --provenance --access public");
    expect(workflow).toContain("id-token: write");
    expect(workflow).not.toContain("NPM_TOKEN");
    expect(workflow).not.toContain("//registry.npmjs.org/:_authToken");
    expect(workflow).not.toContain("actions/checkout@v4");
    expect(workflow).not.toContain("actions/setup-node@v4");
  });

  test("release trust script uses supported npm trusted publisher flags", () => {
    const rootPackageJson = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"));
    const command = rootPackageJson.scripts["release:trust"];

    expect(command).toContain("npm@11.17.0");
    expect(command).toContain("trust github @dhruv2mars/relunar");
    expect(command).toContain("--file release.yml");
    expect(command).toContain("--repo Dhruv2mars/relunar");
    expect(command).toContain("--allow-publish");
    expect(command).toContain("--yes");
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
