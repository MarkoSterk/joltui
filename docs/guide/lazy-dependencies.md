# Lazy dependencies

Large applications should not download everything up front. A component can declare **lazy
dependencies**: modules imported on demand, right before the component initializes. Bundlers such
as Vite turn each dynamic `import()` into a separate chunk, so the code is fetched only when a
component that needs it actually appears.

## Declaring dependencies

Dependencies are listed in a static `dependencies` array, created with `lazy()`:

```typescript
import { CustomElement, component, html, lazy, page } from "joltui";

@page({ path: "/login", title: "Sign in", layout: AuthLayout })
@component({ tagName: "login-page" })
export default class LoginPage extends CustomElement<MyApp> {
    static override readonly dependencies = [
        lazy(() => import("../components/loginForm.js"), "login-form"),
    ] as const;

    override markup = () => html`
        <section class="login-panel">
            <h1>Welcome back</h1>
            <login-form data-caller-id="${this.hashId}"></login-form>
        </section>
    `;
}
```

Before running its `BEFORE_INIT` hooks, the component loads all of its dependencies in parallel
and waits for them. By the time the template renders, importing `loginForm.js` has registered
`<login-form>`, and the tag upgrades immediately.

| `lazy(loader, name?)` | Meaning |
| --- | --- |
| `loader` | A function returning a promise, normally `() => import("…")`. |
| `name` | Optional label used in error messages. |

## Behaviour

- **Loaded once.** A `lazy()` object remembers its pending or completed load. Every component that
  declares the same object shares one download.
- **Retried after failure.** If loading fails, the cached promise is discarded and the next attempt
  tries again. The failure is reported as a `DependencyLoadError` with the original error as
  `cause` and the given `dependencyName`, and the component's initialization fails with it.
- **Inherited.** Dependencies declared on base classes are loaded too, and an object declared at
  several levels is loaded only once.
- **Cancellable wait.** If the component is removed while its dependencies load, it stops waiting.
  The download itself completes and stays cached for the next component.

## Sharing and preloading

To share a dependency between components, define it once in a module:

```typescript title="src/app/dependencies.ts"
import { lazy } from "joltui";

export const chartWidget = lazy(
    () => import("./components/chartWidget.js"),
    "chart-widget",
);
```

```typescript
import { chartWidget } from "../dependencies.js";

@component({ tagName: "sales-report" })
export default class SalesReport extends CustomElement<MyApp> {
    static override readonly dependencies = [chartWidget] as const;
}
```

`preload()` starts the download ahead of time, for instance when the user hovers over a link that
leads to a page needing the chart:

```html
<a href="/reports/sales" @mouseenter="warmUp">Sales report</a>
```

```typescript
warmUp(): void {
    void chartWidget.preload();
}
```

## Prerendered markup needs registered children

A component without `markup` adopts the HTML it already contains
([Components](components.md#where-markup-comes-from)). If that HTML contains custom elements, they
must be registered before the host initializes. Declaring the child module as a lazy dependency
solves this without a static import:

```typescript
@component({ tagName: "product-gallery" })
export default class ProductGallery extends CustomElement<MyApp> {
    static override readonly dependencies = [
        lazy(() => import("./productTile.js"), "product-tile"),
    ] as const;
}
```

## Lazy dependencies and the Vite plugin

The [Vite plugin](vite-plugin.md) imports every page statically, so page modules are part of the
main bundle. Their lazy dependencies are still separate chunks. A good structure is therefore:
lightweight page classes that declare their heavier components and libraries as lazy
dependencies.
