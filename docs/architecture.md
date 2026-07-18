# Architecture

Relunar v1 is local-first.

```txt
packages/cli
  src/cli.ts          command routing
  src/github.ts       GitHub REST adapter
  src/daytona.ts      Daytona SDK adapter
  src/repro.ts        deterministic repro orchestration
  src/runs.ts         local run store
  src/reports.ts      markdown/json report rendering
  src/config.ts       .relunar.yml and global config
  src/credentials.ts  env, gh, keychain credential resolution
  src/setup.ts        first-run interactive setup
  src/skills.ts       agent instruction surface
```

Relunar keeps external systems behind adapters. Tests use fake sandbox sessions and public CLI entrypoints.

## Install Flow

```txt
npm install -g @dhruv2mars/relunar
relunar
  -> setup prompt if GitHub or Daytona auth is missing
  -> save secrets to OS keychain when supported
  -> save non-secret Daytona settings to ~/.config/relunar/config.json
  -> optional repo link for current directory
```

## Run Flow

```txt
relunar repro start 123
  -> resolve linked repo
  -> resolve GitHub token
  -> resolve Daytona API key
  -> fetch GitHub issue
  -> create Daytona sandbox
  -> clone repo
  -> read .relunar.yml
  -> run setup commands
  -> run baseline commands
  -> persist environment_ready report and sandbox id
relunar repro sync <run-id> [--include-untracked]
  -> resume sandbox, refresh idle TTL, sync dirty local worktree into repo/
relunar repro upload <run-id> <local-path> <remote-path>
  -> resume sandbox and upload repro input
relunar repro exec <run-id> [--sync] -- <command>
  -> resume sandbox, optionally sync worktree, append issue-specific command evidence
relunar repro finish <run-id> --outcome <outcome> --summary <text> [--comment]
  -> enforce evidence gates (reproduced requires probe output by default)
  -> record reproduced, not_reproduced, or blocked outcome
  -> write report.json, report.md, logs.txt
  -> optionally post GitHub comment
  -> cleanup sandbox
```

Sandbox stays warm across probe iterations until finish/abort. Idle auto-stop defaults to 60 minutes (`sandbox.autoStopMinutes`) and is refreshed on each resume. Sync overlays present files and removes locally deleted tracked paths.
