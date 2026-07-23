# Terminal Readiness Validation

Validation date: 2026-07-23. CLI branch: `feat/terminal-real-world-readiness`.

## User-path tests

Both tests launched Cursor CLI headlessly with the installed Relunar skill and only a short user prompt. Neither test posted a GitHub comment.

| Testbed | Prompt | Run | Result |
|---|---|---|---|
| `Dhruv2mars/ripgrep-relunar-testbed` | `use relunar to reproduce issue 1 without posting a comment` | `issue-1-2026-07-23T115038814Z` | `reproduced`, verified; escaped trailing-space ignore pattern emitted the dangling-backslash parser error while Git accepted the pattern |
| `Dhruv2mars/typescript-relunar-testbed` | `use relunar to reproduce issue 5026 without posting a comment` | `issue-5026-2026-07-23T115611621Z` | `reproduced`, verified; newline after the parameter-property modifier emitted TS1005 while the same-line control compiled |
| `pallets/click` | `use relunar to reproduce issue 3571 without posting a comment` | `issue-3571-2026-07-23T121748147Z` | `reproduced`, verified; progress output stopped at 14/20 with `show_pos=True` and `update_min_steps=7`, while the control completed at 100% |
| `spf13/pflag` | `use relunar to reproduce issue 415 without posting a comment` | `issue-415-2026-07-23T123730442Z` | `reproduced`, verified; `--array ""` produced one empty element while the no-flag control produced an empty slice |

All runs persisted full commit SHAs, machine checks, environment fingerprints, complete maintainer narratives, and completed cleanup records. `relunar sandboxes list` returned an empty list after the runs, and `relunar sandboxes gc` reported no orphan to delete.

The Click and pflag additions were run as fix-and-retest exercises. The first attempts exposed concurrent global-config corruption, Bun-only init defaults, a 120-second cold-start limit, unavailable legacy image tags, ambiguous sandbox paths, and sandbox-root-relative uploads. Each harness defect received a regression test and implementation fix. A fresh pflag run then completed from the same one-line prompt in 187 seconds with two probes, verified control evidence, no comment, and cleanup. No reproduction command or issue-specific hint was supplied to Cursor.

## Automated gates

- CLI typecheck passes.
- The CLI unit and integration suite (115 tests) covers assertion mismatch, claim-linked evidence selection, repeated probes, controls, cold-start timeouts, legacy toolchain images, workdir-relative uploads, artifact collection, service/environment setup, comment retry and concurrent idempotency, atomic config/run updates, schema migration, GitHub retry, and orphan sandbox recovery.
- The regression manifest contains 24 imported real issues across the Rust and TypeScript testbeds with fixed expected dispositions.
- The packed npm artifact executes its public help command.
