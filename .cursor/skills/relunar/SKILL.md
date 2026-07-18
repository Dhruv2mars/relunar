---
name: relunar
description: >-
  Relunar — GitHub issue repro harness (agent-browser + Crabbox sandbox).
  Use when the user asks to Relunar-reproduce issues, run Relunar, repro GitHub
  bugs in a sandbox, post Relunar finish comments, or drive list→probe→finish
  on open issues. Also when another skill needs a deterministic issue-repro harness.
---

# Relunar

Relunar is the **harness**. You are the agent: pick issues, invent probes, judge Evidence, write the Finish narrative.

Prefer `bun`. If global `relunar` is stale, use the local build:

```sh
bun /Users/dhruv2mars/dev/github/relunar/packages/cli/dist/index.js <args>
```

(Alias that path as `relunar` below. Rebuild with `bun run build` in `packages/cli` when needed.)

Command details live in [`reference.md`](reference.md) and `relunar <cmd> --help`. Read reference when a flag or subcommand is unclear.

## Leading words

| Word | Means |
|------|--------|
| **Relunar** | The CLI harness — sandboxes, logs, reports, optional GitHub comments |
| **harness** | Deterministic plumbing; you supply judgment |
| **Evidence** | Issue-specific probe output that supports an outcome (setup/baseline alone is not Evidence) |
| **Finish narrative** | Maintainer-useful `--summary` / `--repro-steps` / `--observed` / `--expected` / `--environment` |

`environment_ready` ≠ reproduced. Always probe.

## Steps

Complete **one issue lifecycle** before starting the next. Freeze explicit issue numbers — never `--all-open`.

### 1. Ready the harness

```sh
relunar doctor --json
```

**Done when:** every check needed for repro is `ok`, or you fixed the failing check with the smallest setup command (`relunar setup`, `relunar init`, `relunar repo link`, `relunar auth …`) and re-ran doctor.

### 2. Select issues

```sh
relunar issues list --state open --limit 20 --json
```

**Done when:** you have an explicit list of issue numbers to process (from the user, or chosen and stated).

### 3. Lifecycle per issue

For each issue number `N`:

1. **Start** — `relunar repro start N` (or one-shot `relunar repro N -- <probe>`). Sandbox ready ≠ Evidence.
2. **Probe** — sync dirty local edits (`repro sync` / `--sync`), upload scripts if needed (`repro upload`), then `repro exec` / one-shot probes until you have issue-specific Evidence (or a clear block).
3. **Inspect** — `relunar runs show <run-id> --json` when deciding the outcome.
4. **Finish** — exactly one outcome: `reproduced` | `not-reproduced` | `blocked`. Finish rejects soft claims (e.g. empty probe output for `reproduced`).

```sh
relunar repro finish <run-id> \
  --outcome <reproduced|not-reproduced|blocked> \
  --summary "…" \
  --repro-steps "…" \
  --observed "…" \
  --expected "…" \
  --environment "…" \
  --comment   # only when posting to GitHub
```

**Done when (per issue):** `repro finish` succeeded with an outcome **and** a Finish narrative whose `--summary` a maintainer can act on; when commenting, `--repro-steps` / `--observed` / `--expected` / `--environment` are filled from Evidence (not harness dumps). Abort only if the run must be discarded — then start a fresh lifecycle for that issue.

### 4. Report back

**Done when:** every selected issue has a finished outcome, and you report run ids, outcomes, and comment URLs (if any) for each.
