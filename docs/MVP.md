# MVP

## Included

- Turborepo monorepo with `packages/cli`.
- `relunar init`
- `relunar doctor`
- `relunar auth github`
- `relunar auth daytona`
- `relunar repo link owner/repo`
- `relunar issues list --state open --json`
- `relunar repro <issue>`
- `relunar repro <issue> --comment`
- `relunar repro --all-open --limit <n>`
- `relunar runs list`
- `relunar runs show <run-id>`
- `relunar skills list|get|install`

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
- Resume failed runs
- GitHub App
- Hosted queue
- Team dashboard
