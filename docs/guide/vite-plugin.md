# Vite plugin

Listing every page in the router configuration is tedious and easy to get wrong.
`joltui-vite-plugin` discovers pages at build time and hands them to the router automatically.

## Installation

```sh
npm install --save-dev joltui-vite-plugin
```

```typescript title="vite.config.ts"
import { defineConfig } from "vite";
import joltui from "joltui-vite-plugin";

export default defineConfig({
    plugins: [joltui()],
});
```

With the plugin in place, the router needs no `pages` option:

```typescript
return new MyRouter({
    app: this,
    baseLayout: MainLayout,
    defaultTarget: "#page",
});
```

## How it works

1. **Scan.** The plugin parses every TypeScript file below `src` (or the Vite root if there is no
   `src`) with the TypeScript compiler API. It looks for classes decorated with `@page` and
   `@component` imported from `joltui`.
2. **Generate.** It creates a virtual module, `virtual:joltui-pages`, that statically imports
   every discovered page and passes the list to `registerGeneratedPages()`.
3. **Inject.** It adds an import of the virtual module to the application entry (`src/main.ts` by
   default), so the pages are registered before the App starts.
4. **Use.** When a `Router` is constructed without `pages`, it calls `getGeneratedPages()` and
   builds its route table from the result.

Conceptually, the generated module looks like this:

```typescript
import Page0 from "/src/app/pages/aboutPage.ts";
import Page1 from "/src/app/pages/homePage.ts";
import Page2 from "/src/app/pages/postPage.ts";
import { registerGeneratedPages } from "joltui";

const pages = [Page0, Page1, Page2];
registerGeneratedPages(pages);
export default pages;
```

## Rules for discoverable pages

A page is discovered when its module:

- imports `page` and `component` from `joltui` (named imports, renamed imports such as
  `page as route`, and namespace imports like `import * as jolt from "joltui"` with
  `@jolt.page(...)` all work);
- declares the class as the module's **default export**: `export default class …`;
- gives the class a **name**;
- applies both `@page` and `@component` to it;
- contains **at most one** page.

```typescript title="src/app/pages/homePage.ts"
import { CustomElement, component, html, page } from "joltui";

@page({ path: "/", title: "Home" })
@component({ tagName: "home-page" })
export default class HomePage extends CustomElement<MyApp> {
    override markup = () => html`<h1>Home</h1>`;
}
```

## Build-time validation

The plugin turns these mistakes into build errors instead of runtime surprises:

- a `@page` class that is not the default export (named exports are rejected, not ignored);
- a page without `@component`;
- an anonymous page class;
- more than one page in a module;
- two pages declaring the same static path;
- two components declaring the same static `tagName`, anywhere in the scanned sources;
- no pages at all.

Paths and tag names are checked when they are written as string literals, which is the normal
case.

## Options

```typescript
joltui({
    root: "src",
    entry: "main.ts",
    include: ["**/*.ts"],
    exclude: ["**/*.test.ts"],
    frameworkPackage: "joltui",
});
```

| Option | Default | Meaning |
| --- | --- | --- |
| `root` | `src` if it exists, else the Vite root | Directory to scan, relative to the Vite root. |
| `entry` | `main.ts`, `main.tsx`, `main.js` | Entry file(s), relative to `root`, that receive the virtual import. |
| `include` | `**/*.ts`, `**/*.tsx`, `**/*.mts` | Glob patterns to scan. |
| `exclude` | `.d.ts`, `.test.*`, `.spec.*`, `node_modules`, `dist` | Glob patterns to skip. |
| `frameworkPackage` | `joltui` | Package that exports `page`, `component` and `registerGeneratedPages`. |

!!! note "Scoped package names"

    If you install JoltUI under another name (for example from a private registry as
    `@scope/joltui`), set `frameworkPackage` to that name so the plugin recognises the imports.

## Development and watch mode

During `vite` development, adding, removing or changing a page declaration triggers a **full page
reload**. Hot replacement is not possible because the browser cannot unregister a custom element
once it has been defined.

`vite build --watch` is supported too. The plugin watches the source tree for new files, and every
watch build rescans the sources and regenerates the virtual module, so creating, deleting or
fixing a page is picked up without restarting the watcher.

## Pages are eager, their dependencies lazy

Discovered pages are **static imports** and end up in the main bundle.
[Lazy dependencies](lazy-dependencies.md) declared by those pages remain separate chunks loaded on
demand. Keep page classes thin and move heavy components and libraries into lazy dependencies.

## Without the plugin

The plugin is a convenience, not a requirement. Pass `pages` to the router yourself, or call
`registerGeneratedPages([...])` from your own code before the App starts. `getGeneratedPages()`
returns whatever was registered last.
