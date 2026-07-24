# MVP

## Included

- Turborepo monorepo with `packages/cli`.
- `relunar init`
- `relunar setup`
- `relunar doctor`
- `relunar auth github`
- `relunar auth daytona`
- `relunar repo link owner/repo`
- `relunar issues list --state open --limit 20 --json`
- `relunar repro start <issue>`
- `relunar repro upload <run-id> <local-path> <remote-path>`
- `relunar repro exec <run-id> -- <command>`
- `relunar repro finish <run-id> --outcome <outcome> --summary <text> [--comment]`
- `relunar repro abort <run-id>`
- assertion-driven probes with repeat, reset, control, duration, output, exit, and file checks
- full issue context, environment fingerprints, services, secret passthrough, and artifact collection
- idempotent comment preview/post retry and explicit cleanup
- `relunar sandboxes list|gc` recovery
- `relunar runs list`
- `relunar runs show <run-id>`
- `relunar skills list|get|install`
- npm package release path for `@dhruv2mars/relunar`, exposing `relunar`

## Report Outputs

Each repro writes:

```txt
.relunar/runs/<run-id>/
  report.md
  report.json
  logs.txt
```

## Deferred

- MCP server
- Browser reproduction
- Resume setup- or baseline-failed runs
- Windows and macOS sandbox execution; terminal v1 targets Linux sandboxes

## Out of Scope

- Hosted Relunar control plane
- Background automation owned by Relunar
- Central custody of user credentials
- Billing or organization management
