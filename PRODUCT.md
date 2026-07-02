# Relunar Reboot Product Direction

Relunar is a local CLI harness for maintainers who use coding agents to reproduce GitHub issues.

## Core Bet

Relunar should stay CLI-first and local-first.

Agent drives. Relunar executes deterministic sandbox workflow.

## Audience

For OSS maintainers and repository owners.

Not for random issue reporters.

## Promise

Ask Codex, Cursor, or Claude Code to reproduce repository issues. Relunar handles GitHub, Daytona sandbox, logs, reports, and optional issue comments.

## Non-goals for v1

- Hosted Relunar control plane
- Background automation owned by Relunar
- Central custody of user credentials
- Built-in AI agent
- Billing or organization management

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
- The CLI is installed from npm as `@dhruv2mars/relunar` and exposes the `relunar` command.
- First launch runs setup prompts for GitHub and Daytona auth.
