# Brand assets

Official Relunar logo exports used across the site.

- `relunar-blackfill.png` — black mark on white (light theme reference)
- `relunar-whitefill.png` — white mark on black (dark theme reference)
- `relunar-blackfill.svg` — transparent black mark for light surfaces
- `relunar-whitefill.svg` — transparent white mark for dark surfaces

Regenerate PNG and icon fallbacks from the shared geometry with:

```sh
bun run brand:export --filter=@relunar/web
```

The UI uses the transparent SVG exports for crisp rendering at any size.
