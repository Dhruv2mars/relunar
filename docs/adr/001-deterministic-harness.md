# ADR 001: Build Relunar As A Local CLI Harness

## Status

Accepted

## Date

2026-07-01

## Context

Relunar helps maintainers reproduce GitHub issues with evidence from a clean environment.

Hosted control planes add cost and trust burden before the workflow is proven:

- Relunar would need to operate infrastructure.
- Relunar would custody long-lived user secrets.
- Maintainers would need to trust background automation owned by Relunar.
- Coding agents would still be the natural driver for issue selection and follow-up.

The stronger v1 shape is local and agent-native. A maintainer asks a coding agent to investigate issues; the agent calls a deterministic CLI harness.

## Decision

Relunar v1 is a CLI-first repro harness.

Relunar will:

1. run on the maintainer machine
2. use the maintainer GitHub credentials
3. use the maintainer Daytona credentials
4. fetch issues through GitHub API
5. create short-lived Daytona sandboxes
6. clone the linked repository
7. run `.relunar.yml` setup and baseline commands
8. write local JSON, markdown, and logs
9. post GitHub comments only when `--comment` is explicit
10. clean up sandbox resources

Relunar will not include a hosted control plane, background automation owned by Relunar, central secret custody, billing, organization management, or a built-in AI agent in v1.

## Consequences

### Positive

- No hosted v1 infrastructure.
- No central Relunar custody of secrets.
- Lower operational cost.
- Easier OSS trust story.
- Agent workflows stay composable and visible.
- Reports remain deterministic and inspectable.

### Negative

- Maintainer machine must initiate runs.
- No Relunar-owned background automation in v1.
- Daytona account setup is required per user.
- Batch throughput is intentionally modest.

### Neutral

- Hosted automation can come later after the CLI workflow proves value.
- The CLI can later expose an MCP server without changing core run semantics.
- Browser repro can be added later through Playwright or agent-browser.

## Alternatives Considered

### Hosted Control Plane First

Rejected for v1. It creates operations, secret custody, and background automation complexity before validating maintainer demand.

### Built-in AI Agent

Rejected for v1. Relunar should be the harness, not the agent. Codex, Cursor, Claude Code, and other agents can decide issue priority and follow-up strategy.

### Local CLI Without Sandbox

Rejected. Clean sandbox execution is core to trusted repro evidence.
