# ADR 001: Build Relunar As A Deterministic Harness First

## Status

Accepted

## Date

2026-06-30

## Context

Relunar's goal is to help open source maintainers understand whether a GitHub issue can be reproduced in a clean environment. Maintainers need concrete evidence, not broad automation or speculative summaries.

The long-term product may include AI-assisted planning, issue-specific repro attempts, browser automation, and richer reporting. The first milestone should prove the core system without adding autonomy or model behavior.

The system must be easy to trust:

- commands must be visible
- exit codes must be recorded
- logs must be attached or summarized
- status classification must be explainable
- GitHub writes must be deterministic
- sandbox execution must be bounded

## Decision

Relunar will start as a deterministic repro harness.

For milestone 1:

- no AI planner
- no AI reporter
- no autonomous agent loop
- no issue-body command execution
- no code edits
- no fix PRs
- no labels
- no dashboard

The harness will:

1. receive `issues.opened`
2. create a durable job
3. run baseline commands in Daytona
4. store command evidence
5. classify result through deterministic rules
6. post one GitHub issue comment

## Consequences

### Positive

- Lower implementation risk.
- Lower product ambiguity.
- Maintainer-facing output is grounded in observed commands.
- Easier debugging when runs fail.
- Easier security review because execution paths are fixed.
- AI can be added later behind stable interfaces.

### Negative

- Milestone 1 cannot reproduce most issue-specific bugs.
- Comments may be useful but limited.
- Some repositories will fail because zero-config setup cannot know project-specific requirements.
- No natural-language interpretation of vague issues in the first milestone.

### Neutral

- The first milestone is a platform proof, not the final product promise.
- The comment must clearly say "baseline report" to avoid overclaiming.

## Alternatives Considered

### Agent First

An autonomous agent could inspect the issue, choose commands, iterate, and attempt deeper reproduction from day one.

Rejected for milestone 1 because it increases risk, makes status harder to trust, and creates more surface area before the core pipeline is proven.

### LLM Planner With Harness

An LLM could produce a JSON repro plan while deterministic code still owns execution.

Deferred. This may be a good later step, but the first milestone should work without model dependency.

### GitHub Comment Bot Without Sandbox

Relunar could parse issues and comment with requested missing information without running code.

Rejected because Relunar's core value is evidence from a clean environment. A comment-only bot is too close to generic triage.

### Full Triage Platform

Relunar could include labels, dashboards, prioritization, analytics, auto-closing, and fix PRs.

Rejected because the product principle is simplicity. The first useful unit is a repro evidence comment.

## Future Extension

AI may be added later as a bounded planner or reporter. If added, the harness must still own:

- allowed commands
- timeouts
- sandbox lifecycle
- status classification
- GitHub writes
- evidence storage

The architecture should make AI replaceable, optional, and unable to mutate external state directly.

