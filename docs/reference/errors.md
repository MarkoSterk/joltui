# Errors

All error classes are exported from `joltui` and can be used with `@handles`.

## Routing and authentication

| Error | Raised when |
| --- | --- |
| `RouteNotFoundError` | No route matches the path. |
| `RouteParametersError` | A base-URL parameter is missing or invalid, or route parameters cannot be parsed. |
| `UnsupportedRouteParameterType` | A pattern uses a type other than `str` or `int`. |
| `RouteFailedError` | A navigation started by a link click failed (cause: the failure). |
| `AuthenticationError` | `isAuthenticated()` returned `false`, or a server component answered `401`. Has `path`. |
| `AuthorizationError` | `checkUserRoles()` returned `false`, or a server component answered `403`. Has `path` and `roles`. |
| `NotImplementedError` | `isAuthenticated` / `checkUserRoles` were needed but not overridden. |

## Components

| Error | Raised when |
| --- | --- |
| `ElementInitializationError` | A component failed to initialize. Has `element`, `elementName`, `cause`. |
| `MethodExecutionError` | An event handler or lifecycle hook threw (cause: your error). |
| `RenderError` | `markup()` threw. |
| `MissingMarkupMethod` | A render was requested for a component without `markup`. |
| `DotJSEngineError` | A template could not be compiled or evaluated. |
| `DependencyLoadError` | A lazy dependency failed to load. Has `dependencyName`, `cause`. |
| `ElementDisconnectedError` | A component was removed while working. Cancellation; never sent to error handlers. |

## Server components

| Error | Raised when |
| --- | --- |
| `NetworkError` | The request could not be completed. |
| `ServerComponentBadRequestResponse` | The server answered `400`. |
| `ServerComponentNotFound` | The server answered `404`. |
| `InternalServerError` | The server answered `5xx`. |
| `HttpRequestError` | Any other non-success status. |
| `MarkupFetchError` | A `2xx` response was empty or unreadable. |

## Wrapping

| Source | Chain received by the handlers |
| --- | --- |
| Event handler | `MethodExecutionError` → your error |
| Lifecycle hook during initialization | `ElementInitializationError` → `MethodExecutionError` → your error |
| `markup()` during initialization | `ElementInitializationError` → `RenderError` → your error |
| Link-click navigation | `RouteFailedError` → the failure |

Handlers match exact types (walking up the class hierarchy), then `instanceof`, then the `cause`.
Use `isElementCancellation(error)` to recognise cancellation anywhere in a chain.
