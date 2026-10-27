# Guide

The guide explains every part of JoltUI with examples. Start with the
[architecture overview](architecture.md); the other pages can be read in any order.

<div class="grid cards" markdown>

-   **Building blocks**

    ---

    [Application](application.md) · [Components](components.md) ·
    [Templates](templates.md) · [Reactivity](reactivity.md) ·
    [Communication](communication.md) · [Lifecycle](lifecycle.md)

-   **Routing**

    ---

    [Routing](routing.md) · [Layouts and sublayouts](layouts.md) ·
    [Authentication](authentication.md)

-   **Robustness**

    ---

    [Error handling](error-handling.md) · [Lifetime and cancellation](cancellation.md)

-   **Performance**

    ---

    [Lazy dependencies](lazy-dependencies.md) · [Server components](server-components.md) ·
    [Template caching](template-caching.md)

-   **Tooling**

    ---

    [Vite plugin](vite-plugin.md) · [Without a router](without-a-router.md)

</div>

## Conventions

Code is TypeScript and imports from the `joltui` package. Many examples refer to an application
class called `MyApp`; its definition is on the [Application](application.md) page. Examples show
only the code that matters for the point at hand.
