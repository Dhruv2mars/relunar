# Relunar Testbed

Use a local OSS clone to exercise the public user workflow without touching Relunar's own repository.

Recommended local testbed:

```txt
$DEV_GITHUB/relunar-testbed-fastify
```

Source repository:

```txt
fastify/fastify
```

## Setup

```sh
export DEV_GITHUB="${DEV_GITHUB:-$HOME/dev/github}"
cd "$DEV_GITHUB"
git clone --depth 1 https://github.com/fastify/fastify.git relunar-testbed-fastify
cd relunar-testbed-fastify
relunar init
relunar repo link fastify/fastify
```

Use this `.relunar.yml` for the Fastify testbed:

```yaml
version: 1

setup:
  - npm install

baseline:
  - npm run test:ci

report:
  maxLogLines: 200
```

## Smoke Checks

```sh
relunar doctor --json
relunar issues list --state open --limit 5 --json
```

Expected before Daytona auth is configured:

- `repo linked` is `ok: true`
- `github auth` is `ok: true`
- `daytona auth` may be `ok: false`
- `.relunar.yml` is `ok: true`

## Full Sandbox Check

After configuring Daytona:

```sh
relunar auth daytona --api-key <key>
relunar doctor
relunar repro 6818
relunar runs list
relunar runs show <run-id>
```

Do not use `--comment` during testbed runs unless deliberately testing GitHub comment posting.
