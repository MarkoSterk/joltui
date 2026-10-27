# Router

`class Router<TApp extends App<TApp>>`: see [Routing](../guide/routing.md).

## Members you override

| Member | Description |
| --- | --- |
| `isAuthenticated(): boolean \| Promise<boolean>` | Required when any page or layout uses `@auth`. Throws `NotImplementedError` by default. |
| `checkUserRoles(roles): boolean \| Promise<boolean>` | Required when `@auth` lists roles. Throws `NotImplementedError` by default. |
| `titleGenerator(tagName, title): string \| Promise<string>` | Computes document titles. |

## Navigation

| Member | Description |
| --- | --- |
| `redirect(path, options?)` | Push a history entry and render the route. See [`RedirectOptions`](configuration.md#redirectoptions). |
| `showErrorPage(Component, options?)` | Render a component as an error page without changing the URL. See [`ErrorPageOptions`](configuration.md#errorpageoptions). |
| `route()` | Route the current location. |
| `setTitle(title)` | Set the document title (`"_default"` = application name). |
| `urlIsCurrentPath(href)` | Whether `href` points to the current route. |

## State

| Member | Description |
| --- | --- |
| `currentRoute` | The matched route, or `null` while an error page is shown. |
| `routeParameters` | Parameters of the current route. |
| `queryParameters` | Current query parameters. |
| `routes`, `routesMap` | The route table. |
| `pages` | Page classes the router was built from. |
| `baseLayout`, `defaultTarget`, `baseUrl`, `indexRoute` | Configuration. |
| `app` | The application. |
| `pathname`, `hash`, `host`, `hostname`, `port`, `origin` | Shortcuts to `location`. |

## `MatchedRoute`

| Field | Description |
| --- | --- |
| `path` | Normalized path. |
| `pattern` | The matched pattern, including `baseUrl`. |
| `parameters` | Parsed parameters. |
| `handler` | The page class. |
| `layout`, `target`, `subLayouts` | Layout chain. |
| `title`, `extras` | From `@page`. |
| `authentication`, `authenticationChain` | Requirements checked for the route. |

## Route events

| Constant | Event name |
| --- | --- |
| `routeEventsEnum.START` | `route-change.start` |
| `routeEventsEnum.LAYOUT_CHANGE_FINISHED` | `route-change.layout-change.finished` |
| `routeEventsEnum.FINISHED` | `route-change.finished` |

## Route parameters

| Pattern | Matches | Value |
| --- | --- | --- |
| `<str:name>` | any single segment | decoded string |
| `<int:name>` | digits only | number |

Specificity: more literal segments, then fewer parameters, then more `int` than `str`, then
segment by segment (literal, `int`, `str`), then declaration order.
