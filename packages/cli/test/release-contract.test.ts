import { describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse } from "yaml";

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
    expect(packageJson.scripts.build).toContain("--packages=external");
    expect(packageJson.publishConfig.access).toBe("public");
    expect(packageJson.repository.directory).toBe("packages/cli");
  });

  test("release workflow validates tags and publishes with provenance", () => {
    const workflow = readFileSync(join(repoRoot, ".github", "workflows", "release.yml"), "utf8");
    const parsed = parse(workflow) as ReleaseWorkflow;
    const jobs = parsed.jobs;
    const publishNpm = requiredJob(jobs, "publish_npm");
    const createRelease = requiredJob(jobs, "create_release");

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
    expect(workflow).toContain("Pack and smoke CLI");
    expect(workflow).toContain("publish via npm trusted publisher");
    expect(workflow).toContain("npm publish --provenance --access public");
    expect(asList(publishNpm.needs)).toEqual(["resolve_tag", "validate"]);
    expect(asList(createRelease.needs)).toEqual(["resolve_tag", "validate", "publish_npm"]);
    expect(publishNpm.permissions["id-token"]).toBe("write");
    expect(publishNpm.permissions.contents).toBe("read");
    expect(createRelease.permissions.contents).toBe("write");
    expect(workflow).not.toContain("NPM_TOKEN");
    expect(workflow).not.toContain("//registry.npmjs.org/:_authToken");
    expect(workflow).not.toContain("actions/checkout@v4");
    expect(workflow).not.toContain("actions/setup-node@v4");
  });

  test("packed CLI artifact runs help", () => {
    const temp = mkdtempSync(join(tmpdir(), "relunar-pack-"));
    try {
      const output = execFileSync("npm", ["pack", "--json", "--pack-destination", temp], {
        cwd: join(repoRoot, "packages", "cli"),
        encoding: "utf8",
      });
      const [pack] = parsePackOutput(output);
      if (!pack) {
        throw new Error("npm pack produced no artifact");
      }
      const filename = pack.filename;
      const prefix = join(temp, "install");
      execFileSync("npm", ["install", "--prefix", prefix, "--global", join(temp, filename)], {
        stdio: "pipe",
      });
      const help = execFileSync(join(prefix, "bin", "relunar"), ["help"], {
        encoding: "utf8",
      });

      expect(help).toContain("Relunar CLI");
      expect(help).toContain("Agent workflow");
      expect(help).toContain("relunar repro <issue-number>");
    } finally {
      rmSync(temp, { recursive: true, force: true });
    }
  }, 30_000);

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

type ReleaseWorkflow = {
  jobs: Record<string, ReleaseJob>;
};

type ReleaseJob = {
  needs?: string | string[];
  permissions: Record<string, string>;
};

function asList(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) {
    return value;
  }
  return value ? [value] : [];
}

function requiredJob(jobs: Record<string, ReleaseJob>, name: string): ReleaseJob {
  const job = jobs[name];
  if (!job) {
    throw new Error(`Missing release job: ${name}`);
  }
  return job;
}

function parsePackOutput(output: string): Array<{ filename: string }> {
  const match = output.match(/\[\s*\{[\s\S]*\}\s*\]\s*$/);
  if (!match) {
    throw new Error(`npm pack JSON not found in output: ${output}`);
  }
  return JSON.parse(match[0]) as Array<{ filename: string }>;
}
