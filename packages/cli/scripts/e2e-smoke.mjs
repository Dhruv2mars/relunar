#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const cliRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const cliBin = join(cliRoot, "dist", "index.js");
const cliSource = join(cliRoot, "src", "index.ts");
const repo = process.env.RELUNAR_E2E_REPO ?? "Dhruv2mars/relunar";
const issue = process.env.RELUNAR_E2E_ISSUE ?? "14";
const commandTimeoutSeconds = parsePositiveInteger(process.env.RELUNAR_E2E_COMMAND_TIMEOUT_SECONDS ?? "900");
const daytonaApiKey = process.env.RELUNAR_DAYTONA_API_KEY;
const githubToken = process.env.RELUNAR_GITHUB_TOKEN ?? process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;

if (!daytonaApiKey) {
  fail("RELUNAR_DAYTONA_API_KEY is required for the real Daytona E2E smoke test.");
}

if (!githubToken) {
  fail("RELUNAR_GITHUB_TOKEN, GITHUB_TOKEN, or GH_TOKEN is required for the real GitHub E2E smoke test.");
}

if (existsSync(cliSource)) {
  execFileSync("bun", ["run", "build"], { cwd: cliRoot, stdio: "inherit" });
} else if (!existsSync(cliBin)) {
  fail(`Built CLI not found: ${cliBin}`);
}

const temp = mkdtempSync(join(tmpdir(), "relunar-e2e-"));
const userEnv = {
  ...process.env,
  XDG_CONFIG_HOME: join(temp, "config"),
  RELUNAR_GITHUB_TOKEN: githubToken,
  RELUNAR_DAYTONA_API_KEY: daytonaApiKey,
  RELUNAR_SECRET_STORE: "local",
};
delete userEnv.DAYTONA_API_KEY;

try {
  run(["init"]);
  writeSmokeConfig(commandTimeoutSeconds);
  run(["auth", "daytona"]);
  run(["repo", "link", repo]);

  const doctor = JSON.parse(run(["doctor", "--json"]));
  assertCheck(doctor, "repo linked");
  assertCheck(doctor, "github auth");
  assertCheck(doctor, "daytona auth");
  assertCheck(doctor, ".relunar.yml");

  const issues = JSON.parse(run(["issues", "list", "--state", "all", "--limit", "1", "--json"]));
  if (!Array.isArray(issues)) {
    fail("issues list did not return an array.");
  }

  const started = JSON.parse(run(["repro", "start", issue]));
  if (started.status !== "environment_ready") {
    fail(renderReproFailure(started));
  }
  if (!started.sandbox?.id) {
    fail("repro did not record a Daytona sandbox id.");
  }
  if (!Array.isArray(started.commands) || !started.commands.some((command) => command.name === "clone")) {
    fail("repro did not run the clone command.");
  }
  const executed = JSON.parse(run(["repro", "exec", started.runId, "--", "test", "-f", "package.json"]));
  if (!executed.commands.some((command) => command.name === "repro" && command.status === "passed")) {
    fail("repro did not record issue-specific command evidence.");
  }
  const report = JSON.parse(run(["repro", "finish", started.runId, "--outcome", "not-reproduced", "--summary", "Lifecycle smoke command passed."]));
  if (report.status !== "not_reproduced") {
    fail(renderReproFailure(report));
  }

  console.log(`E2E passed: ${report.runId} ${report.status} ${repo}#${issue}`);
} finally {
  rmSync(temp, { recursive: true, force: true });
}

function run(args) {
  try {
    return execFileSync(process.execPath, [cliBin, ...args], {
      cwd: temp,
      env: userEnv,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 900_000,
    });
  } catch (error) {
    const output = [error.stderr, error.stdout]
      .filter((value) => typeof value === "string" && value.length > 0)
      .join("\n")
      .trim();
    const lines = [
      `command failed: relunar ${args.join(" ")}`,
      `status: ${error.status ?? "null"}`,
      `signal: ${error.signal ?? "null"}`,
    ];
    if (output) {
      lines.push("output:");
      lines.push(output.split("\n").slice(-40).join("\n"));
    }
    fail(lines.join("\n"));
  }
}

function assertCheck(checks, name) {
  const check = checks.find((item) => item.name === name);
  if (!check?.ok) {
    fail(`doctor check failed: ${name}`);
  }
}

function writeSmokeConfig(seconds) {
  writeFileSync(
    join(temp, ".relunar.yml"),
    `version: 1
setup:
  - node --version
baseline:
  - test -f package.json
commandTimeoutSeconds: ${seconds}
report:
  maxLogLines: 200
`,
    "utf8",
  );
}

function parsePositiveInteger(value) {
  if (!/^[1-9]\d*$/.test(value)) {
    fail("RELUNAR_E2E_COMMAND_TIMEOUT_SECONDS must be a positive integer.");
  }
  return Number.parseInt(value, 10);
}

function renderReproFailure(report) {
  const failed = Array.isArray(report.commands)
    ? report.commands.find((command) => command.status === "failed" || command.status === "timed_out")
    : null;
  const lines = [
    `repro did not pass: ${report.status}`,
    `failure: ${report.failure ?? "unknown failure"}`,
  ];
  if (failed) {
    lines.push(`failed command: ${failed.name} ${failed.command}`);
    lines.push(`exitCode: ${failed.exitCode ?? "null"}`);
    const output = [failed.stderr, failed.stdout].filter(Boolean).join("\n").trim();
    if (output) {
      lines.push("output:");
      lines.push(output.split("\n").slice(-40).join("\n"));
    }
  }
  return lines.join("\n");
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
