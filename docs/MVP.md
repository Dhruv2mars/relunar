# Relunar MVP

## Goal

The MVP proves the full end-to-end pipe:

New GitHub issue opened -> Relunar creates a job -> Daytona runs repository baseline commands -> Relunar posts one evidence comment.

The MVP intentionally does not try to reproduce the issue-specific bug. It verifies that Relunar can reliably run a clean baseline and report evidence to maintainers.

## Done Definition

The MVP is done when a test GitHub repository can install the Relunar GitHub App, open a new issue, and receive one Relunar baseline report comment produced from a Daytona sandbox run.

The report must include:

- status
- repository commit
- package manager
- commands attempted
- command outcomes
- exit code for failures
- short log excerpt for failures
- sandbox/runtime metadata

## Supported Repository Scope

Milestone 1 supports public JavaScript and TypeScript repositories.

Package manager detection order:

1. `bun.lockb` or `bun.lock`
2. `pnpm-lock.yaml`
3. `yarn.lock`
4. `package-lock.json`
5. `package.json` fallback

Default command choices:

- Bun repo: `bun install`
- pnpm repo: `pnpm install --frozen-lockfile`
- Yarn repo: `yarn install --frozen-lockfile`
- npm repo: `npm ci` when `package-lock.json` exists, otherwise `npm install`

Script detection:

- Run build only when `scripts.build` exists.
- Run test only when `scripts.test` exists and is not a placeholder script that exits with an obvious "no test specified" message.

## Trigger

The MVP listens for:

- `issues.opened`

No slash command is required for milestone 1.

## Data Model

Minimum tables:

- `installations`
- `repositories`
- `issues`
- `repro_jobs`
- `command_runs`
- `issue_comments`

Recommended `repro_jobs` states:

- `queued`
- `running`
- `completed`
- `failed`

Recommended job result values:

- `baseline_passed`
- `baseline_failed`
- `blocked`
- `run_failed`

## Baseline Pipeline

1. Receive webhook.
2. Verify GitHub signature.
3. Ignore unsupported events.
4. Upsert installation and repository.
5. Insert issue snapshot.
6. Insert `repro_job`.
7. Worker claims job.
8. Worker creates Daytona sandbox.
9. Worker clones repository.
10. Worker checks out the event commit or default branch head.
11. Worker detects package manager.
12. Worker runs install command.
13. Worker reads `package.json`.
14. Worker runs build script if present.
15. Worker runs test script if present.
16. Worker stores command results.
17. Worker classifies result.
18. Worker renders comment.
19. Worker posts comment.
20. Worker marks job completed or failed.

## Classification Rules

`baseline_passed`:

- install passed
- every detected baseline command passed

`baseline_failed`:

- install passed
- build or test command failed

`blocked`:

- install could not run because setup needs unavailable secrets or unsupported runtime requirements
- repository cannot be cloned with the GitHub App permissions
- package manager cannot be detected and no safe fallback exists
- required files are missing

`run_failed`:

- GitHub webhook verification failed unexpectedly after delivery
- queue insert or claim failed
- Daytona sandbox creation failed
- command runner crashed
- GitHub comment post failed

## Comment Rules

Relunar posts one comment per job in the MVP.

Comment must:

- state status first
- show commands in order
- show exact failed command when any command fails
- avoid claiming issue-specific reproduction
- avoid speculation
- avoid generated maintainer advice beyond the evidence

Comment must not:

- close the issue
- ask the user generic questions
- label the issue
- promise a fix
- mention AI

## Security And Safety

Relunar runs untrusted open source code in Daytona sandboxes only.

Milestone 1 constraints:

- hard timeout per job
- hard timeout per command
- no repository source edits
- no GitHub write access beyond issue comments
- no maintainer secrets passed into sandbox
- no private repository support
- no arbitrary command input from issue body

## Out Of Scope

- AI planner
- issue-specific repro
- browser automation
- config file
- artifact storage service
- dashboard
- analytics
- labels
- fix PRs
- private repos
- maintainer-controlled secret injection

## Next Milestone Candidates

After MVP, likely next steps are:

- Update existing bot comment instead of posting one per job.
- Artifact storage for full logs.
- Issue-specific deterministic commands when the issue body includes copyable commands.
- Browser automation for web repositories.
- AI planning through a separate bounded approach.

## Milestone 2: `.relunar.yml` Setup Commands

Relunar supports an optional `.relunar.yml` file at the repository root.

Supported shape:

```yaml
setup:
  - bun run generate
  - bun run db:prepare
```

Rules:

- `setup` must be an array of non-empty command strings.
- At most 10 setup commands are accepted.
- Setup commands run after dependency install and before detected build/test scripts.
- Setup commands run in the cloned repository root inside the Daytona sandbox.
- Each setup command is stored as a `setup` command run and appears in the GitHub comment.
- If the config file is invalid, the job is classified as `blocked`.
- If a setup command fails or times out, the job stops and is classified as `blocked`.

This milestone keeps the deterministic harness boundary intact. Relunar still does not execute commands from issue bodies, pass maintainer secrets into the sandbox, mutate repository source, create pull requests, label issues, or use AI.
