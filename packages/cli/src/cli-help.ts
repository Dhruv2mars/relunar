export function helpText(): string {
  return `Relunar CLI

Agents are the primary users. Relunar is a harness (not an agent): it does not invent repro steps.

Agent workflow:
  1. relunar doctor [--json]
  2. relunar issues list --state open --limit 20 --json
  3. One-shot probe (start or resume, run probe, leave sandbox warm):
       relunar repro <issue-number> --claim <issue-behavior> [--sync] -- <probe-command>
     Or multi-step:
       relunar repro start <issue-number>
       relunar repro sync <run-id> [--include-untracked]
       relunar repro upload <run-id> <local-path> <repo-relative-path>
       relunar repro exec <run-id> --claim <issue-behavior> [--sync] -- <command>
  4. Agent judges outcome from probe evidence, then finishes with narrative fields
     (Relunar formats the comment; it does not invent repro steps):
       relunar repro finish <run-id> --outcome reproduced|not-reproduced|blocked \
         --evidence probe-N --summary <text> [--repro-steps <text>] [--observed <text>] \
         [--expected <text>] [--environment <text>] [--comment]

  Sandbox stays warm until finish/abort. Idle auto-stop defaults to 60m (sandbox.autoStopMinutes).
  Sync dirty local edits with --sync or sync.onExec in .relunar.yml.
  Probe assertions: --expect-exit N, --stdout-match REGEX, --stderr-match REGEX,
    --output-match REGEX, --file-exists PATH[,PATH], --max-duration-ms N, --repeat N.
    Optional: --control-command CMD with control assertion; --reset-command CMD between repeats.
  Finish derives trust from assertions. Arbitrary output is never verified proof.
  Reproduced and not-reproduced outcomes require all four narrative fields.

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
  relunar repro <issue-number> --claim <issue-behavior> [--sync] [--include-untracked] [--expect-exit N] [--output-match REGEX] [--repeat N] -- <probe-command>
  relunar repro <issue-number> --finish --outcome reproduced|not-reproduced|blocked --evidence probe-N[,probe-N] --summary <text> [--repro-steps <text>] [--observed <text>] [--expected <text>] [--environment <text>] [--comment] [--skip-evidence-gates] -- <probe-command>
  relunar repro start <issue-number>
  relunar repro sync <run-id> [--include-untracked]
  relunar repro exec <run-id> --claim <issue-behavior> [--sync] [--include-untracked] [--expect-exit N] [--stdout-match REGEX] [--stderr-match REGEX] [--output-match REGEX] [--file-exists PATH[,PATH]] [--max-duration-ms N] [--repeat N] -- <command>
  relunar repro evidence <run-id> [--json]
  relunar repro upload <run-id> <local-path> <repo-relative-path>
  relunar repro finish <run-id> --outcome reproduced|not-reproduced|blocked --evidence probe-N[,probe-N] --summary <text> [--repro-steps <text>] [--observed <text>] [--expected <text>] [--environment <text>] [--comment] [--skip-evidence-gates]
  relunar repro abort <run-id>
  relunar repro comment preview <run-id>
  relunar repro comment post <run-id>
  relunar repro cleanup <run-id>  # finished runs only; use abort for active runs
  relunar runs list [--json]
  relunar runs show <run-id> [--json]
  relunar sandboxes list
  relunar sandboxes gc [--confirm]
  relunar skills list|get|install [agent]
`;
}

export function contextualHelp(positionals: string[]): string {
  const path = positionals.join(" ");
  if (path === "repro exec") return `Usage: relunar repro exec <run-id> --claim <issue-behavior> [--sync] [--include-untracked] [--expect-exit N] [--stdout-match REGEX] [--stderr-match REGEX] [--output-match REGEX] [--file-exists PATH[,PATH]] [--max-duration-ms N] [--repeat N] [--control-command CMD] [--reset-command CMD] -- <command>\n\nAsserted probes return an evidenceId such as probe-1. Assertion mismatches are recorded as evidence and do not make the harness command fail.\n`;
  if (path === "repro finish") return `Usage: relunar repro finish <run-id> --outcome reproduced|not-reproduced|blocked --evidence probe-N[,probe-N] --summary <text> [--repro-steps <text>] [--observed <text>] [--expected <text>] [--environment <text>] [--comment] [--skip-evidence-gates]\n\nSelect only evidence for the issue claim. Omit --evidence only for blocked when no relevant probe can run. Reproduced and not-reproduced outcomes require all four narrative fields.\n`;
  if (path === "repro evidence") return "Usage: relunar repro evidence <run-id> [--json]\n\nLists exact selectable evidence IDs, claims, assertion status, and attempts without requiring GitHub or Daytona access.\n";
  if (path === "repro start") return "Usage: relunar repro start <issue-number> [--json]\n";
  if (path === "repro comment preview") return "Usage: relunar repro comment preview <run-id>\n";
  if (path === "repro comment post") return "Usage: relunar repro comment post <run-id>\n";
  if (path === "issues" || path === "issues list") return "Usage: relunar issues list [--state open|closed|all] [--limit N] [--json]\n";
  return helpText();
}
