export const sampleReportMd = `# Reproduction report

**Issue #123** — TypeError when parsing empty config
**Run** \`run_7k2m9x4p\` · baseline **failed** (1 test)

## Sandbox
Fresh Daytona environment · cloned \`acme/widget@main\`

## Setup
\`\`\`
$ bun install
✓ 142 packages installed
\`\`\`

## Baseline
\`\`\`
$ bun test
✗ config/parser › handles empty file

  Expected parseConfig({}) not to throw
  Received: TypeError: Cannot read
  properties of undefined
\`\`\`

## Next step
Agent inspects this report locally — no
GitHub comment unless you pass \`--comment\`.
` as const;

export const sampleReportJson = `{
  "runId": "run_7k2m9x4p",
  "issue": {
    "number": 123,
    "title": "TypeError when parsing empty config",
    "repo": "acme/widget"
  },
  "status": "completed",
  "sandbox": {
    "provider": "daytona",
    "createdAt": "2026-07-10T09:14:22Z"
  },
  "baseline": {
    "passed": false,
    "failed": 1,
    "commands": ["bun run typecheck", "bun test"]
  },
  "artifacts": [
    ".relunar/runs/run_7k2m9x4p/report.md",
    ".relunar/runs/run_7k2m9x4p/report.json",
    ".relunar/runs/run_7k2m9x4p/logs.txt"
  ]
}` as const;

export const sampleLogsTxt = `[09:14:22] sandbox created · daytona
[09:14:24] clone acme/widget · main @ 4f2c9d1
[09:14:31] $ bun install
[09:14:39] 142 packages installed
[09:14:39] $ bun run typecheck
[09:14:47] typecheck passed
[09:14:47] $ bun test
[09:14:52] 41 passed · 1 failed
[09:14:52] ✗ config/parser › handles empty file
[09:14:53] report written · run_7k2m9x4p
[09:14:54] sandbox destroyed` as const;
