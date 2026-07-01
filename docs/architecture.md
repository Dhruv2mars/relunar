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
npm install -g relunar
relunar
  -> setup prompt if GitHub or Daytona auth is missing
  -> save secrets to OS keychain when supported
  -> save non-secret Daytona settings to ~/.config/relunar/config.json
  -> optional repo link for current directory
```

## Run Flow

```txt
relunar repro 123
  -> resolve linked repo
  -> resolve GitHub token
  -> resolve Daytona API key
  -> fetch GitHub issue
  -> create Daytona sandbox
  -> clone repo
  -> read .relunar.yml
  -> run setup commands
  -> run baseline commands
  -> write report.json, report.md, logs.txt
  -> optionally post GitHub comment
  -> cleanup sandbox
```
