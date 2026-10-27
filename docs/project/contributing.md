# Contributing

## Development setup

```sh
git clone https://github.com/MarkoSterk/joltui.git
cd joltui
npm install
```

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the *Fieldnotes* demo application (`dev/`) with Vite. |
| `npm run typecheck` | Type-check the framework. |
| `npm run build` | Compile `src/` into `dist/`. |
| `npm run test:router` | Build and run the router tests. |
| `npm run test:cancellation` | Build and run the cancellation tests. |
| `npm run dev:build` | Production build of the demo application. |

A Husky pre-commit hook runs `npm run typecheck` before each commit.

## Repository layout

| Path | Content |
| --- | --- |
| `src/` | Framework source (TypeScript). |
| `dist/` | Compiled package output. |
| `dev/` | *Fieldnotes*, the demo application. |
| `tests/` | Node test runner tests. |
| `docs/` | This documentation (Markdown). |
| `zensical.toml` | Documentation site configuration. |
| `scripts/` | Documentation build and publishing scripts. |

## Pull requests

- Keep changes focused and describe the user-visible effect.
- Add or update tests for behaviour changes.
- Update the documentation in `docs/` in the same pull request when public behaviour changes; see
  [Writing the documentation](documentation.md).
