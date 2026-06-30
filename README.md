# Relunar

Relunar is a deterministic GitHub App harness for OSS maintainers. When a new issue is opened, it queues a baseline run, executes repository setup/build/test in a Daytona sandbox, stores evidence in Postgres, and posts one compact GitHub issue comment.

Milestone 1 does not attempt issue-specific reproduction and does not use AI.

## Stack

- Bun + TypeScript
- Hono API service
- Postgres + Drizzle
- pg-boss queue
- GitHub App + Octokit
- Daytona sandbox
- Pino logs

## Services

```txt
api: bun run start:api
worker: bun run start:worker
```

The API service receives GitHub webhooks at:

```txt
POST /webhooks/github
GET /health
```

The worker consumes `repro_jobs` from pg-boss and posts the baseline report.

## Environment

Copy `.env.example` values into Railway service variables:

```txt
DATABASE_URL
GITHUB_APP_ID
GITHUB_PRIVATE_KEY
GITHUB_WEBHOOK_SECRET
DAYTONA_API_KEY
DAYTONA_API_URL
DAYTONA_TARGET
PORT
LOG_LEVEL
JOB_TIMEOUT_SECONDS
COMMAND_TIMEOUT_SECONDS
```

## Database

Generate migrations after schema edits:

```sh
bun run db:generate
```

Apply migrations:

```sh
bun run db:migrate
```

pg-boss creates its own queue schema on service startup.

## Verification

```sh
bun run verify
```

This runs Bun tests and TypeScript typechecking.

## Live Smoke

After the GitHub App is installed on a public JavaScript or TypeScript test repository and Railway has the required environment variables, run:

```sh
E2E_GITHUB_TOKEN=github_pat_value \
E2E_REPOSITORY=owner/repo \
bun run smoke:e2e
```

The smoke script creates a GitHub issue and waits for a Relunar baseline report comment. It exits non-zero if no report appears before the timeout.
