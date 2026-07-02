export type DocPage = {
  slug: string;
  title: string;
  description: string;
  content: string;
};

export const docsNavigation = [
  {
    title: "Introduction",
    items: [
      { slug: "getting-started", title: "Getting started" },
      { slug: "installation", title: "Installation" },
      { slug: "configuration", title: "Configuration" },
    ],
  },
  {
    title: "Workflow",
    items: [
      { slug: "commands", title: "Commands" },
      { slug: "agent-workflow", title: "Agent workflow" },
      { slug: "reports", title: "Reports" },
    ],
  },
] as const;

export const docsPages: DocPage[] = [
  {
    slug: "getting-started",
    title: "Getting started",
    description: "Install Relunar, connect GitHub and Daytona, and run your first repro.",
    content: `
Relunar is a local CLI harness for maintainers who work with coding agents. It does not run as a hosted service and it does not include a built-in AI agent.

## What you need

- Node.js 22 or newer
- A GitHub token with access to the repository you want to investigate
- A Daytona API key
- A target repository with a \`.relunar.yml\` file

## First run

\`\`\`sh
npm install -g @dhruv2mars/relunar
relunar setup
cd your-repo
relunar init
relunar repo link owner/repo
relunar doctor --json
\`\`\`

When setup is complete, ask your coding agent to inspect open issues and call \`relunar repro <issue-number>\`.

## Recommended flow

1. Run \`relunar doctor --json\` to verify auth and repo linkage.
2. List issues with \`relunar issues list --state open --json\`.
3. Reproduce one issue first: \`relunar repro 123\`.
4. Inspect the report with \`relunar runs show <run-id> --json\`.
5. Only add \`--comment\` when you explicitly want a GitHub issue comment.
`,
  },
  {
    slug: "installation",
    title: "Installation",
    description: "Install the CLI globally and verify your environment.",
    content: `
## Install from npm

\`\`\`sh
npm install -g @dhruv2mars/relunar
relunar --help
\`\`\`

## Interactive setup

\`\`\`sh
relunar setup
\`\`\`

Setup resolves GitHub and Daytona credentials, stores secrets locally when supported, and can link the current directory to a GitHub repository.

## Verify

\`\`\`sh
relunar doctor
relunar doctor --json
\`\`\`

Doctor checks for a linked repo, GitHub auth, Daytona auth, and a \`.relunar.yml\` file in the current repository.
`,
  },
  {
    slug: "configuration",
    title: "Configuration",
    description: "Repository and global settings for Relunar.",
    content: `
## Repository config

Create \`.relunar.yml\` in the target repository:

\`\`\`yaml
version: 1

setup:
  - bun install

baseline:
  - bun run typecheck
  - bun test

report:
  maxLogLines: 200
\`\`\`

Relunar clones the linked repository into a Daytona sandbox, reads this file, runs \`setup\`, then runs \`baseline\`.

## Global config

Non-secret settings live in:

\`\`\`txt
~/.config/relunar/config.json
\`\`\`

Repo links are stored per working directory path.

## Credentials

GitHub token resolution order:

1. \`RELUNAR_GITHUB_TOKEN\`
2. \`gh auth token\`
3. macOS keychain value saved by \`relunar auth github --token <token>\`

Daytona API key resolution order:

1. \`RELUNAR_DAYTONA_API_KEY\`
2. macOS keychain value saved by \`relunar auth daytona --api-key <key>\`

Secrets are never stored in the repository.
`,
  },
  {
    slug: "commands",
    title: "Commands",
    description: "Reference for the Relunar CLI surface.",
    content: `
## Setup and auth

\`\`\`txt
relunar init
relunar setup
relunar doctor [--json]
relunar auth github [--token <token>]
relunar auth daytona --api-key <key> [--api-url <url>] [--target <target>]
relunar repo link owner/repo
\`\`\`

## Issue workflow

\`\`\`txt
relunar issues list [--state open|closed|all] [--json]
relunar repro <issue-number> [--comment]
relunar repro --all-open [--limit 5] [--comment]
\`\`\`

## Runs and skills

\`\`\`txt
relunar runs list [--json]
relunar runs show <run-id> [--json]
relunar skills list|get|install [agent]
\`\`\`

Batch mode always requires an explicit \`--limit\`. GitHub comments always require \`--comment\`.
`,
  },
  {
    slug: "agent-workflow",
    title: "Agent workflow",
    description: "How coding agents should use Relunar.",
    content: `
Relunar is designed to be called by coding agents such as Cursor, Codex, and Claude Code.

## Principles

- Start with \`relunar doctor --json\`.
- Prefer JSON output when planning: \`relunar issues list --state open --json\`.
- Reproduce one issue before batch work.
- Read reports with \`relunar runs show <run-id> --json\`.
- Do not post GitHub comments unless the user asks, or the command includes \`--comment\`.

## What the agent decides

- Which issues matter
- Whether more context is needed
- How to interpret the issue body
- Whether the report is good enough to share publicly

## What Relunar executes

- GitHub issue fetch
- Daytona sandbox lifecycle
- Repository clone
- Configured setup and baseline commands
- Local report generation
- Optional GitHub comment when explicitly requested
`,
  },
  {
    slug: "reports",
    title: "Reports",
    description: "Local artifacts written for every repro run.",
    content: `
Each repro writes a run directory:

\`\`\`txt
.relunar/runs/<run-id>/
  report.md
  report.json
  logs.txt
\`\`\`

## Status values

- \`passed\` — setup and baseline completed successfully
- \`setup_failed\` — clone or setup command failed
- \`baseline_failed\` — a baseline command failed
- \`blocked\` — sandbox or unexpected harness failure

## GitHub comments

When you pass \`--comment\`, Relunar posts a markdown summary derived from the local report. This is intentionally explicit so public issue threads stay under maintainer control.
`,
  },
];

export function getDocPage(slug: string): DocPage | undefined {
  return docsPages.find((page) => page.slug === slug);
}

export function getAllDocSlugs(): string[] {
  return docsPages.map((page) => page.slug);
}

export type DocNavItem = {
  slug: string;
  title: string;
};

export function getFlatDocNav(): DocNavItem[] {
  return docsNavigation.flatMap((section) => [...section.items]);
}

export function getDocNeighbors(slug: string): {
  previous: DocNavItem | null;
  next: DocNavItem | null;
} {
  const items = getFlatDocNav();
  const index = items.findIndex((item) => item.slug === slug);
  if (index === -1) {
    return { previous: null, next: null };
  }
  return {
    previous: items[index - 1] ?? null,
    next: items[index + 1] ?? null,
  };
}
