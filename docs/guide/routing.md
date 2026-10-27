# Routing

The `Router` maps URLs to pages, renders the right layout chain and page, checks
authentication and keeps the browser history in sync. You configure it by subclassing it and
returning an instance from the App's `routerGenerator()`.

## Configuring the router

```typescript title="src/app/router.ts"
import { Router } from "joltui";
import type MyApp from "./app.js";

export default class MyRouter extends Router<MyApp> {}
```

```typescript title="src/app/app.ts"
protected override routerGenerator(): MyRouter {
    return new MyRouter({
        app: this,
        baseLayout: MainLayout,
        defaultTarget: "#page",
    });
}
```

| Option | Meaning |
| --- | --- |
| `app` | The application instance. Required. |
| `baseLayout` | The default layout class (must use `@layout`). Required. |
| `defaultTarget` | Selector of the element inside the layout that receives the page. Required. |
| `pages` | Array of page classes. Optional when the [Vite plugin](vite-plugin.md) supplies them. |
| `baseUrl` | Prefix for every page path; may contain parameters. |
| `indexRoute` | Path used when the location has no path at all (default `/`). |

When the router is constructed it reads the metadata of every page and validates it: each page
must use `@page`, each layout `@layout`, and each must be registered with its decorated class.
It then builds a sorted route table. Invalid configuration therefore fails at startup rather than
on the first visit to a page.

### Supplying pages manually

Without the Vite plugin, list the pages explicitly:

```typescript
import AboutPage from "./pages/aboutPage.js";
import HomePage from "./pages/homePage.js";
import PostPage from "./pages/postPage.js";

const pages = [HomePage, PostPage, AboutPage] as const;

return new MyRouter({
    app: this,
    pages,
    baseLayout: MainLayout,
    defaultTarget: "#page",
});
```

## Declaring pages

`@page` accepts either a path or a configuration object:

```typescript
@page("/about")

@page({
    path: "/posts/<int:postId>",
    title: "Story",
    layout: ReadingLayout,      // instead of the base layout
    target: "#article",         // instead of the default target
    subLayouts: [],             // see Layouts
    extras: { breadcrumb: "Stories" },
})
```

| Option | Meaning |
| --- | --- |
| `path` | URL pattern; must start with `/`. |
| `title` | Document title (passed through `titleGenerator`). |
| `layout` | Layout class for this page; defaults to the router's base layout. |
| `target` | Selector receiving the page; defaults to `defaultTarget`. |
| `subLayouts` | Ordered chain of nested layouts ([Layouts](layouts.md#sublayout-chains)). |
| `extras` | Free-form metadata, available as `router.currentRoute.extras`. |

## Route parameters

Path segments written as `<type:name>` are parameters:

| Pattern | Matches | Value |
| --- | --- | --- |
| `<str:slug>` | any single segment | decoded string |
| `<int:id>` | digits only | number |

```typescript
@page({ path: "/users/<int:userId>/posts/<str:slug>", title: "Post" })
@component({ tagName: "user-post-page" })
export default class UserPostPage extends CustomElement<MyApp> {
    get userId(): number {
        return this.app.router.routeParameters.userId as number;
    }

    get slug(): string {
        return this.app.router.routeParameters.slug as string;
    }

    override markup = () => html`
        <h1>Post {{! this.slug }} by user {{= this.userId }}</h1>
    `;
}
```

The parameters are also available as `app.currentRouteParameters`. They are published only after
authorization succeeds, and before any of the route's components start initializing, so
`BEFORE_INIT` hooks and `markup()` can rely on them.

Paths are normalized before matching: repeated slashes are collapsed and a trailing slash is
removed, so `/users//42/` matches `/users/<int:userId>`.

### Which route wins?

When several patterns could match, the router prefers the most specific one. It compares, in
order:

1. more literal segments;
2. fewer parameters;
3. more `int` parameters than `str` parameters;
4. segment by segment, literal before `int` before `str`;
5. declaration order.

```typescript
@page("/posts/new")           // 1st: two literal segments
@page("/posts/<int:id>")      // 2nd: int is more specific than str
@page("/posts/<str:slug>")    // 3rd
```

`/posts/new` opens the editor, `/posts/42` the post with id 42 and `/posts/hello-world` the slug
lookup. Two pages with the same path are a configuration error.

## Navigating

### Links

The router intercepts clicks on `<a>` elements inside the app container and navigates without
reloading, provided that:

- the link points to the **same origin**;
- it is a plain **left click** without Ctrl, Meta, Shift or Alt;
- the event was not already cancelled (`preventDefault`);
- the link has no `target="_blank"`, no `download` and no `router-ignore` attribute, and is not a
  `mailto:` or `tel:` link.

```html
<a href="/posts/42">Read the story</a>              <!-- router -->
<a href="/legacy/report" router-ignore>Report</a>   <!-- full page load -->
<a href="/files/report.pdf" download>PDF</a>        <!-- browser -->
```

### Programmatic navigation

```typescript
await this.app.router.redirect("/posts/42");
await this.app.router.redirect(`/login?target=${encodeURIComponent(path)}`);
```

`redirect()` pushes a history entry and resolves when the new page has rendered (or the
navigation failed and the error handlers have run).

### Back and Forward

The router listens to `popstate`, routes the restored URL and restores the scroll position
recorded when the user left that entry.

### Overlapping navigations

When a navigation starts while another is still running (for example while an authentication
check or a slow page is pending), the **latest navigation wins**:

- the older navigation stops waiting at its next step and cannot commit its page, title, route
  parameters or current route;
- elements it had already created are removed, which aborts their lifetime signals
  ([Cancellation](cancellation.md));
- layouts from a *completed* navigation are kept and reused.

Asynchronous work that your own hooks started (a slow `isAuthenticated`, a `titleGenerator`
call) may still finish in the background; the router ignores its result. Application-owned side
effects within those hooks must be managed by the application.

## Route events

The router dispatches three bubbling events on the app container:

| Constant | Event name | When |
| --- | --- | --- |
| `routeEventsEnum.START` | `route-change.start` | rendering of a route begins |
| `routeEventsEnum.LAYOUT_CHANGE_FINISHED` | `route-change.layout-change.finished` | a *new* base layout has been rendered |
| `routeEventsEnum.FINISHED` | `route-change.finished` | the page has rendered and the title is set |

A layout can use them to highlight the active navigation link:

```typescript
import { Lifecycle, lifecycle, routeEventsEnum } from "joltui";

@lifecycle(Lifecycle.AFTER_INIT)
trackActiveLink(): void {
    this.app.addEventListener(
        routeEventsEnum.FINISHED,
        () => this.markActiveLink(),
        { signal: this.abortSignal },
    );
}

markActiveLink(): void {
    for (const link of this.querySelectorAll<HTMLAnchorElement>("nav a")) {
        link.classList.toggle("active", this.app.router.urlIsCurrentPath(link.href));
    }
}
```

`urlIsCurrentPath(href)` compares the normalized path of `href` with the current route.

## Document titles

After a page has rendered, the router sets `document.title`. By default it uses the page's
`title`. Override `titleGenerator(tagName, title)` to compute titles, for example to translate
keys:

```typescript
const translations = new Map([
    ["pages.stories", "True Stories"],
    ["pages.about", "About"],
]);

export default class MyRouter extends Router<MyApp> {
    override titleGenerator(tagName: string, title: string | null): string {
        if (!title) return this.app.appName;
        return translations.get(title) ?? title;
    }
}
```

`titleGenerator` may also return a promise. If it returns an empty value the original `title` is
used, and if that is empty too the title is left unchanged. The special title `"_default"` sets
the document title to the application name. `router.setTitle(text)` sets a title directly.

## Inspecting the current route

| Member | Description |
| --- | --- |
| `currentRoute` | The matched route: `path`, `pattern`, `parameters`, `title`, `extras`, `handler`, `layout`, `subLayouts`, … (`null` while an error page is shown) |
| `routeParameters` | Parameters of the current route |
| `queryParameters` | Same as `app.queryParameters` |
| `routes`, `routesMap` | The route table |
| `baseLayout`, `defaultTarget`, `baseUrl`, `indexRoute` | Configuration |

```typescript
const breadcrumb = this.app.router.currentRoute?.extras.breadcrumb;
```

## Base URLs

An application often lives below a fixed prefix, sometimes one that itself contains parameters
such as a tenant or a language. `baseUrl` prefixes every page path and supports the same
`<str:…>` and `<int:…>` parameters:

```typescript
return new MyRouter({
    app: this,
    baseLayout: MainLayout,
    defaultTarget: "#page",
    baseUrl: "/portal/<str:tenant>/<str:language>",
});
```

```typescript
@page("/search")     // registered as /portal/<str:tenant>/<str:language>/search
```

Base parameters appear in `routeParameters` next to the page's own. Links in templates must
contain the full URL:

```html
<a href="/portal/{{= this.app.router.routeParameters.tenant }}/en/search">Search</a>
```

`redirect()` can build the prefix for you. With `useBaseUrl: true`, the base URL is prepended and
its parameters are filled from the current route, optionally overridden:

```typescript
// stay in the current tenant and language
await this.app.router.redirect("/search", { useBaseUrl: true });

// switch language
await this.app.router.redirect("/search", {
    useBaseUrl: true,
    baseParameters: { language: "sl" },
});
```

A missing, empty or (for `int`) non-integer base parameter throws a `RouteParametersError`.
Without `useBaseUrl` the path is used exactly as given.

## When no route matches

An unknown path raises a `RouteNotFoundError`, which goes to the error handlers like any other
error. The usual response is to render a *not found* component in place without changing the
URL with [`router.showErrorPage()`](error-handling.md#error-pages).
