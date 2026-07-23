# Terminal Readiness Validation

Validation date: 2026-07-23. CLI branch: `feat/terminal-real-world-readiness`.

## User-path tests

Both tests launched Cursor CLI headlessly with the installed Relunar skill and only a short user prompt. Neither test posted a GitHub comment.

| Testbed | Prompt | Run | Result |
|---|---|---|---|
| `Dhruv2mars/ripgrep-relunar-testbed` | `use relunar to reproduce issue 1 without posting a comment` | `issue-1-2026-07-23T115038814Z` | `reproduced`, verified; escaped trailing-space ignore pattern emitted the dangling-backslash parser error while Git accepted the pattern |
| `Dhruv2mars/typescript-relunar-testbed` | `use relunar to reproduce issue 5026 without posting a comment` | `issue-5026-2026-07-23T115611621Z` | `reproduced`, verified; newline after the parameter-property modifier emitted TS1005 while the same-line control compiled |

Both runs persisted full commit SHAs, machine checks, environment fingerprints, complete maintainer narratives, and completed cleanup records. `relunar sandboxes list` returned an empty list after the runs, and `relunar sandboxes gc` reported no orphan to delete.

## Automated gates

- CLI typecheck passes.
- The CLI unit and integration suite covers assertion mismatch, repeated probes, controls, timeouts, artifact collection, service/environment setup, comment retry and concurrent idempotency, atomic run updates, schema migration, GitHub retry, and orphan sandbox recovery.
- The regression manifest contains 24 imported real issues across the Rust and TypeScript testbeds with fixed expected dispositions.
- The packed npm artifact executes its public help command.
