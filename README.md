# JoltUI

JoltUI is a small TypeScript framework for building single-page applications with browser-native custom elements. It combines declarative decorators, layouts and pages, doT-style HTML templates, reactive partial updates, lifecycle hooks, authentication, centralized error handling, optional server-rendered components, and opt-in template caching.

JoltUI does not require a virtual DOM. Components extend `HTMLElement`, are registered with the browser's Custom Elements API, and render directly into the application container.

## Requirements

- A modern browser with Custom Elements and the History API
- TypeScript 5 with standard decorators enabled
- An ES module build tool such as Vite

## Installation

Install the package from its package source:

```bash
npm install joltui
```

For development inside this repository:

```bash
npm install
npm run dev
```

Useful project commands:

```bash
npm run typecheck
npm run build
npm run dev:build
```

## Quick start

Add an application container to the page:

```html
<div id="app"></div>
```

Create a layout containing the router's target:

```ts
import {
    CustomElement,
    component,
    html,
    layout,
} from "joltui";

@layout
@component({ tagName: "main-layout" })
export class MainLayout extends CustomElement {
    override markup = () => html`
        <header>
            <nav>
                <a href="/">Home</a>
                <a href="/users/42">User</a>
            </nav>
        </header>

        <main id="page"></main>
    `;
}
```

Create a page:

```ts
import {
    CustomElement,
    component,
    html,
    page,
} from "joltui";

@page({ path: "/", title: "Home" })
@component({ tagName: "home-page" })
export class HomePage extends CustomElement {
    override markup = () => html`
        <section>
            <h1>Hello from JoltUI</h1>
        </section>
    `;
}
```

Create the router and application:

```ts
import {
    App,
    Router,
    type CustomElementClass,
} from "joltui";

import { HomePage } from "./homePage.js";
import { MainLayout } from "./mainLayout.js";

class ApplicationRouter extends Router<Application> {}

class Application extends App<Application> {
    override readonly elements:
        readonly CustomElementClass<Application>[] = [
            MainLayout,
            HomePage,
        ];

    protected override routerGenerator() {
        return new ApplicationRouter({
            app: this,
            baseLayout: MainLayout,
            defaultTarget: "#page",
        });
    }
}

const app = new Application({
    appName: "Example application",
});

await app.init("#app");
```

All decorated components and layouts used by the application must be included in `app.elements`.

## Components

A component is a custom element decorated with `@component`:

```ts
@component({ tagName: "user-card" })
class UserCard extends CustomElement {
    override markup = () => html`
        <article>
            <h2>User</h2>
        </article>
    `;
}
```

Custom-element tag names must contain a hyphen. Component configuration supports:

```ts
@component({
    tagName: "user-card",
    dataField: "user",
    groupName: "account",
    useServer: false,
    cache: true,
    cacheDuration: 120,
})
```

- `tagName` is the registered custom-element name.
- `dataField` rerenders the whole component when that application data field changes.
- `groupName` is sent when requesting server-rendered markup.
- `useServer` loads markup from `serverComponentsUrl` instead of calling `markup`.
- `cache` explicitly enables template caching for the component.
- `cacheDuration` overrides the application cache duration in seconds.

## Templates and events

The `html` helper preserves a template literal as a string. JoltUI then evaluates doT expressions such as `{{= ... }}` using the component instance as `this`.

```ts
@component({ tagName: "counter-button" })
class CounterButton extends CustomElement {
    count = 0;

    override markup = () => html`
        <p>Count: {{= this.count }}</p>
        <button type="button" @click="increment">
            Increment
        </button>
    `;

    increment(): void {
        this.count++;
        void this.rerender();
    }
}
```

Event attributes written as `@click="methodName"` are connected to methods on the component. The equivalent expanded form is `jolt-click="methodName"`.

## Application data and partial updates

Initialize shared data in the application constructor:

```ts
const app = new Application({
    appName: "Example application",
    dataStructure: {
        user: null,
        count: 0,
    },
});
```

Read and update it through the application interface:

```ts
const count = this.app.getData<number>("count");
this.app.setData("count", count + 1);
```

Use `data-bind="app.<field>"` to reevaluate only part of a component when the field changes:

```ts
override markup = () => html`
    <p data-bind="app.count">
        Count: {{= this.app.getData("count") }}
    </p>
`;
```

Use `@react` for component-local state. The binding name defaults to the accessor name:

```ts
import { react } from "joltui";

@react(0)
accessor count!: number;

override markup = () => html`
    <p data-bind="count">Count: {{= this.count }}</p>
`;
```

`@reactFactory` provides a fresh initial value for each instance and is useful for arrays and objects.

## Query parameters

Query parameters must be changed through the application API when bound markup should update:

```ts
this.app.updateQueryParameters({
    page: 2,
    filter: "active",
});
```

Pass `null` to remove a parameter:

```ts
this.app.updateQueryParameters({ filter: null });
```

Replace the complete query string through the setter:

```ts
this.app.queryParameters = {
    page: "1",
    sort: "name",
};
```

Markup can react to an individual parameter:

```ts
override markup = () => html`
    <div data-bind="query.page">
        Current page: {{= this.app.queryParameters.page ?? "1" }}
    </div>
`;
```

The `@queryParam` accessor decorator can expose a parameter as a component property. Supplying `query.page` as the binding name connects it to the same partial-update convention:

```ts
import { queryParam } from "joltui";

@queryParam("page", "1", "query.page")
accessor page!: string;
```

Setting `this.page` updates the browser URL through the application interface.

## Routing and pages

Pages are components with an additional `@page` decorator:

```ts
@page({
    path: "/users/<int:userId>",
    title: "User",
})
@component({ tagName: "user-page" })
class UserPage extends CustomElement<Application> {
    override markup = () => html`
        <h1>
            User {{= this.app.router.routeParameters.userId }}
        </h1>
    `;
}
```

Supported route parameters are:

- `<str:name>` for a string segment
- `<int:name>` for an integer segment

Navigate programmatically with:

```ts
await this.app.router.redirect("/users/42");
```

Same-origin links are intercepted automatically. Add `router-ignore` when a link should use normal browser navigation:

```html
<a href="/server-page" router-ignore>Server page</a>
```

A page can select a different layout or target:

```ts
@page({
    path: "/login",
    title: "Sign in",
    layout: LoginLayout,
    target: "#login-content",
})
```

JoltUI currently renders one page handler per route; it does not provide nested route definitions.

### Base URL patterns

`baseUrl` prefixes every `@page` path. It can be a static path or contain the same typed parameters as a page route:

```ts
return new ApplicationRouter({
    app: this,
    baseLayout: MainLayout,
    defaultTarget: "#page",
    baseUrl: "/ecris/<str:system>/<str:language>",
});
```

With that configuration:

```ts
@page("/search")
```

is registered internally as:

```text
/ecris/<str:system>/<str:language>/search
```

The base parameters are available alongside page parameters through `router.routeParameters`.

Navigation links should contain the complete URL explicitly:

```html
<a href="/ecris/research/en/search">Search</a>
```

Programmatic redirects can optionally prepend and expand the base URL:

```ts
await this.app.router.redirect("/search", {
    useBaseUrl: true,
});
```

Base parameter values default to the current route parameters. They can be supplied or overridden explicitly:

```ts
await this.app.router.redirect("/search", {
    useBaseUrl: true,
    baseParameters: {
        system: "research",
        language: "sl",
    },
});
```

The redirect throws a `RouteParametersError` when a required base parameter is missing, empty, or invalid. Setting `useBaseUrl` to `false`, or omitting the options object, preserves the redirect path exactly as supplied.

## Authentication and authorization

Apply `@auth()` to require authentication, or provide roles:

```ts
import { auth } from "joltui";

@auth(["ADMIN"])
@page("/admin")
@component({ tagName: "admin-page" })
class AdminPage extends CustomElement {}
```

Implement the checks in a router subclass:

```ts
class ApplicationRouter extends Router<Application> {
    override isAuthenticated = async (): Promise<boolean> => {
        return this.app.getData("user") !== null;
    };

    override checkUserRoles = async (
        requiredRoles: unknown[],
    ): Promise<boolean> => {
        const user = this.app.getData<{
            roles: string[];
        }>("user");

        return requiredRoles.some(role =>
            user.roles.includes(String(role)),
        );
    };
}
```

Authentication and authorization failures are passed to the application's error handlers.

## Error handling

Extend `ErrorHandler` and decorate methods with `@handles`:

```ts
import {
    AuthenticationError,
    ErrorHandler,
    handles,
} from "joltui";

class ApplicationErrorHandler
    extends ErrorHandler<Application> {

    @handles(AuthenticationError)
    async handleAuthentication(): Promise<void> {
        await this.app.router.redirect("/login");
    }
}
```

Register the handler on the application:

```ts
class Application extends App<Application> {
    override readonly errorHandlers = [
        ApplicationErrorHandler,
    ];
}
```

Handlers are checked in registration order. If no handler accepts an error, the error is rethrown.

## Lifecycle hooks

Use `@lifecycle` on application or component methods:

```ts
import {
    Lifecycle,
    lifecycle,
} from "joltui";

@lifecycle(Lifecycle.BEFORE_INIT)
async loadData(): Promise<void> {
    // Runs before initial rendering completes.
}

@lifecycle(Lifecycle.AFTER_RERENDER)
afterRerender(): void {
    // Runs after a component rerender.
}
```

Available stages are:

- `EXTENSION_INIT`
- `BEFORE_INIT`
- `BEFORE_INIT_RESOLVE`
- `AFTER_INIT`
- `BEFORE_RERENDER`
- `AFTER_RERENDER`
- `AFTER_DISCONNECT`

Multiple methods may subscribe to the same stage and are awaited in registration order.

## Selecting elements

`@select` and `@selectAll` expose descendants through read-only accessors:

```ts
import { select, selectAll } from "joltui";

@select<HTMLInputElement>("#email", { required: true })
accessor emailInput!: HTMLInputElement;

@selectAll<HTMLButtonElement>("button")
accessor buttons!: NodeListOf<HTMLButtonElement>;
```

Required selections throw when no matching element is found.

## Server-rendered components

Configure the endpoint on the application and opt a component into server rendering:

```ts
const app = new Application({
    appName: "Example application",
    serverComponentsUrl: "/api/components",
});

@component({
    tagName: "account-summary",
    groupName: "account",
    useServer: true,
})
class AccountSummary extends CustomElement {}
```

JoltUI sends a JSON `POST` request containing:

```ts
{
    tagName: "account-summary",
    groupName: "account",
    routeParameters: { /* current route parameters */ },
    queryParameters: { /* current query parameters */ },
    attributes: {/* custom attributes (prefix: data-jolt-*) on the current element  */}
}
```

Override `fetchHTML(request)` when custom request behavior is required.

## JSON requests

`RequestHelper` provides typed wrappers around the common HTTP methods. It accepts the same input and initialization options as `fetch`, except that the HTTP method is selected by the helper method:

```ts
import { RequestHelper } from "joltui";

type User = {
    id: number;
    name: string;
};

const user = await RequestHelper.get<User>(
    "/api/users/42",
    {
        headers: {
            Accept: "application/json",
        },
    },
);
```

Request bodies remain caller-controlled:

```ts
const createdUser = await RequestHelper.post<User>(
    "/api/users",
    {
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            name: "Ada",
        }),
    },
);
```

Available methods are `get`, `post`, `put`, `patch`, and `delete`. All successful responses are parsed as JSON. Failures are represented by:

- `NetworkError` when `fetch` cannot complete the request
- `HttpRequestError` when the server returns a non-success status
- `JsonResponseError` when a successful response is not valid JSON

Successful responses with an empty body, including `204 No Content`, return `null`. Include `null` in the response type when an endpoint may omit its body:

```ts
const result = await RequestHelper.delete<
    { deleted: boolean } | null
>("/api/users/42");
```

## Template caching

Caching is opt-in for each component:

```ts
@component({
    tagName: "catalog-results",
    cache: true,
    cacheDuration: 120,
})
class CatalogResults extends CustomElement {}
```

If `cacheDuration` is omitted, the application-wide duration is used. A duration of `0` disables caching.

```ts
const app = new Application({
    appName: "Example application",
    templatesCacheDuration: 300,
    templatesCacheCleanupInterval: 60,
});
```

The default key is deterministic and includes the component tag, route parameters, query parameters, component arguments, and application data. Concurrent requests for the same key share one in-flight operation.

Override `templateCacheKey()` when additional context controls the rendered template:

```ts
override templateCacheKey(): string {
    const locale = this.app.getData<string>("locale");
    return `catalog:${locale}:${this.args.categoryId}`;
}
```

An override must always return a non-empty string. When writing a custom key, include every value that can change the resulting markup, such as the current user, locale, permissions, or component-local state.

The cleanup interval is expressed in seconds and can be changed at runtime:

```ts
app.templatesCacheCleanupInterval = 30;
```

Set it to `0` to disable automatic cleanup. Clean expired entries manually with:

```ts
const removedEntries = app.cleanTemplatesCache();
```

Cache entries are also removed lazily when an expired key is requested.

## Notes

- JoltUI modifies selected DOM prototype methods during application initialization to support template evaluation, JoltUI attributes, scoped selectors, and hydration. Initialize one application deliberately and test integration with other libraries that patch the DOM.
- Use application methods for shared data and query-parameter changes so bound markup receives change notifications.
- Cache only markup whose complete rendering context is represented by its cache key.
- Decorator order matters: `@component` must be the decorator closest to the class, with `@page`, `@layout`, and `@auth` above it as shown in the examples.

## License

ISC
