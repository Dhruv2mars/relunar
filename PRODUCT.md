# Relunar Product Notes

## Vision

Relunar helps open source maintainers understand whether a new GitHub issue can be reproduced in a clean environment.

Most issue reports describe a symptom without enough state for a maintainer to act. Maintainers need concrete evidence: commands run, environment, logs, failures, and clear missing information. Relunar exists to produce that evidence without turning into a broad issue-management platform.

## Target User

Relunar is for open source maintainers, core contributors, project developers, and triagers.

Relunar is not primarily for people filing issues. The person receiving value is the maintainer who opens an issue and needs to know what can be trusted, what failed, and what is missing.

## Product Promise

When a new issue is opened, Relunar attempts a deterministic baseline reproduction in a clean sandbox and comments with the result.

For the first milestone, Relunar does not claim that it reproduced the user-reported bug. It only reports whether the repository baseline succeeds in a clean environment.

## Product Principles

- Repro evidence over AI summary.
- Simple comment output over dashboard.
- Deterministic harness before agent behavior.
- Maintainer trust over automation breadth.
- One clear result per issue run.
- Small surface area, few concepts, no feature bloat.
- No source mutation in milestone 1.
- No automatic fixes in milestone 1.
- No labels, prioritization, or triage suite in milestone 1.

## First Milestone

Relunar receives a GitHub `issues.opened` webhook, creates a repro job, starts a Daytona sandbox, clones the repository, detects the package manager and common scripts, runs baseline commands, and posts one GitHub issue comment with evidence.

The baseline flow is:

1. Verify the GitHub webhook.
2. Store the installation, repository, issue, and job.
3. Create a Daytona sandbox.
4. Clone the repository.
5. Detect package manager.
6. Install dependencies.
7. Run `build` if a build script exists.
8. Run `test` if a test script exists.
9. Classify the outcome.
10. Post one GitHub comment.

## Milestone 1 Statuses

- `baseline_passed`: install and all detected baseline commands passed.
- `baseline_failed`: install passed, but build or test failed.
- `blocked`: repository setup could not complete because of missing required configuration, unavailable dependencies, unsupported package shape, or setup constraints.
- `run_failed`: Relunar infrastructure, webhook handling, queue processing, sandbox startup, or GitHub API interaction failed.

Milestone 1 does not use `reproduced` because no issue-specific reproduction is attempted yet.

## Non-Goals For Milestone 1

- No AI planner.
- No AI reporter.
- No autonomous agent loop.
- No browser automation unless a future milestone explicitly adds it.
- No dashboard.
- No analytics.
- No Sentry or PostHog.
- No labels.
- No issue closing.
- No pull requests.
- No code edits.
- No private secrets flow.
- No broad issue triage.

## Platform And Stack

- Platform: Railway.
- Runtime: Bun.
- Language: TypeScript.
- API framework: Hono.
- Database: Postgres.
- Database toolkit: Drizzle.
- Queue: Postgres-backed queue, with `pg-boss` as the default candidate.
- GitHub integration: GitHub App plus Octokit.
- Sandbox: Daytona.
- Validation: Zod.
- Logging: Pino.

## Product Shape

Relunar is a GitHub App with two deployed services:

- `api`: receives GitHub webhooks, verifies signatures, stores jobs, and handles GitHub App integration.
- `worker`: consumes jobs, runs repro work in Daytona, stores evidence, and posts comments.

Postgres stores durable state for installations, repositories, issues, jobs, command runs, and comments.

## Comment Shape

Relunar comments should be factual and compact.

```md
## Relunar baseline report

Status: Baseline passed

Repository:
- Commit: abc123
- Package manager: bun

Ran:
- bun install
- bun run build
- bun test

Result:
All baseline commands passed in a clean Daytona sandbox.
```

Failure comments should show the exact command, exit code, and a short log excerpt. Long logs belong in stored artifacts once artifact storage exists.

## Future Direction

After the deterministic baseline works, Relunar can add issue-specific repro attempts. AI may be introduced later through a separate approach, but it must remain bounded by the harness. The harness owns execution, status classification, and GitHub writes.

