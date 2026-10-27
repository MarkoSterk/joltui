# Configuration

## `AppConfig`

Passed to the `App` constructor.

| Option | Type | Default | Meaning |
| --- | --- | --- | --- |
| `appName` | `string` | *(required)* | Non-empty application name; also used by `router.setTitle("_default")`. |
| `dataStructure` | `DataStructure \| null` | `{}` | Shared data fields and their initial values. Only declared fields can be read or written. |
| `serverComponentsUrl` | `string \| null` | `null` | Endpoint for [server components](../guide/server-components.md). |
| `container` | `Element \| null` | `null` | Container element, if not passed to `init()`. |
| `templatesCacheDuration` | `number \| null` | `300` | Default template-cache lifetime in seconds. |
| `templatesCacheCleanupInterval` | `number \| null` | `60` | Seconds between automatic cache cleanups; `0` disables them. |

## `RouterConfig`

Passed to the `Router` constructor, usually in `App.routerGenerator()`.

| Option | Type | Default | Meaning |
| --- | --- | --- | --- |
| `app` | `TApp` | *(required)* | The application instance. |
| `baseLayout` | layout class | *(required)* | Default layout; must use `@layout`. |
| `defaultTarget` | `string` | *(required)* | Selector inside the layout that receives the page. |
| `pages` | page classes | generated pages | Page classes; optional with the [Vite plugin](../guide/vite-plugin.md). |
| `baseUrl` | `string` | `""` | Prefix for every page path; may contain `<str:…>` / `<int:…>` parameters. |
| `indexRoute` | `string` | `"/"` | Path used when the location has no path. |

## `@component` options

| Option | Type | Meaning |
| --- | --- | --- |
| `tagName` | `string` | Required. Lowercase, starts with a letter, contains a hyphen. |
| `dataField` | `string` | Re-render the whole component when this application data field changes. |
| `useServer` | `boolean` | Load markup from `serverComponentsUrl` instead of calling `markup()`. |
| `groupName` | `string` | Group sent with server-component requests (default `"default"`). |
| `cache` | `boolean` | Enable template caching for the component. |
| `cacheDuration` | `number` | Cache lifetime in seconds; `0` disables caching. |

## `@page` options

`@page("/path")` is shorthand for `@page({ path: "/path" })`.

| Option | Type | Meaning |
| --- | --- | --- |
| `path` | `string` | URL pattern; must start with `/`. Parameters: `<str:name>`, `<int:name>`. |
| `title` | `string` | Document title, passed through `titleGenerator`. |
| `layout` | layout class | Layout for this page; defaults to the router's `baseLayout`. |
| `target` | `string` | Selector receiving the page; defaults to `defaultTarget`. |
| `subLayouts` | `SubLayoutConfig[]` | Ordered `{ target, layout }` chain between the layout and the page. |
| `extras` | `Record<string, unknown>` | Free-form metadata, available as `router.currentRoute.extras`. |

## `RedirectOptions`

Second argument of `router.redirect(path, options)`.

| Option | Type | Meaning |
| --- | --- | --- |
| `useBaseUrl` | `boolean` | Prepend the router's `baseUrl` and fill its parameters. |
| `baseParameters` | `RouteParameters` | Override base-URL parameters (defaults to the current route's). |

## `ErrorPageOptions`

Second argument of `router.showErrorPage(Component, options)`.

| Option | Default | Meaning |
| --- | --- | --- |
| `error` | — | The handled error; lets the router ignore stale error pages. |
| `title` | — | Document title. |
| `layout` | base layout | Layout to render the error page in. |
| `target` | default target | Target selector inside the layout. |
| `args` | — | Arguments passed to the component. |

## Vite plugin options

| Option | Default | Meaning |
| --- | --- | --- |
| `root` | `src` if it exists, else the Vite root | Directory to scan. |
| `entry` | `main.ts`, `main.tsx`, `main.js` | Entry file(s) that receive the virtual import. |
| `include` | `**/*.ts`, `**/*.tsx`, `**/*.mts` | Glob patterns to scan. |
| `exclude` | `.d.ts`, `.test.*`, `.spec.*`, `node_modules`, `dist` | Glob patterns to skip. |
| `frameworkPackage` | `joltui` | Package that exports `page`, `component` and `registerGeneratedPages`. |

## TypeScript

| Option | Value |
| --- | --- |
| `target` | `ES2022` or newer |
| `experimentalDecorators` | `false` (standard decorators) |
| `useDefineForClassFields` | `true` |
