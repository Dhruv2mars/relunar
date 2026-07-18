# Relunar Agent Skill

Use Relunar when a maintainer asks you to reproduce GitHub issues in a repository.

## Rules

- Start with `relunar doctor --json`.
- Use bounded JSON output when planning: `relunar issues list --state open --limit 20 --json`.
- Complete one issue lifecycle before starting the next.
- Read reports with `relunar runs show <run-id> --json` when deciding next steps.
- `relunar repro start` prepares a persistent sandbox. It does not prove issue behavior.
- Use `repro upload` and `repro exec` until issue-specific evidence exists.
- Finish with exactly one outcome: `reproduced`, `not-reproduced`, or `blocked`.
- Put `--comment` only on `repro finish`, and only when user requested a GitHub comment.
- When commenting, supply maintainer narrative: `--summary` (required) plus `--repro-steps`, `--observed`, `--expected`, and `--environment` when known. Relunar formats the comment; it does not invent repro steps.
- Never claim reproduction from setup/baseline output. Relunar rejects comments without a summary and issue-specific command evidence.
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
relunar repro upload <run-id> ./repro.ts repo/repro.ts
relunar repro exec <run-id> -- bun repro.ts
relunar repro finish <run-id> --outcome reproduced --summary "Observed compiler crash with supplied source." --repro-steps "1. Run bun repro.ts" --observed "Error: boom" --expected "No crash" --environment "bun 1.2" --comment
relunar repro abort <run-id>
relunar runs list --json
relunar runs show <run-id> --json
relunar skills list
relunar skills get codex
```

When finishing with `--comment`, supply maintainer narrative (`--summary` required; `--repro-steps`, `--observed`, `--expected`, `--environment` recommended). Relunar formats the GitHub comment; it does not invent repro steps from raw logs.