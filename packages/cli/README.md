# Relunar CLI

Relunar is a CLI-first GitHub issue repro harness for coding agents.

```sh
npm install -g @dhruv2mars/relunar
relunar
```

Relunar is a harness, not an agent. Codex, Cursor, Claude Code, or a human decides what to run. Relunar handles GitHub issue reads, Daytona sandbox creation, repo clone, configured commands, logs, reports, cleanup, and optional issue comments.

Agents are the primary end users. Humans set up auth and config; agents drive list → probe → finish.

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

## Agent workflow

```sh
relunar doctor --json
relunar issues list --state open --limit 20 --json

# One-shot: start (or resume an active run), run a probe, leave sandbox warm
relunar repro 123 -- bun test path/to/repro.ts

# Or multi-step lifecycle
relunar repro start 123
relunar repro upload <run-id> ./repro.ts repo/repro.ts
relunar repro exec <run-id> -- bun repro.ts
relunar runs show <run-id> --json

# Agent judges outcome from probe evidence (environment_ready ≠ reproduced)
# Supply narrative fields for maintainer-useful comments — Relunar formats, does not invent steps
relunar repro finish <run-id> \
  --outcome reproduced \
  --summary "Observed issue behavior." \
  --repro-steps "1. …" \
  --observed "key stderr…" \
  --expected "…" \
  --environment "tsc 5.x / node 22"
```

Optional one-shot finish (flags before `--`):

```sh
relunar repro 123 --finish --outcome reproduced --summary "Observed issue behavior." --repro-steps "1. run bun repro.ts" --comment -- bun repro.ts
```

Post a GitHub issue comment only when explicit (`--comment` on finish). The comment (and `report.md`) is a short maintainer write-up: verdict, summary, optional agent-authored steps/observed/expected/environment, trimmed evidence, and an artifacts path. Harness details (`nextStep`, full issue body, setup dumps, sandbox IDs) stay in `report.json` for agents.

`environment_ready` means the sandbox is ready for probing — not that the bug was reproduced.

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
  autoStopMinutes: 60

sync:
  onExec: false
  includeUntracked: false
  # Extends built-ins (node_modules, .git, .relunar, target, dist, …)
  exclude:
    - coverage

evidence:
  reproduced:
    requireProbeOutput: true
    # requireNonZeroExit: true
    # requireOutputMatch: "(?i)error|panic|fail"
    # requireArtifacts:
    #   - repo/repro-output.log

commandTimeoutSeconds: 300

report:
  maxLogLines: 200
```

`setup` installs dependencies. `baseline` verifies environment readiness. `repro start` / one-shot keep the sandbox warm until `finish`/`abort`; Relunar refreshes Daytona idle auto-stop on each resume (`sandbox.autoStopMinutes`, default 60). Use `repro sync` or `repro exec --sync` (or `sync.onExec: true`) to push a dirty local worktree into the sandbox before probing. `repro finish` enforces evidence gates — by default `reproduced` requires issue-specific probe output, not just setup/baseline. Final outcomes are only `reproduced`, `not-reproduced`, or `blocked`. Set `sandbox.image` when the repo needs a runtime different from Daytona's default image. `sandbox.resources` requires an image and sets CPU cores, memory GiB, and disk GiB. Increase `commandTimeoutSeconds` for large repositories with long install or test commands. Reports are written locally:

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
relunar repro <issue-number> -- <probe-command>
relunar repro <issue-number> --finish --outcome reproduced|not-reproduced|blocked --summary <text> [--repro-steps <text>] [--observed <text>] [--expected <text>] [--environment <text>] [--comment] -- <probe-command>
relunar repro start <issue-number>
relunar repro exec <run-id> -- <command>
relunar repro upload <run-id> <local-path> <remote-path>
relunar repro finish <run-id> --outcome reproduced|not-reproduced|blocked --summary <text> [--repro-steps <text>] [--observed <text>] [--expected <text>] [--environment <text>] [--comment]
relunar repro abort <run-id>
relunar runs list [--json]
relunar runs show <run-id> [--json]
relunar skills list|get|install [agent]
```
