# Relunar Agent Skill

Use Relunar when a maintainer asks you to reproduce GitHub issues in a repository.

## Rules

- Start with `relunar doctor --json`.
- Use bounded JSON output when planning: `relunar issues list --state open --limit 20 --json`.
- Complete one issue lifecycle before starting the next.
- Read reports with `relunar runs show <run-id> --json` when deciding next steps.
- `relunar repro start` prepares a persistent sandbox. It does not prove issue behavior.
- Use `repro upload` and `repro exec` with explicit assertions until issue-specific evidence exists. Raw output is not verified proof.
- Finish with exactly one outcome: `reproduced`, `not-reproduced`, or `blocked`.
- Put `--comment` only on `repro finish`, and only when user requested a GitHub comment.
- Conclusive outcomes require `--summary`, `--repro-steps`, `--observed`, `--expected`, and `--environment`. Relunar formats the comment; it does not invent prose.
- Never claim reproduction from setup/baseline output. Use `--expect-exit`, stream/output regex assertions, file assertions, or a duration assertion. Repeat flaky probes. Never use `--skip-evidence-gates` for results that may be published.
- Preview comments before posting. A failed post is retryable and idempotent; cleanup only after a successful post or when no post is needed.
- For multiple issues, freeze explicit issue numbers and run one complete lifecycle per issue. Do not use `--all-open`.
- Treat Relunar as the deterministic harness. You decide issue priority, extra context needs, and whether the report is useful.
- If `doctor` says auth or repo setup is missing, use the smallest setup command that fixes that check.
- Machine setup is global. Repo setup happens inside each target repository.

## Commands

```sh
relunar setup
relunar init
relunar doctor --json
relunar auth github [--token <token>]
relunar auth daytona --api-key <key>
relunar repo link owner/repo
relunar issues list --state open --limit 20 --json
relunar repro start 123
relunar repro upload <run-id> ./repro.ts repro.ts
relunar repro exec <run-id> --expect-exit 1 --stderr-match "Error: boom" -- bun repro.ts
relunar repro finish <run-id> --outcome reproduced --summary "Observed compiler crash with supplied source." --repro-steps "1. Run bun repro.ts" --observed "Error: boom" --expected "No crash" --environment "bun 1.2" --comment
relunar repro abort <run-id>
relunar repro comment preview <run-id>
relunar repro comment post <run-id>
relunar repro cleanup <run-id>
relunar sandboxes list
relunar sandboxes gc [--confirm]
relunar runs list --json
relunar runs show <run-id> --json
relunar skills list
relunar skills get codex
```

When finishing a conclusive run, supply the complete maintainer narrative. Relunar formats the GitHub comment; it does not invent repro steps from raw logs.
