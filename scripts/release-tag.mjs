import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const args = new Set(process.argv.slice(2));
const packageJson = JSON.parse(readFileSync(new URL("../packages/cli/package.json", import.meta.url), "utf8"));
const tag = `v${packageJson.version}`;

if (!args.has("--push")) {
  process.stdout.write(`${tag}\n`);
  process.exit(0);
}

const branch = execFileSync("git", ["branch", "--show-current"], { encoding: "utf8" }).trim();
if (branch !== "main") throw new Error(`Release tags may only be pushed from main (current: ${branch || "detached"}).`);

const status = execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim();
if (status) throw new Error("Release tags require a clean worktree.");

execFileSync("git", ["fetch", "--quiet", "origin", "main"], { stdio: "inherit" });
const head = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const remoteMain = execFileSync("git", ["rev-parse", "FETCH_HEAD"], { encoding: "utf8" }).trim();
if (head !== remoteMain) throw new Error("Release tags require HEAD to exactly match origin/main.");

execFileSync("git", ["tag", tag], { stdio: "inherit" });
execFileSync("git", ["push", "origin", tag], { stdio: "inherit" });
