import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs, flagBoolean, flagNumber, flagString } from "./args";
import { findLinkedRepo, globalConfigPath, isRepoSlug, linkRepo, readGlobalConfig, writeGlobalConfig, writeRelunarConfig } from "./config";
import { resolveDaytonaApiKey, resolveGithubToken, writeSecret } from "./credentials";
import { DaytonaSandboxProvider } from "./daytona";
import { GitHubClient } from "./github";
import { renderMarkdownReport } from "./reports";
import { runRepro } from "./repro";
import { listRuns, readRun, runStoreDir } from "./runs";
import { getSkill, installSkill, isSupportedSkill, supportedSkills } from "./skills";
import type { RepoSlug, RunReport } from "./types";

export type CliIO = {
  stdout(message: string): void;
  stderr(message: string): void;
};

export type CliDeps = {
  cwd: string;
  env: NodeJS.ProcessEnv;
  io: CliIO;
};

export async function runCli(argv: string[], deps: CliDeps): Promise<number> {
  const { positionals, flags } = parseArgs(argv);
  const [command, subcommand, third] = positionals;

  try {
    if (!command || command === "help" || flagBoolean(flags, "help")) {
      deps.io.stdout(helpText());
      return 0;
    }

    if (command === "init") {
      await writeRelunarConfig(join(deps.cwd, ".relunar.yml"));
      deps.io.stdout("Created .relunar.yml\n");
      return 0;
    }

    if (command === "doctor") {
      return await doctor(deps, flags);
    }

    if (command === "auth") {
      return await auth(subcommand, flags, deps);
    }

    if (command === "repo" && subcommand === "link") {
      return await repoLink(third, deps);
    }

    if (command === "issues" && subcommand === "list") {
      return await issuesList(flags, deps);
    }

    if (command === "repro") {
      return await repro(positionals.slice(1), flags, deps);
    }

    if (command === "runs" && subcommand === "list") {
      return await runsList(flags, deps);
    }

    if (command === "runs" && subcommand === "show" && third) {
      return await runsShow(third, flags, deps);
    }

    if (command === "skills") {
      return await skills(subcommand, third, flags, deps);
    }

    deps.io.stderr(`Unknown command: ${positionals.join(" ")}\n`);
    return 1;
  } catch (error) {
    deps.io.stderr(`${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
}

async function doctor(deps: CliDeps, flags: Record<string, string | boolean>): Promise<number> {
  const json = flagBoolean(flags, "json");
  const linkedRepo = await findLinkedRepo(deps.cwd, configPath(deps));
  const githubToken = await resolveGithubToken(deps.env);
  const daytonaKey = await resolveDaytonaApiKey(deps.env);
  const relunarConfig = existsSync(join(deps.cwd, ".relunar.yml"));
  const checks = [
    { name: "repo linked", ok: linkedRepo !== null, detail: linkedRepo ?? "run relunar repo link owner/repo" },
    { name: "github auth", ok: githubToken !== null, detail: githubToken ? "available" : "run gh auth login or set RELUNAR_GITHUB_TOKEN" },
    { name: "daytona auth", ok: daytonaKey !== null, detail: daytonaKey ? "available" : "run relunar auth daytona --api-key <key>" },
    { name: ".relunar.yml", ok: relunarConfig, detail: relunarConfig ? "found" : "run relunar init" },
  ];

  if (json) {
    deps.io.stdout(`${JSON.stringify(checks, null, 2)}\n`);
  } else {
    deps.io.stdout(`${checks.map((check) => `${check.ok ? "ok" : "missing"} ${check.name}: ${check.detail}`).join("\n")}\n`);
  }

  return checks.every((check) => check.ok) ? 0 : 1;
}

async function auth(subcommand: string | undefined, flags: Record<string, string | boolean>, deps: CliDeps): Promise<number> {
  if (subcommand === "github") {
    const token = flagString(flags, "token") ?? (await resolveGithubToken(deps.env));
    if (!token) {
      deps.io.stderr("No GitHub token. Run gh auth login, set RELUNAR_GITHUB_TOKEN, or pass --token.\n");
      return 1;
    }
    if (flagString(flags, "token")) {
      await writeSecret("github-token", token);
    }
    deps.io.stdout("GitHub auth available\n");
    return 0;
  }

  if (subcommand === "daytona") {
    const apiKey = flagString(flags, "api-key") ?? deps.env.RELUNAR_DAYTONA_API_KEY;
    if (!apiKey) {
      deps.io.stderr("No Daytona API key. Pass --api-key or set RELUNAR_DAYTONA_API_KEY.\n");
      return 1;
    }
    await writeSecret("daytona-api-key", apiKey);
    const config = await readGlobalConfig(configPath(deps));
    const apiUrl = flagString(flags, "api-url") ?? deps.env.RELUNAR_DAYTONA_API_URL ?? config.daytona?.apiUrl;
    const target = flagString(flags, "target") ?? deps.env.RELUNAR_DAYTONA_TARGET ?? config.daytona?.target;
    await writeGlobalConfig({
      ...config,
      daytona: {
        ...(apiUrl ? { apiUrl } : {}),
        ...(target ? { target } : {}),
      },
    }, configPath(deps));
    deps.io.stdout("Daytona auth saved to OS keychain\n");
    return 0;
  }

  deps.io.stderr("Usage: relunar auth github|daytona\n");
  return 1;
}

async function repoLink(repo: string | undefined, deps: CliDeps): Promise<number> {
  if (!repo || !isRepoSlug(repo)) {
    deps.io.stderr("Usage: relunar repo link owner/repo\n");
    return 1;
  }

  await linkRepo(deps.cwd, repo, configPath(deps));
  deps.io.stdout(`Linked ${repo}\n`);
  return 0;
}

async function issuesList(flags: Record<string, string | boolean>, deps: CliDeps): Promise<number> {
  const repo = await requireRepo(deps);
  const token = await requireGithubToken(deps);
  const state = normalizeState(flagString(flags, "state") ?? "open");
  const issues = await new GitHubClient(token).listIssues(repo, state);

  if (flagBoolean(flags, "json")) {
    deps.io.stdout(`${JSON.stringify(issues, null, 2)}\n`);
  } else {
    deps.io.stdout(`${issues.map((issue) => `#${issue.number} ${issue.title}`).join("\n")}\n`);
  }
  return 0;
}

async function repro(args: string[], flags: Record<string, string | boolean>, deps: CliDeps): Promise<number> {
  const repo = await requireRepo(deps);
  const token = await requireGithubToken(deps);
  const globalConfig = await readGlobalConfig(configPath(deps));
  const daytonaKey = await resolveDaytonaApiKey(deps.env);
  if (!daytonaKey) {
    throw new Error("Missing Daytona API key. Run relunar auth daytona --api-key <key> or set RELUNAR_DAYTONA_API_KEY.");
  }

  const client = new GitHubClient(token);
  const provider = new DaytonaSandboxProvider({
    apiKey: daytonaKey,
    apiUrl: deps.env.RELUNAR_DAYTONA_API_URL ?? globalConfig.daytona?.apiUrl,
    target: deps.env.RELUNAR_DAYTONA_TARGET ?? globalConfig.daytona?.target,
  });
  const comment = flagBoolean(flags, "comment");
  const reports: RunReport[] = [];

  if (flagBoolean(flags, "all-open")) {
    const limit = flagNumber(flags, "limit", 5);
    const issues = (await client.listIssues(repo, "open")).slice(0, limit);
    for (const issue of issues) {
      const report = await runRepro({ cwd: deps.cwd, repo, issue, githubToken: token, sandboxProvider: provider });
      reports.push(report);
      if (comment) {
        await client.createComment(repo, issue.number, renderMarkdownReport(report, 200));
      }
    }
  } else {
    const issueNumber = Number.parseInt(args[0] ?? "", 10);
    if (!Number.isFinite(issueNumber)) {
      deps.io.stderr("Usage: relunar repro <issue-number> [--comment]\n");
      return 1;
    }
    const issue = await client.getIssue(repo, issueNumber);
    const report = await runRepro({ cwd: deps.cwd, repo, issue, githubToken: token, sandboxProvider: provider });
    reports.push(report);
    if (comment) {
      await client.createComment(repo, issue.number, renderMarkdownReport(report, 200));
    }
  }

  deps.io.stdout(`${JSON.stringify(reports.length === 1 ? reports[0] : reports, null, 2)}\n`);
  return reports.some((report) => report.status === "blocked") ? 1 : 0;
}

async function runsList(flags: Record<string, string | boolean>, deps: CliDeps): Promise<number> {
  const runs = await listRuns(deps.cwd);
  if (flagBoolean(flags, "json")) {
    deps.io.stdout(`${JSON.stringify(runs, null, 2)}\n`);
  } else {
    deps.io.stdout(`${runs.map((run) => `${run.runId} ${run.status} #${run.issue.number}`).join("\n")}\n`);
  }
  return 0;
}

async function runsShow(runId: string, flags: Record<string, string | boolean>, deps: CliDeps): Promise<number> {
  const run = await readRun(deps.cwd, runId);
  if (flagBoolean(flags, "json")) {
    deps.io.stdout(`${JSON.stringify(run, null, 2)}\n`);
  } else {
    const markdown = await readFile(join(runStoreDir(deps.cwd), runId, "report.md"), "utf8");
    deps.io.stdout(markdown);
  }
  return 0;
}

async function skills(
  subcommand: string | undefined,
  agentArg: string | undefined,
  flags: Record<string, string | boolean>,
  deps: CliDeps,
): Promise<number> {
  const agent = flagString(flags, "agent") ?? agentArg ?? "codex";
  if (subcommand === "list") {
    deps.io.stdout(`${supportedSkills.join("\n")}\n`);
    return 0;
  }

  if (!isSupportedSkill(agent)) {
    deps.io.stderr(`Unsupported agent: ${agent}\n`);
    return 1;
  }

  if (subcommand === "get") {
    deps.io.stdout(await getSkill(agent));
    return 0;
  }

  if (subcommand === "install") {
    const path = await installSkill(deps.cwd, agent);
    deps.io.stdout(`Installed ${agent} skill at ${path}\n`);
    return 0;
  }

  deps.io.stderr("Usage: relunar skills list|get|install [agent]\n");
  return 1;
}

async function requireRepo(deps: CliDeps): Promise<RepoSlug> {
  const repo = await findLinkedRepo(deps.cwd, configPath(deps));
  if (!repo) {
    throw new Error("No repo linked. Run relunar repo link owner/repo.");
  }
  return repo;
}

async function requireGithubToken(deps: CliDeps): Promise<string> {
  const token = await resolveGithubToken(deps.env);
  if (!token) {
    throw new Error("Missing GitHub token. Run gh auth login or set RELUNAR_GITHUB_TOKEN.");
  }
  return token;
}

function normalizeState(value: string): "open" | "closed" | "all" {
  if (value === "open" || value === "closed" || value === "all") {
    return value;
  }
  return "open";
}

function helpText(): string {
  return `Relunar CLI

Commands:
  relunar init
  relunar doctor [--json]
  relunar auth github [--token <token>]
  relunar auth daytona --api-key <key> [--api-url <url>] [--target <target>]
  relunar repo link owner/repo
  relunar issues list [--state open|closed|all] [--json]
  relunar repro <issue-number> [--comment]
  relunar repro --all-open [--limit 5] [--comment]
  relunar runs list [--json]
  relunar runs show <run-id> [--json]
  relunar skills list|get|install [agent]
`;
}

function configPath(deps: CliDeps): string {
  return globalConfigPath(deps.env);
}
