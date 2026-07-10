# Relunar Testbeds

Relunar testbeds are independent copies of real open-source repositories used to exercise the public user workflow without modifying Relunar or commenting on upstream issues.

Testbeds live together under:

```txt
$DEV_GITHUB/testbeds/
```

Each testbed contains:

- the current upstream source snapshot;
- a fresh Git history containing only the snapshot commit;
- copied open issues hosted in a repository owned by the tester; and
- no Relunar configuration or setup performed in advance.

The coding agent remains responsible for installing Relunar, configuring the repository, deciding how to reproduce an issue, and choosing whether to post a report with `--comment`.

## Web and CLI Testbed

Initial source repository:

```txt
microsoft/TypeScript
```

GitHub testbed:

```txt
Dhruv2mars/typescript-relunar-testbed
```

Local clone:

```txt
$DEV_GITHUB/testbeds/typescript-relunar-testbed
```

TypeScript is the initial target because it combines a large open-issue set with a platform-independent compiler and CLI codebase. This keeps the first testbed aligned with Relunar's current focus on web and terminal projects. Desktop and mobile testbeds can be added beside it later.

## Construction Boundary

Testbed construction is complete when:

1. the current TypeScript source snapshot exists in the tester-owned GitHub repository;
2. as many upstream open issues as GitHub safely allows have been copied into that repository;
3. copied issues are open and retain their original titles, bodies, and applicable labels; and
4. the tester-owned repository is cloned under `$DEV_GITHUB/testbeds/`.

Do not add `.relunar.yml`, link the repository in Relunar, install dependencies, run project setup, or post reproduction comments while constructing the testbed. Those actions belong to the agent-driven Relunar workflow being tested.

## Issue Import

Issue import must be resumable and paced to respect GitHub API rate limits. Before creating an issue, the importer should check whether its upstream issue number was already copied. This permits repeated import runs without duplicating issues.

GitHub assigns new issue numbers and records the importing account as the creator. The imported title and body should otherwise remain unchanged wherever possible. Labels may be copied when the same label exists in the testbed repository.

## Relunar Validation Flow

After testbed construction, an agent can perform the actual product workflow:

```sh
cd "$DEV_GITHUB/testbeds/typescript-relunar-testbed"
relunar init
relunar repo link Dhruv2mars/typescript-relunar-testbed
relunar issues list --state open --limit 5
relunar repro <issue-number>
relunar repro <issue-number> --comment
```

These commands are examples of the later agent-owned workflow. They are not part of testbed construction.
