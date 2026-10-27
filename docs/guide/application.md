# Application

The `App` class is the root of every JoltUI application. You never use it directly: you extend
it, configure it through its constructor and override the methods that customise it.

## Defining the application class

```typescript title="src/app/app.ts"
import {
    App,
    Lifecycle,
    lifecycle,
    type AppConfig,
    type ErrorHandlerClass,
} from "joltui";
import MainLayout from "./layouts/mainLayout.js";
import MyRouter from "./router.js";
import MyErrorHandler from "./errorHandler.js";
import type { User } from "./types.js";

export default class MyApp extends App<MyApp> {
    override readonly errorHandlers:
        readonly ErrorHandlerClass<MyApp>[] = [MyErrorHandler];

    constructor(config: AppConfig<MyApp>) {
        super(config);
    }

    protected override routerGenerator(): MyRouter {
        return new MyRouter({
            app: this,
            baseLayout: MainLayout,
            defaultTarget: "#page",
        });
    }

    get user(): User | null {
        return this.getData<User | null>("user");
    }

    @lifecycle(Lifecycle.BEFORE_INIT)
    async loadSession(): Promise<void> {
        const response = await fetch("/api/session");
        if (response.ok) {
            this.setData("user", await response.json());
        }
    }
}
```

The generic parameter is the class itself: `App<MyApp>`. Every component declared as
`CustomElement<MyApp>` and every `Router<MyApp>` or `ErrorHandler<MyApp>` then sees `this.app`
as a `MyApp`, including your own additions such as the `user` getter above.

## Configuration

The constructor takes an `AppConfig` object:

| Option | Default | Meaning |
| --- | --- | --- |
| `appName` | *(required)* | Non-empty application name; also used by `router.setTitle("_default")`. |
| `dataStructure` | `{}` | Declares the shared data fields and their initial values. |
| `serverComponentsUrl` | `null` | Endpoint for [server-rendered components](server-components.md). |
| `container` | `null` | Container element, if not passed to `init()`. |
| `templatesCacheDuration` | `300` | Default [template-cache](template-caching.md) lifetime in seconds. |
| `templatesCacheCleanupInterval` | `60` | Seconds between automatic cache cleanups; `0` disables them. |

```typescript title="src/main.ts"
const app = new MyApp({
    appName: "Fieldnotes",
    dataStructure: {
        posts: [],
        user: null,
    },
    templatesCacheDuration: 180,
    serverComponentsUrl: "/api/components",
});

await app.init("#app");
```

`init(target?)` accepts a CSS selector or an element. It throws when neither `target` nor
`container` identifies an existing element.

## Shared application data

`dataStructure` declares the **fields** of the application's shared state. Only declared fields
can be read or written:

```typescript
const posts = app.getData<Post[]>("posts");
app.setData("posts", [...posts, newPost]);

app.getData("unknown"); // Error: Data field 'unknown' does not exist.
```

Every `setData()` call dispatches an `app-data-change` event on the container, with the field
name in `event.detail.field`. The event is dispatched even if the new value equals the old one.
Components react to it in two ways:

- regions marked `data-bind="app.<field>"` re-render ([Reactivity](reactivity.md));
- components whose `@component` configuration names the field as `dataField` re-render
  completely.

You can also listen yourself:

```typescript
import { dataEventEnum } from "joltui";

app.addEventListener(dataEventEnum.CHANGE, event => {
    console.log("changed:", event.detail.field);
});
```

!!! tip "Replace values instead of mutating them"

    `setData` stores whatever you give it. Mutating an array returned by `getData` changes the
    stored value but notifies nobody. Build a new value and pass it to `setData`.

Components have shortcuts for the same operations: `this.getData()`, `this.setData()` and the
read-only `this.data` map.

## Query parameters

The App is the gateway to the URL's query string:

```typescript
const page = app.queryParameters.page ?? "1";
```

`queryParameters` returns a plain `Record<string, string>`. Change parameters through the App,
not through `history` directly, so that bound markup is notified:

```typescript
// Merge: set or replace individual parameters; null removes one
app.updateQueryParameters({ page: 2, filter: "active" });
app.updateQueryParameters({ filter: null });

// Replace the entire query string
app.queryParameters = { page: "1", sort: "name" };
app.setQueryParameters({ page: "1", sort: "name" }); // same thing
```

Both forms compare the old and new parameters. If anything changed, they push a new history
entry and dispatch one `query-parameter-change` event per changed parameter. Markup bound to
`query.<name>` then refreshes.

`createQueryParametersString(params, exclude?)` builds an encoded query string, optionally
leaving some keys out:

```typescript
app.createQueryParametersString({ page: 2, q: "web components" });
// "page=2&q=web+components"
```

## Lifecycle hooks on the App

| Stage | When it runs |
| --- | --- |
| `BEFORE_INIT` | After the DOM is patched and error handlers exist, before the router is created. Load session data, configuration or translations here. |
| `EXTENSION_INIT` | Immediately after `BEFORE_INIT`. Intended for setting up extensions and integrations. |
| `AFTER_INIT` | After the first route and all top-level components have initialized. |

```typescript
@lifecycle(Lifecycle.AFTER_INIT)
reportStartup(): void {
    console.info(`${this.appName} ready at ${this.pathname}`);
}
```

## Scoped DOM helpers

Several DOM methods on the App operate on the container rather than the whole document, which
keeps application code from reaching outside its own element:

| Member | Delegates to |
| --- | --- |
| `querySelector`, `querySelectorAll` | `container.querySelector*` |
| `getElementById(id)` | `container.querySelector("#id")` |
| `getElementsByClassName`, `getElementsByTagName` | the container |
| `matches(selector)` | `container.matches` |
| `children`, `childNodes` | the container |
| `insertAdjacentHTML` | the container |
| `addEventListener`, `removeEventListener` | the container |

## Other members

| Member | Description |
| --- | --- |
| `router` | The router instance; throws if none was created. |
| `container` | The container element. |
| `appName` | The configured name. |
| `currentRouteParameters` | Parameters of the current route (`{}` before routing). |
| `generateHash(length = 16)` | Random hexadecimal string of `length` bytes (`2 * length` characters). |
| `pathname`, `hash`, `host`, `hostname`, `port`, `origin` | Shortcuts to `location`. |
| `handleError(error)` | Offers an error to the error handlers; rethrows if unhandled. |
| `handleErrorOnce(error)` | Same, but each error object is handled at most once. |
| `clearTemplatesCache()` and related | [Template-cache](template-caching.md) management. |

The complete member list is in the [App reference](../reference/app.md).
