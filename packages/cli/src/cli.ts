import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs, flagBoolean, flagNeedsValue, flagPositiveInteger, flagString } from "./args";
import { findLinkedRepo, globalConfigPath, isRepoSlug, linkRepo, readGlobalConfig, writeGlobalConfig, writeRelunarConfig } from "./config";
import { resolveDaytonaApiKey, resolveGithubToken, writeSecret, type SecretBackend } from "./credentials";
import { DaytonaSandboxProvider } from "./daytona";
import { GitHubClient } from "./github";
import { isFinalizedRepro, renderMarkdownReport, withAgentNextStep } from "./reports";
import { abortRepro, execRepro, finishRepro, startRepro, syncRepro, uploadReproFile } from "./repro";
import { findActiveRunForIssue, listRuns, readRun, runStoreDir } from "./runs";
import { readSetupStatus, runInteractiveSetup, type SetupPrompter } from "./setup";
import { getSkill, installSkill, isSupportedSkill, supportedSkills } from "./skills";
import type { RepoSlug, ReproOutcome, RunReport } from "./types";
import type { SecretName } from "./credentials";

export type CliIO = {
  stdout(message: string): void;
  stderr(message: string): void;
};

export type CliDeps = {
  cwd: string;
  env: NodeJS.ProcessEnv;
  io: CliIO;
  prompt?: SetupPrompter | undefined;
  secretWriter?: ((name: SecretName, value: string) => Promise<SecretBackend | void>) | undefined;
  isInteractive?: boolean | undefined;
};

export async function runCli(argv: string[], deps: CliDeps): Promise<number> {
  const { positionals, flags, passthrough } = parseArgs(argv);
  const [command, subcommand, third] = positionals;

  try {
    if (!command) {
      return await start(deps);
    }

    if (command === "help" || flagBoolean(flags, "help")) {
      deps.io.stdout(helpText());
      return 0;
    }

    if (command === "init") {
      try {
        await writeRelunarConfig(join(deps.cwd, ".relunar.yml"));
      } catch (error) {
        if (isAlreadyExists(error)) {
          deps.io.stderr(".relunar.yml already exists. Edit it in place or remove it before running init again.\n");
          return 1;
        }
        throw error;
      }
      deps.io.stdout("Created .relunar.yml\n");
      return 0;
    }

    if (command === "doctor") {
      return await doctor(deps, flags);
    }

    if (command === "setup") {
      return (await runInteractiveSetup({
        cwd: deps.cwd,
        env: deps.env,
        configPath: configPath(deps),
        io: deps.io,
        prompt: deps.prompt,
        secretWriter: deps.secretWriter,
      }))
        ? 0
        : 1;
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
      return await repro(positionals.slice(1), flags, passthrough, deps);
    }

    if (command === "runs" && subcommand === "list") {
      return await runsList(flags, deps);
    }

    if (command === "runs" && subcommand === "show") {
      if (!third) {
        deps.io.stderr("Usage: relunar runs show <run-id> [--json]\n");
        return 1;
      }
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

async function start(deps: CliDeps): Promise<number> {
  deps.io.stdout("Relunar CLI\n");
  const status = await readSetupStatus({ cwd: deps.cwd, env: deps.env, configPath: configPath(deps) });
  const relunarConfig = existsSync(join(deps.cwd, ".relunar.yml"));
  if (status.github && status.daytona && status.repoLinked && relunarConfig) {
    deps.io.stdout("Setup complete. Useful next commands:\n");
    deps.io.stdout("  relunar doctor\n  relunar repo link owner/repo\n  relunar issues list --state open --limit 20 --json\n  relunar repro start 123\n  relunar repro 123 -- <probe-command>\n");
    return 0;
  }

  const interactive = deps.prompt !== undefined || deps.isInteractive === true || (deps.isInteractive === undefined && process.stdin.isTTY && process.stdout.isTTY);
  if (interactive && (!status.github || !status.daytona)) {
    return (await runInteractiveSetup({
      cwd: deps.cwd,
      env: deps.env,
      configPath: configPath(deps),
      io: deps.io,
      prompt: deps.prompt,
      secretWriter: deps.secretWriter,
    }))
      ? 0
      : 1;
  }

  deps.io.stdout(renderSetupNextSteps(status, relunarConfig));
  return 1;
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
    if (flagNeedsValue(flags, "token")) {
      deps.io.stderr("Missing value for --token.\n");
      return 1;
    }
    const tokenArg = flagString(flags, "token");
    const token = tokenArg ?? (await resolveGithubToken(deps.env));
    if (!token) {
      deps.io.stderr("No GitHub token. Run gh auth login, set RELUNAR_GITHUB_TOKEN, or pass --token.\n");
      return 1;
    }
    if (tokenArg) {
      await (deps.secretWriter ?? writeSecret)("github-token", token);
      deps.io.stdout("GitHub auth saved\n");
      return 0;
    }
    deps.io.stdout("GitHub auth available\n");
    return 0;
  }

  if (subcommand === "daytona") {
    if (flagNeedsValue(flags, "api-key")) {
      deps.io.stderr("Missing value for --api-key.\n");
      return 1;
    }
    if (flagNeedsValue(flags, "api-url")) {
      deps.io.stderr("Missing value for --api-url.\n");
      return 1;
    }
    if (flagNeedsValue(flags, "target")) {
      deps.io.stderr("Missing value for --target.\n");
      return 1;
    }
    const apiKeyArg = flagString(flags, "api-key");
    const envApiKey = deps.env.RELUNAR_DAYTONA_API_KEY;
    const apiKey = apiKeyArg ?? envApiKey;
    if (!apiKey) {
      deps.io.stderr("No Daytona API key. Pass --api-key or set RELUNAR_DAYTONA_API_KEY.\n");
      return 1;
    }
    let savedBackend: SecretBackend | void = undefined;
    if (apiKeyArg) {
      savedBackend = await (deps.secretWriter ?? writeSecret)("daytona-api-key", apiKey);
    }
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
    deps.io.stdout(
      apiKeyArg ? `Daytona auth saved to ${secretBackendLabel(savedBackend)}\n` : "Daytona auth available from environment\n",
    );
    return 0;
  }

  deps.io.stderr("Usage: relunar auth github|daytona\n");
  return 1;
}

function secretBackendLabel(backend: SecretBackend | void): string {
  return backend === "local" ? "local secret store" : "OS keychain";
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
  if (flagNeedsValue(flags, "state")) {
    deps.io.stderr("Missing value for --state.\n");
    return 1;
  }
  const repo = await requireRepo(deps);
  const state = parseState(flagString(flags, "state") ?? "open");
  if (!state) {
    deps.io.stderr("Invalid issue state. Use open, closed, or all.\n");
    return 1;
  }
  const limit = flagPositiveInteger(flags, "limit");
  if (limit === null) {
    deps.io.stderr("Invalid limit. Use a positive integer.\n");
    return 1;
  }
  const token = await requireGithubToken(deps);
  const issues = await new GitHubClient(token).listIssues(repo, state, { ...(limit ? { limit } : {}) });

  if (flagBoolean(flags, "json")) {
    deps.io.stdout(`${JSON.stringify(issues, null, 2)}\n`);
  } else if (issues.length === 0) {
    deps.io.stdout(`No ${state} issues found\n`);
  } else {
    deps.io.stdout(`${issues.map((issue) => `#${issue.number} ${issue.title}`).join("\n")}\n`);
  }
  return 0;
}

async function repro(args: string[], flags: Record<string, string | boolean>, passthrough: string[], deps: CliDeps): Promise<number> {
  const limitFlag = flagPositiveInteger(flags, "limit");
  if (limitFlag === null) {
    deps.io.stderr("Invalid limit. Use a positive integer.\n");
    return 1;
  }

  const allOpen = flagBoolean(flags, "all-open");
  if (allOpen) {
    deps.io.stderr("Batch start is disabled for agent-driven repros. List issues, then complete one lifecycle per issue.\n");
    return 1;
  }

  const legacyIssueNumber = parseIssueNumber(args[0]);
  const isOneShot = legacyIssueNumber !== null && passthrough.length > 0;
  const action = isOneShot ? "oneshot" : legacyIssueNumber !== null ? "start" : args[0];
  if (!action || !["oneshot", "start", "exec", "upload", "sync", "finish", "abort"].includes(action)) {
    deps.io.stderr("Usage: relunar repro <issue-number> [--sync] [-- <probe-command>] | start|exec|upload|sync|finish|abort\n");
    return 1;
  }
  if (action === "start" && parseIssueNumber(legacyIssueNumber !== null ? args[0] : args[1]) === null) {
    deps.io.stderr("Usage: relunar repro <issue-number> | relunar repro start <issue-number>\n");
    return 1;
  }
  if (action === "oneshot") {
    const wantFinish = flagBoolean(flags, "finish");
    const outcome = parseOutcome(flagString(flags, "outcome"));
    const narrative = parseFinishNarrative(flags);
    if (wantFinish && (!outcome || !narrative)) {
      deps.io.stderr("Usage: relunar repro <issue-number> --finish --outcome reproduced|not-reproduced|blocked --summary <text> [--repro-steps <text>] [--observed <text>] [--expected <text>] [--environment <text>] -- <probe-command>\n");
      return 1;
    }
  }

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
  let report: RunReport;

  if (action === "oneshot") {
    const issueNumber = legacyIssueNumber!;
    const wantFinish = flagBoolean(flags, "finish");
    const outcome = parseOutcome(flagString(flags, "outcome"));
    const narrative = parseFinishNarrative(flags);

    const active = await findActiveRunForIssue(deps.cwd, issueNumber);
    if (active) {
      report = active;
    } else {
      const issue = await client.getIssue(repo, issueNumber);
      report = await startRepro({ cwd: deps.cwd, repo, issue, githubToken: token, sandboxProvider: provider });
    }

    if (report.status !== "environment_ready") {
      printReport(deps, report);
      return 1;
    }

    report = await execRepro({
      cwd: deps.cwd,
      runId: report.runId,
      command: shellCommand(passthrough),
      sandboxProvider: provider,
      sync: flagBoolean(flags, "sync"),
      includeUntracked: flagBoolean(flags, "include-untracked"),
    });

    if (wantFinish) {
      report = await finishRepro({
        cwd: deps.cwd,
        runId: report.runId,
        outcome: outcome!,
        ...narrative!,
        sandboxProvider: provider,
        keepSandbox: flagBoolean(flags, "keep-sandbox"),
        skipEvidenceGates: flagBoolean(flags, "skip-evidence-gates"),
      });
      await maybeComment(client, repo, report.issue.number, report, flagBoolean(flags, "comment"));
    }
  } else if (action === "start") {
    const issueNumber = parseIssueNumber(legacyIssueNumber !== null ? args[0] : args[1]);
    if (issueNumber === null) {
      deps.io.stderr("Usage: relunar repro start <issue-number>\n");
      return 1;
    }
    const issue = await client.getIssue(repo, issueNumber);
    report = await startRepro({ cwd: deps.cwd, repo, issue, githubToken: token, sandboxProvider: provider });
  } else if (action === "exec") {
    if (!args[1] || passthrough.length === 0) {
      deps.io.stderr("Usage: relunar repro exec <run-id> [--sync] [--include-untracked] -- <command>\n");
      return 1;
    }
    report = await execRepro({
      cwd: deps.cwd,
      runId: args[1],
      command: shellCommand(passthrough),
      sandboxProvider: provider,
      sync: flagBoolean(flags, "sync"),
      includeUntracked: flagBoolean(flags, "include-untracked"),
    });
  } else if (action === "sync") {
    if (!args[1]) {
      deps.io.stderr("Usage: relunar repro sync <run-id> [--include-untracked]\n");
      return 1;
    }
    report = await syncRepro({
      cwd: deps.cwd,
      runId: args[1],
      sandboxProvider: provider,
      includeUntracked: flagBoolean(flags, "include-untracked"),
    });
  } else if (action === "upload") {
    if (!args[1] || !args[2] || !args[3]) {
      deps.io.stderr("Usage: relunar repro upload <run-id> <local-path> <remote-path>\n");
      return 1;
    }
    report = await uploadReproFile({ cwd: deps.cwd, runId: args[1], localPath: args[2], remotePath: args[3], sandboxProvider: provider });
  } else if (action === "finish") {
    const outcome = parseOutcome(flagString(flags, "outcome"));
    const narrative = parseFinishNarrative(flags);
    if (!args[1] || !outcome || !narrative) {
      deps.io.stderr(
        "Usage: relunar repro finish <run-id> --outcome reproduced|not-reproduced|blocked --summary <text> [--repro-steps <text>] [--observed <text>] [--expected <text>] [--environment <text>] [--comment] [--keep-sandbox] [--skip-evidence-gates]\n",
      );
      return 1;
    }
    report = await finishRepro({
      cwd: deps.cwd,
      runId: args[1],
      outcome,
      ...narrative,
      sandboxProvider: provider,
      keepSandbox: flagBoolean(flags, "keep-sandbox"),
      skipEvidenceGates: flagBoolean(flags, "skip-evidence-gates"),
    });
    await maybeComment(client, repo, report.issue.number, report, flagBoolean(flags, "comment"));
  } else if (action === "abort") {
    if (!args[1]) {
      deps.io.stderr("Usage: relunar repro abort <run-id>\n");
      return 1;
    }
    report = await abortRepro({ cwd: deps.cwd, runId: args[1], sandboxProvider: provider });
  } else {
    deps.io.stderr("Usage: relunar repro start|exec|upload|sync|finish|abort\n");
    return 1;
  }

  printReport(deps, report);
  return report.status === "setup_failed" || report.status === "baseline_failed" ? 1 : 0;
}

function printReport(deps: CliDeps, report: RunReport): void {
  deps.io.stdout(`${JSON.stringify(withAgentNextStep(report), null, 2)}\n`);
}

async function maybeComment(
  client: GitHubClient,
  repo: RepoSlug,
  issueNumber: number,
  report: RunReport,
  comment: boolean,
): Promise<void> {
  if (!comment) {
    return;
  }
  if (!isFinalizedRepro(report)) {
    throw new Error(`Refusing GitHub comment for non-finalized run ${report.runId}.`);
  }
  await client.createComment(repo, issueNumber, renderMarkdownReport(report, 40));
}

function parseOutcome(value: string | undefined): ReproOutcome | null {
  if (value === "reproduced" || value === "blocked") return value;
  if (value === "not-reproduced") return "not_reproduced";
  return null;
}

/** Agent-authored narrative for maintainer comments. Relunar formats; does not invent steps. */
function parseFinishNarrative(flags: Record<string, string | boolean>): {
  summary: string;
  reproSteps?: string;
  observed?: string;
  expected?: string;
  environmentNotes?: string;
} | null {
  const summary = flagString(flags, "summary")?.trim();
  if (!summary) {
    return null;
  }
  const narrative: {
    summary: string;
    reproSteps?: string;
    observed?: string;
    expected?: string;
    environmentNotes?: string;
  } = { summary };
  const reproSteps = flagString(flags, "repro-steps")?.trim();
  const observed = flagString(flags, "observed")?.trim();
  const expected = flagString(flags, "expected")?.trim();
  const environmentNotes = flagString(flags, "environment")?.trim();
  if (reproSteps) narrative.reproSteps = reproSteps;
  if (observed) narrative.observed = observed;
  if (expected) narrative.expected = expected;
  if (environmentNotes) narrative.environmentNotes = environmentNotes;
  return narrative;
}

function shellCommand(args: string[]): string {
  return args.map((arg) => (/^[A-Za-z0-9_./:=@%+,-]+$/.test(arg) ? arg : `'${arg.replaceAll("'", `'\\''`)}'`)).join(" ");
}

async function runsList(flags: Record<string, string | boolean>, deps: CliDeps): Promise<number> {
  const runs = await listRuns(deps.cwd);
  if (flagBoolean(flags, "json")) {
    deps.io.stdout(`${JSON.stringify(runs, null, 2)}\n`);
  } else if (runs.length === 0) {
    deps.io.stdout("No runs found\n");
  } else {
    deps.io.stdout(`${runs.map((run) => `${run.runId} ${run.status} #${run.issue.number}`).join("\n")}\n`);
  }
  return 0;
}

async function runsShow(runId: string, flags: Record<string, string | boolean>, deps: CliDeps): Promise<number> {
  const run = withAgentNextStep(await readRun(deps.cwd, runId));
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

function parseState(value: string): "open" | "closed" | "all" | null {
  if (value === "open" || value === "closed" || value === "all") {
    return value;
  }
  return null;
}

function unreachableInvalidIssueNumber(): never {
  throw new Error("Invalid issue number.");
}

function parseIssueNumber(value: string | undefined): number | null {
  if (!value || !/^[1-9]\d*$/.test(value)) {
    return null;
  }
  return Number.parseInt(value, 10);
}

function renderSetupNextSteps(status: Awaited<ReturnType<typeof readSetupStatus>>, relunarConfig: boolean): string {
  const lines = ["Setup incomplete. Next commands:"];
  if (!status.github || !status.daytona) {
    lines.push("  relunar setup");
  }
  if (!relunarConfig) {
    lines.push("  relunar init");
  }
  if (!status.repoLinked) {
    lines.push("  relunar repo link owner/repo");
  }
  lines.push("  relunar doctor");
  return `${lines.join("\n")}\n`;
}

function helpText(): string {
  return `Relunar CLI

Agents are the primary users. Relunar is a harness (not an agent): it does not invent repro steps.

Agent workflow:
  1. relunar doctor [--json]
  2. relunar issues list --state open --limit 20 --json
  3. One-shot probe (start or resume, run probe, leave sandbox warm):
       relunar repro <issue-number> [--sync] -- <probe-command>
     Or multi-step:
       relunar repro start <issue-number>
       relunar repro sync <run-id> [--include-untracked]
       relunar repro upload <run-id> <local-path> <remote-path>
       relunar repro exec <run-id> [--sync] -- <command>
  4. Agent judges outcome from probe evidence, then finishes with narrative fields
     (Relunar formats the comment; it does not invent repro steps):
       relunar repro finish <run-id> --outcome reproduced|not-reproduced|blocked \\
         --summary <text> [--repro-steps <text>] [--observed <text>] \\
         [--expected <text>] [--environment <text>] [--comment]

  Sandbox stays warm until finish/abort. Idle auto-stop defaults to 60m (sandbox.autoStopMinutes).
  Sync dirty local edits with --sync or sync.onExec in .relunar.yml.
  Finish enforces evidence gates (reproduced requires probe output by default).

  environment_ready means the sandbox is ready — not that the issue was reproduced.
  Put finish flags before \`--\` when combining with one-shot:
       relunar repro <issue> --finish --outcome reproduced --summary "..." --repro-steps "..." -- <probe-command>

Human setup (once):
  1. npm install -g @dhruv2mars/relunar
  2. relunar setup
  3. cd target-repo && relunar init
  4. relunar repo link owner/repo

Machine setup:
  relunar setup
  relunar auth github [--token <token>]
  relunar auth daytona --api-key <key> [--api-url <url>] [--target <target>]

Repo setup:
  relunar init                         # creates .relunar.yml
  relunar repo link owner/repo

Commands:
  relunar init
  relunar setup
  relunar doctor [--json]
  relunar auth github [--token <token>]
  relunar auth daytona --api-key <key> [--api-url <url>] [--target <target>]
  relunar repo link owner/repo
  relunar issues list [--state open|closed|all] [--limit N] [--json]
  relunar repro <issue-number> [--sync] [--include-untracked] -- <probe-command>
  relunar repro <issue-number> --finish --outcome reproduced|not-reproduced|blocked --summary <text> [--repro-steps <text>] [--observed <text>] [--expected <text>] [--environment <text>] [--comment] [--keep-sandbox] [--skip-evidence-gates] -- <probe-command>
  relunar repro start <issue-number>
  relunar repro sync <run-id> [--include-untracked]
  relunar repro exec <run-id> [--sync] [--include-untracked] -- <command>
  relunar repro upload <run-id> <local-path> <remote-path>
  relunar repro finish <run-id> --outcome reproduced|not-reproduced|blocked --summary <text> [--repro-steps <text>] [--observed <text>] [--expected <text>] [--environment <text>] [--comment] [--keep-sandbox] [--skip-evidence-gates]
  relunar repro abort <run-id>
  relunar runs list [--json]
  relunar runs show <run-id> [--json]
  relunar skills list|get|install [agent]
`;
}

function configPath(deps: CliDeps): string {
  return globalConfigPath(deps.env);
}

function isAlreadyExists(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "EEXIST";
}
