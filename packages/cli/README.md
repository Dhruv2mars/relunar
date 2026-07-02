# Relunar CLI

Relunar is a CLI-first GitHub issue repro harness for coding agents.

```sh
npm install -g @dhruv2mars/relunar
relunar
```

Relunar is a harness, not an agent. Codex, Cursor, Claude Code, or a human decides what to run. Relunar handles GitHub issue reads, Daytona sandbox creation, repo clone, configured commands, logs, reports, cleanup, and optional issue comments.

## First-Time Workflow

Machine setup once:

```sh
npm install -g @dhruv2mars/relunar
relunar setup
```

Repo setup once inside each target repo:

```sh
cd target-repo
relunar init
relunar repo link owner/repo
relunar doctor
```

Daily use:

```sh
relunar issues list --state open
relunar repro 123
relunar runs list
relunar runs show <run-id>
```

Agent use:

```sh
relunar doctor --json
relunar issues list --state open --json
relunar repro 123
relunar runs show <run-id> --json
```

Post a GitHub issue comment only when explicit:

```sh
relunar repro 123 --comment
```

## Repository Config

`relunar init` creates `.relunar.yml`:

```yaml
version: 1

setup:
  - bun install

baseline:
  - bun run typecheck
  - bun test

report:
  maxLogLines: 200
```

`setup` installs dependencies. `baseline` is the deterministic command list Relunar runs in Daytona. Reports are written locally:

```txt
.relunar/runs/<run-id>/
  report.md
  report.json
  logs.txt
```

## Auth

GitHub token resolution:

1. `RELUNAR_GITHUB_TOKEN`
2. `gh auth token`
3. OS keychain value saved by `relunar auth github --token <token>`

Daytona API key resolution:

1. `RELUNAR_DAYTONA_API_KEY`
2. OS keychain value saved by `relunar auth daytona --api-key <key>`

Optional Daytona settings:

```sh
RELUNAR_DAYTONA_API_URL=https://app.daytona.io/api
RELUNAR_DAYTONA_TARGET=default
```

## Commands

```txt
relunar init
relunar setup
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
```
