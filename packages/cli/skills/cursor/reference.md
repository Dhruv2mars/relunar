# Relunar command reference

Single source of truth for flags: `relunar <command> --help` and the CLI README.
This file is a map, not a dump of help text.

## Binary

Prefer bun. When global `relunar` is stale:

```sh
# from a Relunar checkout
cd packages/cli && bun run build && bun ./dist/index.js
# or published package
bunx @dhruv2mars/relunar
```

## Lifecycle map

| Intent | Command |
|--------|---------|
| Health | `relunar doctor [--json]` |
| List issues | `relunar issues list [--state open\|closed\|all] [--limit N] [--json]` |
| One-shot probe | `relunar repro <n> [--sync] -- <probe>` |
| One-shot + finish | `relunar repro <n> --finish --outcome … --summary … [--comment] -- <probe>` |
| Start sandbox | `relunar repro start <n>` |
| Sync dirty tree | `relunar repro sync <run-id> [--include-untracked]` |
| Upload file | `relunar repro upload <run-id> <local> <remote>` |
| Exec in sandbox | `relunar repro exec <run-id> [assertion flags] -- <cmd>` |
| Finish | `relunar repro finish <run-id> --outcome … --summary … [narrative flags] [--comment]` |
| Abort | `relunar repro abort <run-id>` |
| Preview comment | `relunar repro comment preview <run-id>` |
| Retry comment | `relunar repro comment post <run-id>` |
| Cleanup | `relunar repro cleanup <run-id>` |
| Recover sandboxes | `relunar sandboxes list` / `relunar sandboxes gc [--confirm]` |
| Inspect | `relunar runs show <run-id> --json` / `relunar runs list --json` |

## Finish narrative

- `--comment` only when posting to GitHub.
- Relunar formats the comment; it does not invent repro steps from raw logs.
- Supply maintainer prose: `--summary`, `--repro-steps`, `--observed`, `--expected`, and `--environment` are required for conclusive outcomes.
- Outcomes: `reproduced` | `not-reproduced` | `blocked`.
- Evidence required before finish; baseline/setup output is not Evidence.
- Default gate: conclusive outcomes need an evaluated assertion. Raw output is unverified. `--skip-evidence-gates` permanently makes the run unpublishable.
- Sandbox stays warm until finish/abort; idle TTL is `sandbox.autoStopMinutes` (default 60). Prefer `--sync` when you edited files locally.

## Sync

```sh
relunar repro sync <run-id>
relunar repro exec <run-id> --sync -- <cmd>
relunar repro <n> --sync -- <cmd>
```

Or set `sync.onExec: true` in `.relunar.yml`.

## Setup (only when doctor fails)

```sh
relunar setup
relunar init
relunar repo link owner/repo
relunar auth github [--token …]
relunar auth daytona --api-key …
```

Machine setup is global. Repo setup is inside the target repository.

## Artifacts

```txt
.relunar/runs/<run-id>/
  report.md
  report.json
  logs.txt
```

Harness internals stay in `report.json`. The Finish narrative is for maintainers.

## Probe assertions

Use one or more assertions on every probe:

```sh
relunar repro exec <run-id> \
  --expect-exit 1 \
  --stderr-match "panic|fatal" \
  --file-exists tmp/crash.log \
  --max-duration-ms 5000 \
  --repeat 3 \
  --reset-command "rm -rf tmp && mkdir tmp" \
  -- <issue-specific-command>
```

Available assertions are `--expect-exit`, `--stdout-match`, `--stderr-match`, `--output-match`, `--file-exists`, and `--max-duration-ms`. Every repeated attempt must pass. Add `--control-command` with `--control-expect-exit` or `--control-output-match` when the result needs a negative control.

## Repository environment

`.relunar.yml` can declare `workspace` checkout/workdir/submodules/LFS, `environment.variables`, secret-name-only `environment.passthrough`, background `services`, and `artifacts.collect`. Relunar fingerprints the sandbox runtimes and archives configured artifacts into the local run directory. An explicit sandbox image or snapshot wins; otherwise Relunar detects common devcontainer, Rust, Python, Go, and Node toolchain files.
