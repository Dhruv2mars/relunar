# Terminal Readiness Validation

Validation date: 2026-07-23. CLI branch: `feat/terminal-real-world-readiness`.

## User-path tests

Both tests launched Cursor CLI headlessly with the installed Relunar skill and only a short user prompt. Neither test posted a GitHub comment.

| Testbed                                 | Prompt                                                          | Run                                | Result                                                                                                                                                                                        |
| --------------------------------------- | --------------------------------------------------------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Dhruv2mars/ripgrep-relunar-testbed`    | `use relunar to reproduce issue 1 without posting a comment`    | `issue-1-2026-07-23T115038814Z`    | `reproduced`, verified; escaped trailing-space ignore pattern emitted the dangling-backslash parser error while Git accepted the pattern                                                      |
| `Dhruv2mars/typescript-relunar-testbed` | `use relunar to reproduce issue 5026 without posting a comment` | `issue-5026-2026-07-23T115611621Z` | `reproduced`, verified; newline after the parameter-property modifier emitted TS1005 while the same-line control compiled                                                                     |
| `pallets/click`                         | `use relunar to reproduce issue 3571 without posting a comment` | `issue-3571-2026-07-23T121748147Z` | `reproduced`, verified; progress output stopped at 14/20 with `show_pos=True` and `update_min_steps=7`, while the control completed at 100%                                                   |
| `spf13/pflag`                           | `use relunar to reproduce issue 415 without posting a comment`  | `issue-415-2026-07-23T123730442Z`  | `reproduced`, verified; `--array ""` produced one empty element while the no-flag control produced an empty slice                                                                             |
| `jqlang/jq`                             | `use relunar to reproduce issue 3538 without posting a comment` | `issue-3538-2026-07-23T124850313Z` | `reproduced`, verified; mixed-sign non-leaf `delpaths` deleted the wrong element while the all-positive control used simultaneous semantics                                                   |
| `remkop/picocli`                        | `use relunar to reproduce issue 2506 without posting a comment` | `issue-2506-2026-07-23T131326789Z` | `reproduced`, verified; exclusive optional group members and explicit required options both reported incorrect `originallyRequired` values                                                    |
| `tj/commander.js`                       | `use relunar to reproduce issue 2530 without posting a comment` | `issue-2530-2026-07-23T131843982Z` | `reproduced`, verified; executable subcommand dispatch dropped the first end-of-options delimiter while the child reparsed the following operand as an option                                 |
| `bats-core/bats-core`                   | `use relunar to reproduce issue 1219 without posting a comment` | `issue-1219-2026-07-23T133447480Z` | `reproduced`, verified on a fresh clone with untouched generated config and the upgraded SDK; a PTY default run emitted TAP while the same run with explicit `--pretty` emitted pretty output |
| `Dhruv2mars/ripgrep-relunar-testbed`    | `use relunar to reproduce issue 10 without posting a comment`   | `issue-10-2026-07-23T133907201Z`   | `reproduced`, verified; the requested preprocessor cache is absent and four invocations occurred for two files searched twice                                                                 |
| `Dhruv2mars/ripgrep-relunar-testbed`    | `use relunar to reproduce issue 13 without posting a comment`   | `issue-13-2026-07-23T134237242Z`   | `not-reproduced`, verified; the asserted exit status 2 mismatched the observed status 0 while version output remained present                                                                 |
| `Dhruv2mars/ripgrep-relunar-testbed`    | `use relunar to reproduce issue 14 without posting a comment`   | `issue-14-2026-07-23T134606168Z`   | `blocked`; the private corpus, proprietary filesystem plugin, command, dump, and stack were unavailable, while a trivial search proved the built CLI healthy                                  |

All runs persisted full commit SHAs, machine checks, environment fingerprints, complete maintainer narratives, and completed cleanup records. `relunar sandboxes list` returned an empty list after the runs, and `relunar sandboxes gc` reported no orphan to delete.

The Click, pflag, jq, picocli, Commander.js, and Bats additions were run as fix-and-retest exercises. The first attempts exposed concurrent global-config corruption, Bun-only init defaults, a 120-second cold-start limit, unavailable legacy image tags, missing native/Java/shell detection, Gradle wrapper network dependence, ambiguous sandbox paths, sandbox-root-relative uploads, file assertions evaluated outside the repository workdir, conventional `--help` dispatch failure, and an issue-sensitive Bats baseline. Each harness defect received a regression test and implementation fix. Fresh runs then completed from the same one-line prompts with verified evidence, no comments, and cleanup. No reproduction command or issue-specific hint was supplied to Cursor.

## Automated gates

- CLI typecheck passes.
- The CLI unit and integration suite covers assertion mismatch, claim-linked evidence selection, repeated probes, controls, cold-start timeouts, legacy toolchain images, workdir-relative uploads, artifact collection, service/environment setup, comment retry and concurrent idempotency, atomic config/run updates, schema migration, GitHub retry, and orphan sandbox recovery.
- The regression manifest contains 32 issues across Rust, TypeScript, Python, Go, C, Java, JavaScript, and shell, including explicit `reproduced`, `not-reproduced`, and `blocked` disposition coverage.
- The packed npm artifact executes its public help command.
- Fresh npm and Bun projects both install the generated package tarball and execute its public help command.
- `bun audit` reports no vulnerabilities after upgrading the Daytona SDK and web dependencies and pinning patched transitive releases.
