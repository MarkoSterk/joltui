# Writing the documentation

The documentation is built with [Zensical](https://zensical.org) from the Markdown files in
`docs/` and the configuration in `zensical.toml` at the repository root. Versions are published
with Zensical's fork of [mike](https://zensical.org/docs/compatibility/mkdocs/mike/) to the
`gh-pages` branch and served by GitHub Pages.

Zensical is a Python tool. It runs through [uv](https://docs.astral.sh/uv/)'s `uvx`, so nothing
is added to `package.json`; you only need `uv` and `git`.

## Preview and build

Run from the repository root:

```sh
uvx zensical serve           # http://localhost:8000, live reload
uvx zensical build --clean   # static site in site/
```

or with the wrappers:

=== "Bash"

    ```sh
    ./scripts/docs.sh serve
    ./scripts/docs.sh build
    ```

=== "PowerShell"

    ```powershell
    .\scripts\docs.ps1 serve
    .\scripts\docs.ps1 build
    ```

`site/` and `.cache/` are build output; keep them out of version control.

## Structure

| Folder | Content | Style |
| --- | --- | --- |
| `getting-started/` | installation and a first application | step by step, for newcomers |
| `guide/` | one page per part of the framework | explains concepts with examples |
| `deployment.md` | building and hosting | checklist |
| `reference/` | configuration, decorators, classes, events, errors, exports | complete, terse look-up |
| `project/` | versioning, contributing, these notes, license | |
| `assets/` | logo, diagrams, `stylesheets/extra.css` | |

Add a new page to the `nav` in `zensical.toml`, or it will not appear in the navigation.

- Keep examples consistent with the *Fieldnotes* demo in `dev/` and with the current API.
- Use `{{! }}` in examples whenever the value could come from users.
- Diagrams go in `assets/images/` and are included with `{ .diagram }` so they get a frame in
  dark mode.
- Changes to public behaviour should update the documentation in the same pull request.

## Publishing versions

Each documentation version is a separate build, stored on the `gh-pages` branch by mike. The
version selector in the header lists them (`project.extra.version` in `zensical.toml`). Versions
are created per minor release (`0.9`, `1.0`); a patch release redeploys its minor version. See
[Versioning](versioning.md).

Publishing is scripted in `scripts/`. The step-by-step instructions, the one-time GitHub Pages
setup and the per-release checklist are in
[`scripts/DOCS_PUBLISHING.md`](https://github.com/MarkoSterk/joltui/blob/main/scripts/DOCS_PUBLISHING.md).

```sh
git checkout v1.0.0                   # release docs are built from the release tag
./scripts/publish_docs.sh --dry-run   # checks + the commands it would run
./scripts/publish_docs.sh             # build --strict, deploy 1.0, move `latest`, push
git checkout main
./scripts/publish_docs.sh --dev       # docs of the unreleased main branch
```

On Windows use `.\scripts\publish_docs.ps1` (`-DryRun`, `-Dev`, ...). Other commands:

| Command | Purpose |
| --- | --- |
| `./scripts/docs.sh serve` | live preview of the working tree |
| `./scripts/docs.sh build` | build into `site/` |
| `./scripts/docs.sh list` | show published versions and aliases |
| `./scripts/docs.sh serve-versions` | preview the versioned site from `gh-pages` locally |
| `./scripts/docs.sh delete 0.9` | remove a version |

!!! note "Transitional tooling"

    Zensical's mike fork is transitional until Zensical ships native versioning. Commands and the
    `gh-pages` layout stay compatible with mike 2.x.

### GitHub Actions

`.github/workflows/docs.yml` publishes automatically: the `dev` version on every push to `main`,
and the release version when a `v*` tag is pushed. Pull requests that change the documentation
get a `--strict` build check.
