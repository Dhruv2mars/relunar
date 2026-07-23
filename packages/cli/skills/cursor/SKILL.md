---
name: relunar
description: >-
  Relunar — GitHub issue repro harness with isolated Daytona sandboxes.
  Use when the user asks to Relunar-reproduce issues, run Relunar, repro GitHub
  bugs in a sandbox, post Relunar finish comments, or drive list→probe→finish
  on open issues. Also when another skill needs a deterministic issue-repro harness.
---

# Relunar

Relunar is the **harness**. You are the agent: pick issues, invent probes, judge Evidence, write the Finish narrative.

Prefer `bun`. Binary resolution order:

1. `relunar` on PATH (global install)
2. From a Relunar checkout: `cd packages/cli && bun run build && bun ./dist/index.js <args>`
3. Published package: `bunx @dhruv2mars/relunar <args>`

Command details live in [`reference.md`](reference.md) and `relunar <cmd> --help`. Read reference when a flag or subcommand is unclear.

## Leading words

| Word                 | Means                                                                                           |
| -------------------- | ----------------------------------------------------------------------------------------------- |
| **Relunar**          | The CLI harness — sandboxes, logs, reports, optional GitHub comments                            |
| **harness**          | Deterministic plumbing; you supply judgment                                                     |
| **Evidence**         | Issue-specific probe plus explicit machine assertions; output alone is not verified proof       |
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
2. **Probe** — sync dirty local edits (`repro sync` / `--sync`), upload scripts if needed (`repro upload <run-id> <local> <repo-relative-path>`), then run issue-specific probes with `--claim` plus at least one assertion such as `--expect-exit`, `--output-match`, or `--file-exists`. Upload destinations and probe commands are relative to the configured repository workdir; never prefix them with `repo/` or guess the provider's absolute checkout path. Record the returned evidence ID. Use `--repeat` for flaky claims and a control command when causal isolation matters.
   Pass executable arguments directly after `--`. When a probe needs pipes, redirects, expansion, or multiple shell statements, use `-- bash -lc '<script>'`; never quote the whole script as a single executable argument.
3. **Inspect** — use the evidence ID returned by `repro exec`. Before finishing, run `relunar repro evidence <run-id> --json` to list the exact selectable IDs and assertion status; use `relunar runs show <run-id> --json` only when you need the complete record.
4. **Finish** — exactly one outcome: `reproduced` when the asserted issue behavior matches; `not-reproduced` when an assertion for the issue behavior was evaluated and did not match; `blocked` when required inputs or environment cannot be obtained. Issue type (`bug` versus `enhancement`) does not determine outcome. `reproduced` and `not-reproduced` require machine-checked Evidence; `blocked` may omit `--evidence`, but must name the concrete missing prerequisite. Never use `--skip-evidence-gates` for a publishable result.

```sh
relunar repro finish <run-id> \
  --outcome <reproduced|not-reproduced|blocked> \
  --evidence probe-1 \
  --summary "…" \
  --repro-steps "…" \
  --observed "…" \
  --expected "…" \
  --environment "…" \
  --comment   # only when posting to GitHub
```

Omit `--evidence` only for `blocked` when no relevant probe can run. Never call `repro cleanup` after a failed finish; correct the finish command while the sandbox remains recoverable. Cleanup only after finish succeeds or when intentionally aborting.

**Done when (per issue):** `repro finish` succeeded with an outcome and all four narrative fields filled from Evidence. Preview with `relunar repro comment preview <run-id>`. Post only when requested; retry safely with `relunar repro comment post <run-id>`. Run `relunar repro cleanup <run-id>` after a preview-only finish or a successful retry.

### 4. Report back

**Done when:** every selected issue has a finished outcome, and you report run ids, outcomes, and comment URLs (if any) for each.
