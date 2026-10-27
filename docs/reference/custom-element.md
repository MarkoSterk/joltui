# CustomElement

`class CustomElement<TApp extends App<TApp>> extends HTMLElement`: base class of every component,
layout and page. See [Components](../guide/components.md).

## Members you override

| Member | Description |
| --- | --- |
| `markup: () => string \| Promise<string>` | Template source. Optional (server or prerendered markup otherwise). |
| `static dependencies: readonly LazyDependency[]` | [Lazy dependencies](../guide/lazy-dependencies.md) loaded before `BEFORE_INIT`. |
| `templateCacheKey(request?): string` | Custom [cache key](../guide/template-caching.md#cache-keys). |
| `fetchHTML` | Server-component request ([customising](../guide/server-components.md#customising-the-request)). |

## Context

| Member | Description |
| --- | --- |
| `app` | The application instance, typed as `TApp`. |
| `args` | Arguments from `data-jolt-*` / `:` attributes, JSON-parsed when possible. |
| `parent` | Nearest enclosing JoltUI component, or `null`. |
| `hashId` | Unique instance id (also `data-hash-id`). |
| `metadata` | Decorator metadata. |
| `dataField`, `groupName`, `useServer`, `cache`, `cacheDuration` | Values from `@component`. |
| `getData(field)`, `setData(field, value)`, `data` | Shortcuts to the App's shared data. |

## Rendering

| Member | Description |
| --- | --- |
| `render(signal?)` | Render the component (used during initialization). |
| `rerender()` | Full re-render with `BEFORE_RERENDER` / `AFTER_RERENDER` hooks. |
| `invalidate(bindingName)` | Refresh every region bound to `bindingName`. |
| `lastRender` | Timestamp of the last render. |

## Initialization and lifetime

| Member | Description |
| --- | --- |
| `initComplete` | Promise resolved when initialization succeeds. |
| `initializationState` | `"pending"`, `"fulfilled"` or `"rejected"`. |
| `initializationError` | The failure, if rejected. |
| `initElement()` | Run initialization (called by `connectedCallback`). |
| `abortSignal` | Aborted when the element is disconnected. |

## Server components

| Member | Description |
| --- | --- |
| `fetchHTML(request, options?)` | Fetch markup from `serverComponentsUrl`. |
| `prefetchHTML(request, options?)` | Load a server template into the cache ahead of time. |

## Static members

| Member | Description |
| --- | --- |
| `tagName` | Registered tag name. |
| `generate(hashId?, args?)` | The element's tag as an HTML string, with escaped arguments. |
| `dependencies` | Lazy dependencies. |

!!! danger "Reserved names"

    Do not declare handlers or properties with the names above, or with names of `HTMLElement`
    members such as `remove`, `click`, `focus`, `append`, `close`, `title`, `hidden` or `dir`.
