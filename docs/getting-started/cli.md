# Command line tools

The package exposes a `joltui` executable:

```sh
npx joltui init
npx joltui agents
npx joltui agents claude
```

`npm exec -- joltui init` is equivalent. `npm joltui init` is not an npm command.
When using the scoped distribution, bootstrap with
`npx --package=@pro/joltui joltui init`; configure your private registry first.
The unqualified `npx joltui` works when the executable is installed locally, or
when the package is published as `joltui` on your configured registry.

## Create an application

Run `init` in your application root, including after `npm init` and installing JoltUI.
It scaffolds the **current directory**, without creating a nested project.

`init` asks for an application name (defaulting to the existing package name or directory name), whether to include
Vite (yes), whether to include the JoltUI Vite plugin (yes when Vite is selected),
and whether to install dependencies immediately (yes). The app name is used for
application metadata, never as an output directory.

Existing package metadata, scripts, and dependency versions are preserved; missing
scripts and dependencies are added to the same `package.json`. Installation runs
in that directory and reuses its `node_modules` and lockfile. Existing README and
ignore files are preserved. Conflicting source or configuration files stop initialization
before any files are changed. In an empty directory, `init` creates `package.json`.

The starter includes TypeScript configuration, an HTML entry, an application,
router, layout, reactive counter page, stylesheet, and npm scripts. Without the
plugin, pages are registered explicitly. Without Vite, configure your own bundler
before serving the app; `npm run typecheck` remains available.

```sh
npx joltui init my-app --yes
npx joltui init my-app --yes --no-install
npx joltui init my-app --yes --no-plugin
npx joltui init my-app --yes --no-vite
```

`--yes` accepts defaults and is required without an interactive terminal.
`--no-install` writes files without running npm. Install failures retain the
generated files so you can correct registry settings and rerun `npm install`.
Existing scoped framework dependencies are reused directly. When adding dependencies,
scoped releases generate npm aliases to their scoped framework and plugin packages.

## Coding agents

Run `agents` from your application root. The optional agent name is `generic`
(default), `codex`, or `claude`, case insensitive.

- Generic and Codex: `AGENTS.md` and `.agents/skills/joltui/`.
- Claude: `CLAUDE.md` and `.claude/skills/joltui/`.

Existing instruction text is preserved and a JoltUI skill link is appended.
The skill includes a topic index and the Markdown guides, getting-started material,
and API references bundled with the installed framework version. Agents can read
only the topics they need, including components, routing, reactivity, templates,
lifecycle, authentication, errors, cancellation, caching, server components, and
deployment.

An existing JoltUI skill directory is never overwritten. To refresh documentation
after upgrading, move the old skill directory aside, then rerun the command.
