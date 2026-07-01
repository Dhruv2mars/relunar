# Relunar Reboot Product Direction

Relunar is a local CLI harness for maintainers who use coding agents to reproduce GitHub issues.

## Core Bet

Relunar should be CLI-first, not a server-first GitHub bot.

Agent drives. Relunar executes deterministic sandbox workflow.

## Audience

For OSS maintainers and repository owners.

Not for random issue reporters.

## Promise

Ask Codex, Cursor, or Claude Code to reproduce repository issues. Relunar handles GitHub, Daytona sandbox, logs, reports, and optional issue comments.

## Non-goals for v1

- GitHub App
- Web dashboard
- Hosted server
- Postgres queue
- Automatic webhooks
- Built-in AI agent
- Billing
- Team accounts

## Architecture

```txt
maintainer laptop
  -> coding agent
    -> relunar CLI
      -> GitHub API
      -> Daytona API using maintainer credentials
      -> local .relunar run store
```

## Product Rules

- Default local reports only.
- `--comment` required for GitHub comments.
- Batch commands require explicit `--limit`.
- No plaintext secrets in repo.
- Daytona credentials belong to each user.
- Relunar writes structured JSON and markdown for agents to consume.
