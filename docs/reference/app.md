# App

`class App<TApp extends App<TApp>>`: the application root. Extend it; see
[Application](../guide/application.md).

## Overridable members

| Member | Description |
| --- | --- |
| `protected routerGenerator(): Router<TApp> \| null` | Creates the router. Returns `null` by default ([without a router](../guide/without-a-router.md)). |
| `readonly errorHandlers: readonly ErrorHandlerClass<TApp>[]` | Error handler classes, checked in order. |

## Initialization

| Member | Description |
| --- | --- |
| `constructor(config: AppConfig<TApp>)` | See [`AppConfig`](configuration.md#appconfig). |
| `init(target?: string \| Element): Promise<void>` | Sets up the container, patches the DOM, runs hooks, creates the router and renders the first route. |

## Shared data

| Member | Description |
| --- | --- |
| `getData<T>(field)` | Value of a declared data field; throws for unknown fields. |
| `setData(field, value)` | Stores a value and dispatches `app-data-change`. |
| `data` | Read-only `Map` of all fields. |

## Query parameters

| Member | Description |
| --- | --- |
| `queryParameters` (get) | Current parameters as `Record<string, string>`. |
| `queryParameters` (set), `setQueryParameters(params)` | Replace the query string. |
| `updateQueryParameters(params)` | Merge parameters; `null` removes one. |
| `createQueryParametersString(params, exclude?)` | Encoded query string. |

## Routing and location

| Member | Description |
| --- | --- |
| `router` | The router; throws if none was created. |
| `currentRouteParameters` | Parameters of the current route. |
| `pathname`, `hash`, `host`, `hostname`, `port`, `origin` | Shortcuts to `location`. |

## Errors

| Member | Description |
| --- | --- |
| `handleError(error)` | Offers an error to the handlers; rethrows if none handles it. |
| `handleErrorOnce(error)` | Same, but each error object is handled at most once. |

## Template cache

| Member | Description |
| --- | --- |
| `templatesCacheDuration` (get/set) | Default lifetime in seconds. |
| `templatesCacheCleanupInterval` (get/set) | Seconds between automatic cleanups; `0` = off. |
| `clearTemplatesCache()` | Remove every entry. |
| `cleanTemplatesCache(): number` | Remove expired entries; returns how many were removed. |
| `removeCachedTemplate(key): boolean` | Remove one entry. |
| `getCachedTemplate(key)`, `setCachedTemplate(key, template, duration)` | Low-level access. |
| `getOrSetCachedTemplate(key, duration, factory)` | Shared, de-duplicated cache fill. |
| `getTemplateCacheKey(tagName, args?)`, `getServerComponentCacheKey(request)` | Default key builders. |

## Container and DOM

| Member | Description |
| --- | --- |
| `container` | The container element (`AppContainer`). |
| `appName` | The configured name. |
| `serverComponentsUrl` (get/set) | Server-components endpoint. |
| `querySelector`, `querySelectorAll`, `getElementById`, `getElementsByClassName`, `getElementsByTagName`, `matches` | Scoped to the container. |
| `children`, `childNodes`, `insertAdjacentHTML` | Delegated to the container. |
| `addEventListener`, `removeEventListener` | On the container; typed for `app-data-change` and `query-parameter-change`. |
| `generateHash(length = 16)` | Random hexadecimal string (`2 * length` characters). |
