# Relunar

Relunar is a CLI-first repro harness for coding agents.

Ask Codex, Cursor, Claude Code, or another coding agent to reproduce GitHub issues. Relunar handles deterministic plumbing: GitHub issue reads, Daytona sandbox creation, repository clone, configured commands, local reports, logs, cleanup, and optional GitHub issue comments.

Relunar is a harness, not an agent. Your coding agent decides which issues matter, whether extra context is needed, and when a report is good enough.

## Why CLI-first

- No hosted service in v1.
- No central Relunar custody of user secrets.
- Maintainers use their own GitHub and Daytona accounts.
- Commands are visible, local, and composable.
- GitHub comments are explicit with `--comment`.

## Install

```sh
npm install -g @dhruv2mars/relunar
relunar
```

During local development:

```sh
bun run verify
```

## Quick Start

```sh
relunar
relunar setup
relunar repo link owner/repo
relunar doctor
relunar issues list --state open --limit 20 --json
relunar repro 123
relunar repro 123 --comment
```

Batch mode stays explicit:

```sh
relunar repro --all-open --limit 5
relunar repro --all-open --limit 5 --comment
```

## Repository Config

Create `.relunar.yml` in the target repository:

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

Relunar clones the linked GitHub repo into a Daytona sandbox, reads `.relunar.yml`, runs `setup`, then runs `baseline`. It writes reports locally:

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

Non-secret local settings live in:

```txt
~/.config/relunar/config.json
```

Secrets are never stored in the repository.

## Commands

```txt
relunar init
relunar setup
relunar doctor
relunar auth github
relunar auth daytona
relunar repo link owner/repo
relunar issues list --state open --limit 20 --json
relunar repro 123
relunar repro 123 --comment
relunar repro --all-open --limit 5
relunar runs list
relunar runs show <run-id>
relunar skills list
relunar skills get codex
relunar skills install codex
```

## Monorepo

```txt
packages/cli  Relunar CLI
```

## Testbed

Use [docs/testbed.md](docs/testbed.md) for the local Fastify OSS testbed workflow.

The published npm package is `@dhruv2mars/relunar`. It ships the `relunar` executable from compiled `dist/index.js` and is released from tags like `v0.1.0`.

Configure npm trusted publishing once before tagging a release:

```sh
bun run release:trust -- --otp 123456
```

The trust command must use npm `11.15.0` or newer and must include `--allow-publish`. Do not type the placeholder form `--otp <6-digit-code>` in zsh; angle brackets are shell redirection.

Turborepo runs builds, tests, and typechecking:

```sh
bun run build
bun run test
bun run typecheck
```
