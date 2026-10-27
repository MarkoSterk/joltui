---
title: JoltUI
description: A TypeScript framework for single-page applications built from browser-native Web Components.
---

<div class="jolt-hero" markdown>
![JoltUI logo](assets/joltui-logo.svg)
</div>

# JoltUI

**JoltUI** is a small TypeScript framework for building single-page applications out of
browser-native **Web Components**. Every building block (a button, a page, the layout around
it) is a genuine custom element registered with the browser's Custom Elements API. There is no
virtual DOM and no template compiler: components extend `HTMLElement`, render HTML strings into
themselves and update only the parts of the page that change.

```typescript
import { CustomElement, component, html, page, react } from "joltui";

@page({ path: "/", title: "Home" })
@component({ tagName: "home-page" })
export default class HomePage extends CustomElement {
    @react(0)
    accessor count!: number;

    override markup = () => html`
        <h1>Hello from JoltUI</h1>
        <p data-bind="count">Clicked {{= this.count }} times</p>
        <button type="button" @click="increment">Click me</button>
    `;

    increment(): void {
        this.count++;   // refreshes only the <p data-bind="count">
    }
}
```

## What is included

- **Declarative decorators** that turn classes into [components](guide/components.md),
  [pages](guide/routing.md) and [layouts](guide/layouts.md).
- A **[router](guide/routing.md)** with typed route parameters, layouts,
  [sublayout chains](guide/layouts.md#sublayout-chains), and
  [authentication and authorization](guide/authentication.md).
- **[doT-based templates](guide/templates.md)** with event binding, arguments and partial
  re-rendering through `data-bind` regions.
- **[Reactive properties](guide/reactivity.md)** for component state, application data and query
  parameters.
- **[Lifecycle hooks](guide/lifecycle.md)** that run at well-defined moments.
- **[Centralized error handling](guide/error-handling.md)** with handler classes and error
  chaining.
- **[Cooperative cancellation](guide/cancellation.md)**: work that belongs to a removed component
  or a superseded navigation stops cleanly.
- **[Lazy dependencies](guide/lazy-dependencies.md)**,
  **[server-rendered components](guide/server-components.md)** and an opt-in
  **[template cache](guide/template-caching.md)**.
- A **[Vite plugin](guide/vite-plugin.md)** that discovers pages at build time.

## Inspired by Java

JoltUI borrows its style from Spring, Jakarta EE and JAX-RS: annotations become decorators,
exceptions are handled centrally, errors carry their cause, lifecycle callbacks are annotated
methods, and the framework is extended by subclassing.

| JoltUI | Java analogue |
| --- | --- |
| `@component({ tagName })` | Spring `@Component` |
| `@page({ path })` | JAX-RS `@Path`, Spring `@GetMapping` |
| `@auth(["ADMIN"])` | `@RolesAllowed`, `@PreAuthorize` |
| `ErrorHandler` + `@handles(E)` | `@ControllerAdvice` + `@ExceptionHandler` |
| `@lifecycle(BEFORE_INIT)` | `@PostConstruct` |
| `@lifecycle(AFTER_DISCONNECT)` | `@PreDestroy` |
| `error.cause` | `Throwable.getCause()` |
| `class MyApp extends App<MyApp>` | `Enum<E extends Enum<E>>` |

JoltUI uses the **standard** TC39 decorators implemented by TypeScript 5, not the older
`experimentalDecorators`.

## Where to start

<div class="grid cards" markdown>

-   :material-rocket-launch: **[Getting started](getting-started/index.md)**

    Install JoltUI and build a first application with a layout and two pages.

-   :material-book-open-variant: **[Guide](guide/index.md)**

    Every part of the framework explained with examples.

-   :material-server: **[Deployment](deployment.md)**

    Build a production bundle and serve it with a history-API fallback.

-   :material-code-tags: **[Reference](reference/index.md)**

    Decorators, configuration options, classes, events and errors at a glance.

</div>

## Requirements

- A modern browser with Custom Elements and the History API
- TypeScript 5 with standard decorators
- An ES-module build tool; the documentation uses [Vite](https://vite.dev)

## License

JoltUI is released under the [ISC License](project/license.md).
