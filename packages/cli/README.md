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
relunar issues list --state open --limit 20 --json
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

sandbox:
  image: node:22-bookworm
  resources:
    cpu: 4
    memory: 8
    disk: 10

commandTimeoutSeconds: 300

report:
  maxLogLines: 200
```

`setup` installs dependencies. `baseline` is the deterministic command list Relunar runs in Daytona. `repro` verifies environment readiness; it does not itself prove issue-specific behavior. Set `sandbox.image` when the repo needs a runtime different from Daytona's default image. `sandbox.resources` requires an image and sets CPU cores, memory GiB, and disk GiB. Increase `commandTimeoutSeconds` for large repositories with long install or test commands. Reports are written locally:

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
4. Local Relunar secret file saved by `relunar auth github --token <token>`

Daytona API key resolution:

1. `RELUNAR_DAYTONA_API_KEY`
2. OS keychain value saved by `relunar auth daytona --api-key <key>`
3. Local Relunar secret file saved by `relunar auth daytona --api-key <key>`

On macOS, Relunar prefers the OS keychain. On Linux, Windows, or when macOS keychain access is unavailable, Relunar stores secrets in `~/.config/relunar/secrets.json` with owner-only file permissions where the platform supports them.

Real Daytona/GitHub E2E smoke test:

```sh
RELUNAR_GITHUB_TOKEN=... RELUNAR_DAYTONA_API_KEY=... bun run test:e2e
```

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
relunar issues list [--state open|closed|all] [--limit N] [--json]
relunar repro <issue-number> [--comment]
relunar repro --all-open [--limit 5] [--comment]
relunar runs list [--json]
relunar runs show <run-id> [--json]
relunar skills list|get|install [agent]
```
