# Package exports

## Values

```typescript
import {
    // core
    App, CustomElement, Router, ErrorHandler, html,
    // decorators
    component, page, layout, auth, lifecycle, handles,
    react, reactFactory, queryParam, select, selectAll,
    // helpers and constants
    Lifecycle, lazy, dataEventEnum, routeEventsEnum,
    getElementMetadata, requireElementMetadata,
    getGeneratedPages, registerGeneratedPages,
    isElementCancellation,
    // errors
    ElementDisconnectedError, ElementInitializationError,
    RenderError, DotJSEngineError, MissingMarkupMethod,
    MethodExecutionError, AuthenticationError, AuthorizationError,
    NotImplementedError, RouteFailedError, RouteNotFoundError,
    RouteParametersError, UnsupportedRouteParameterType,
    NetworkError, HttpRequestError, InternalServerError, ServerComponentNotFound,
    ServerComponentBadRequestResponse, MarkupFetchError,
    DependencyLoadError,
} from "joltui";
```

| Export | Description |
| --- | --- |
| `App`, `CustomElement`, `Router`, `ErrorHandler` | Base classes. |
| `html` | Tagged template helper. |
| `Lifecycle` | Lifecycle stage constants. |
| `lazy(loader, name?)` | Declares a lazy dependency. |
| `dataEventEnum`, `routeEventsEnum` | Event name constants. |
| `getElementMetadata(Class)`, `requireElementMetadata(Class)` | Read decorator metadata (the second throws if absent). |
| `getGeneratedPages()`, `registerGeneratedPages(pages)` | Page registry used by the Vite plugin. |
| `isElementCancellation(error)` | Detects `ElementDisconnectedError` in an error or its causes. |

## Types

```typescript
import type {
    AppConfig, AppContainer, AppDataChangeDetail, AppDataChangeEvent,
    AppQueryChangeDetail, AppQueryChangeEvent, DataStructure,
    ErrorHandlerClass, ErrorHandlerMethod, ErrorConstructor,
    CustomElementClass, InitializationState,
    FetchHtmlRequest, ResolvedFetchHtmlRequest, FetchHtmlOptions, PrefetchHtmlOptions,
    ElementKind, ElementMetadata, ComponentConfigs, ComponentMetadata,
    PageConfigs, PageMetadata, LayoutMetadata, AuthenticationMetadata, SubLayoutConfig,
    RouterConfig, RedirectOptions, ErrorPageOptions,
    Route, RouteExtras, RouteParameters, ParsedRoute, MatchedRoute, HandlerArgs,
    Authentication, RouteAuthenticationRequirement,
    LazyDependency, LazyImportLoader,
} from "joltui";
```
