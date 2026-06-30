# Relunar Architecture

## System Overview

Relunar is a deterministic repro harness. It receives GitHub issue events, creates durable jobs, runs repository baseline commands in Daytona, stores evidence, and comments on the issue.

The harness owns execution and classification. No AI is used in the first milestone.

```txt
GitHub Issue Event
  -> Railway API Service
  -> Postgres
  -> Railway Worker Service
  -> Daytona Sandbox
  -> Postgres Evidence
  -> GitHub Issue Comment
```

## Services

### API Service

Responsibilities:

- expose GitHub webhook endpoint
- verify webhook signatures
- authenticate as GitHub App
- parse supported events
- persist installation, repository, issue, and job records
- enqueue repro jobs
- return fast webhook responses

The API service does not run repro commands.

### Worker Service

Responsibilities:

- claim queued jobs
- create Daytona sandbox
- clone target repository
- detect package manager and scripts
- execute commands with timeouts
- collect exit codes and logs
- classify results
- render GitHub comment
- post GitHub comment
- persist final job state

The worker is the only service that talks to Daytona.

## Postgres

Postgres stores both application state and queue state for the MVP.

Recommended tables:

```txt
installations
repositories
issues
repro_jobs
command_runs
issue_comments
```

`installations` stores GitHub App installation IDs and account metadata.

`repositories` stores repository identity, default branch, clone URL metadata, and installation relation.

`issues` stores issue number, title, body snapshot, author login, state, and repository relation.

`repro_jobs` stores lifecycle state, result, timings, error category, and relation to issue/repository.

`command_runs` stores command, cwd, started time, finished time, exit code, stdout excerpt, stderr excerpt, and timeout flag.

`issue_comments` stores GitHub comment ID and body hash for comments posted by Relunar.

## Job State Machine

```txt
queued
  -> running
  -> completed

queued
  -> running
  -> failed
```

`completed` means Relunar produced a valid classified result and attempted comment delivery successfully.

`failed` means the job could not produce or deliver a valid report because of infrastructure or integration failure.

The result field is separate from lifecycle state:

```txt
baseline_passed
baseline_failed
blocked
run_failed
```

## Repro Runner

The runner executes a fixed baseline sequence:

1. clone repository
2. detect package manager
3. install dependencies
4. inspect `.relunar.yml` when present
5. run configured setup commands when present
6. inspect `package.json`
7. run build script if present
8. run test script if present

The runner never executes commands from issue bodies. Repository-level `.relunar.yml` setup commands are maintainer-controlled project configuration and run only inside the Daytona sandbox.

## Package Manager Detection

Detection is based on lockfiles first:

```txt
bun.lockb or bun.lock -> bun
pnpm-lock.yaml -> pnpm
yarn.lock -> yarn
package-lock.json -> npm
package.json -> npm fallback
```

If multiple lockfiles exist, the first match in the ordered list wins for milestone 1. Later milestones can add conflict reporting.

## Command Execution

Each command run records:

- command
- working directory
- start time
- finish time
- duration
- exit code
- timeout flag
- stdout excerpt
- stderr excerpt

Commands must have timeouts. The worker must stop executing the job after a terminal failure unless later commands are explicitly safe and useful.

## Repository Config

Relunar reads an optional `.relunar.yml` file from the repository root after dependencies install.

Supported shape:

```yaml
setup:
  - bun run generate
```

The config parser accepts only `setup` as an array of non-empty command strings. Setup commands run before build/test detection, are recorded with the `setup` command phase, and participate in normal timeout/failure classification. Invalid config blocks the job rather than falling back to speculative behavior.

## GitHub Integration

Relunar uses a GitHub App.

Required milestone 1 permissions:

- Issues: read and write, to read issue details and post comments.
- Contents: read, to clone/read repository contents.
- Metadata: read, required by GitHub Apps.

Required event subscription:

- Issues

The webhook handler should ignore events other than `opened` for the MVP.

## Daytona Integration

Daytona provides the isolated execution environment.

Relunar is responsible for:

- creating sandbox
- running commands
- collecting logs
- destroying sandbox or allowing configured cleanup
- marking job failed if sandbox lifecycle operations fail

No maintainer secrets are injected into Daytona for milestone 1.

## Comment Rendering

The reporter is template-based in milestone 1.

Input:

- job result
- repo metadata
- command runs
- sandbox metadata
- error category if present

Output:

- one markdown GitHub issue comment

The reporter must not claim issue-specific reproduction. It can only claim baseline result.

## Error Handling

Errors should be categorized:

- `webhook_verification_error`
- `queue_error`
- `github_auth_error`
- `github_api_error`
- `sandbox_create_error`
- `clone_error`
- `package_detection_error`
- `command_timeout`
- `command_failed`
- `report_post_error`

Only maintainer-useful details should appear in issue comments. Internal stack traces stay in logs.

## Deployment

Railway project:

```txt
api service
worker service
postgres service
```

Both `api` and `worker` use Bun and TypeScript.

Suggested start commands:

```txt
api: bun run start:api
worker: bun run start:worker
```

## Observability

Milestone 1 uses structured logs only.

Use Pino and include:

- job ID
- repository ID
- issue number
- GitHub delivery ID
- sandbox ID
- command run ID

PostHog, Sentry, and OpenTelemetry are intentionally out of scope for the first milestone.

## Future Architecture Boundary

AI can be added later as a bounded planner or reporter, but it must not own execution, classification, or GitHub mutation.

The intended future shape is:

```txt
Harness owns flow
AI suggests plan
Harness validates plan
Harness runs commands
Harness classifies evidence
Reporter writes comment
```

Milestone 1 implements only the harness.
