# Publishing the documentation

The documentation site (<https://joltui.markosterk.com>) is built with Zensical from `docs/` and
`zensical.toml`. Every **minor** release of the `joltui` package gets its own documentation
version (`0.9`, `1.0`, `1.1`, ...). The versions are stored on the `gh-pages` branch by mike
(Zensical's fork) and served by GitHub Pages.

| Name | Meaning |
| --- | --- |
| `1.0` | docs of the 1.0.x releases, built from a `v1.0.*` tag |
| `latest` | alias of the newest released version, and the default page |
| `dev` | docs of the `main` branch (unreleased changes) |

Patch releases (`1.0.1`) redeploy their minor version (`1.0`).

## Requirements

Only [uv](https://docs.astral.sh/uv/) and `git`. Zensical and mike are Python tools; they run
through `uvx` in throw-away environments, so nothing is added to `package.json` or
`node_modules`.

## Commands

Bash and PowerShell wrappers call the same `docs.py` helper. Run them from any directory.

| Bash | PowerShell | Purpose |
| --- | --- | --- |
| `./scripts/docs.sh serve` | `.\scripts\docs.ps1 serve` | live preview at <http://localhost:8000> |
| `./scripts/docs.sh build` | `.\scripts\docs.ps1 build` | build into `site/` |
| `./scripts/docs.sh list` | `.\scripts\docs.ps1 list` | published versions and aliases |
| `./scripts/docs.sh serve-versions` | `.\scripts\docs.ps1 serve-versions` | preview the versioned site from `gh-pages` |
| `./scripts/publish_docs.sh` | `.\scripts\publish_docs.ps1` | publish the release you have checked out |
| `./scripts/publish_docs.sh --dev` | `.\scripts\publish_docs.ps1 -Dev` | publish `dev` from `main` |
| `./scripts/docs.sh delete 0.9` | `.\scripts\docs.ps1 delete 0.9` | remove a version |

### What `publish_docs` does

1. Reads the version from `package.json` (`1.0.1` → docs version `1.0`), or uses `--version`.
2. Refuses to run with uncommitted changes, or when `HEAD` has no `v1.0.*` tag. Release docs
   must come from the tag, so they describe the published package.
3. Builds the site with `zensical build --strict`, so any warning stops the publish.
4. Updates the local `gh-pages` branch from the remote, then deploys with mike:
   - the newest version gets the `latest` alias,
   - an older version (a fix to old docs) is deployed **without** moving `latest`,
   - on the first deploy, `latest` also becomes the default page.
5. Pushes `gh-pages` to the remote. GitHub Pages updates within a minute or two.

### Options

| Bash | PowerShell | Effect |
| --- | --- | --- |
| `--dry-run` | `-DryRun` | run the checks and print the commands, publish nothing |
| `--version 0.9` | `-Version 0.9` | publish another minor version (check out its tag first) |
| `--dev` | `-Dev` | publish the `dev` version (no tag needed) |
| `--title "1.0 (beta)"` | `-Title "1.0 (beta)"` | title in the version selector |
| `--remote github` | `-Remote github` | git remote that hosts GitHub Pages (default `origin`) |
| `--no-latest` | `-NoLatest` | do not move the `latest` alias |
| `--set-default` | `-SetDefault` | make `latest` the default page again |
| `--no-push` | `-NoPush` | commit to the local `gh-pages` only (preview with `serve-versions`) |
| `--allow-untagged` | `-AllowUntagged` | publish a release version from an untagged commit |
| `--allow-dirty` | `-AllowDirty` | publish with uncommitted changes |

The remote can also be set once with the `JOLTUI_DOCS_REMOTE` environment variable.

> [!WARNING]
> **Local publishing and the Gitea mirror.** In the local clone, `origin` fetches from the
> internal Gitea server and pushes to both Gitea and GitHub. mike reads `gh-pages` from the
> remote it is given, so publish from a remote that points only at GitHub:
>
> ```sh
> git remote add github git@github.com:MarkoSterk/joltui.git
> ./scripts/publish_docs.sh --remote github
> ```
>
> Publishing from GitHub Actions needs none of this: there `origin` is GitHub.

For reproducible publishing, pin mike to a commit in `MIKE_SOURCE` at the top of `docs.py`.

## GitHub Actions

`.github/workflows/docs.yml` publishes automatically:

- every push to `main` → `dev`,
- every pushed `v*` tag → that minor version (and `latest` when it is the newest),
- pull requests that touch the docs → a `--strict` build check only.

Manual publishing with the scripts and the workflow can be mixed; both write to the same
`gh-pages` branch.

## Release checklist

**Before the release**

- [ ] Documentation for every user-visible change is in `docs/` (new options in
      `docs/reference/configuration.md`, new exports in `docs/reference/exports.md`).
- [ ] New pages are listed in the `nav` of `zensical.toml`.
- [ ] `./scripts/docs.sh build` finishes without warnings.
- [ ] A quick look with `./scripts/docs.sh serve`: new pages, code examples and links.

**Publish**

- [ ] Tag the release and push the tag (`git tag v1.0.0 && git push github v1.0.0`). The workflow
      publishes it. To publish by hand instead:
  - [ ] `git checkout v1.0.0`
  - [ ] `./scripts/publish_docs.sh --dry-run` — confirm the docs version is `1.0` and that
        `latest` moves.
  - [ ] `./scripts/publish_docs.sh`
  - [ ] `git checkout main`, then `./scripts/publish_docs.sh --dev`

**After publishing**

- [ ] `./scripts/docs.sh list` shows `1.0 [latest]`.
- [ ] <https://joltui.markosterk.com> opens the new version, and the version selector lists it.
- [ ] HTTPS works and the custom domain is still set (repository Settings → Pages).

For a fix to the docs of an older version, check out its latest tag (`v0.9.3`) and run
`./scripts/publish_docs.sh --version 0.9`; `latest` stays where it is.

## One-time setup

1. Push the repository (with `docs/`, `zensical.toml`, `scripts/` and the workflow) to
   `github.com/MarkoSterk/joltui`.
2. Repository Settings → Actions → General → Workflow permissions: **Read and write**, so the
   workflow can push `gh-pages`.
3. Publish once (push to `main`, or `./scripts/publish_docs.sh --dev --remote github`), so the
   `gh-pages` branch exists.
4. Settings → Pages → Source: **Deploy from a branch**, branch `gh-pages`, folder `/ (root)`.
5. Custom domain `joltui.markosterk.com`: a DNS `CNAME` record `joltui` → `markosterk.github.io`,
   the domain entered under Settings → Pages (and verified in the account's Pages settings),
   then "Enforce HTTPS".

GitHub keeps the custom domain in a `CNAME` file at the root of `gh-pages`. mike leaves it alone.
Never add a `CNAME` file to `docs/`.

If you use another domain, change `site_url` in `zensical.toml` and the links in this file.

## Troubleshooting

| Problem | Fix |
| --- | --- |
| `HEAD is not at a v1.0.* release tag` | `git checkout v1.0.0` (or the latest patch tag), or pass `--allow-untagged` deliberately. |
| `The working tree has uncommitted changes` | Commit or stash; the docs must match a commit. |
| `Could not fast-forward the local gh-pages branch` | A `--no-push` deploy left local commits. Push them (`git push github gh-pages`) or reset the branch: `git branch -f gh-pages github/gh-pages`. |
| The build stops on a warning | Fix the warning shown above the error (broken link, missing file, bad config). |
| The workflow fails with `403` on push | Workflow permissions are read-only; see the one-time setup. |
| The site shows the old version | Wait for the Pages deploy (Actions tab, "pages build and deployment"), then hard-refresh. |
| Custom domain lost | Check that `CNAME` exists at the root of `gh-pages`; re-enter the domain under Settings → Pages. |
