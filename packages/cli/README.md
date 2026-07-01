# Relunar CLI

Relunar is a CLI-first GitHub issue repro harness for coding agents.

```sh
npm install -g @dhruv2mars/relunar
relunar
```

First launch guides you through setup:

- GitHub auth through `gh auth token`, `RELUNAR_GITHUB_TOKEN`, or a token prompt
- Daytona auth through `RELUNAR_DAYTONA_API_KEY` or an API key prompt
- optional current repo link

After setup:

```sh
relunar doctor
relunar repo link owner/repo
relunar issues list --state open --json
relunar repro 123
relunar repro 123 --comment
```
