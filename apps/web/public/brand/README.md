# Brand assets

Official Relunar logo exports used across the site.

- `relunar-blackfill.png` — black mark on white (light theme reference)
- `relunar-whitefill.png` — white mark on black (dark theme reference)

Regenerate from the shared geometry with:

```sh
bun run brand:export --filter=@relunar/web
```

The UI uses a vector `LogoMark` derived from the same geometry for crisp rendering at any size.
