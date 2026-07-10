# Relunar Agent Skill

Use Relunar when a maintainer asks you to reproduce GitHub issues in a repository.

## Rules

- Start with `relunar doctor --json`.
- Use bounded JSON output when planning: `relunar issues list --state open --limit 20 --json`.
- Prefer one issue first before batch work: `relunar repro 123`.
- Read reports with `relunar runs show <run-id> --json` when deciding next steps.
- Do not post GitHub comments unless the user asks, or the command includes `--comment`.
- `relunar repro` validates clean-environment setup and baseline only. It does not itself prove issue behavior.
- Never call `--comment` for a failed setup or baseline. `--comment-failures` is an explicit override for maintainers who want environment-failure evidence posted.
- Before claiming reproduction or posting a bug report, perform issue-specific investigation and capture issue-specific evidence. A passed baseline is not a reproduced issue.
- For batch work, keep limits small first: `relunar repro --all-open --limit 3`.
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
relunar repro 123
relunar repro 123 --comment
relunar repro 123 --comment-failures
relunar repro --all-open --limit 5
relunar runs list --json
relunar runs show <run-id> --json
relunar skills list
relunar skills get codex
```
