## Repro: Reproduced

Reproduced on built local tsc 6.0.0-dev: a newline after a constructor parameter-property modifier still yields `TS1005 ',' expected` (treated as two params).

### Steps to reproduce

1. Build local `tsc` (`bun run build`).
2. Save as `repro.ts`:

```ts
class Foo {
  constructor(public
    foo: string) {}
}
```

3. Run:

```sh
node built/local/tsc.js --noEmit --pretty false repro.ts
```

### Observed

```txt
repro.ts(2,14): error TS1005: ',' expected.
TSC_EXIT=2
```

### Expected

Treat as a parameter property (or document that a newline after the modifier is invalid).

### Environment

- Repo: `Dhruv2mars/typescript-relunar-testbed` @ `a8e129925`
- tsc 6.0.0-dev (built/local)

Artifacts: `.relunar/runs/issue-5026-2026-07-18T064254146Z`
