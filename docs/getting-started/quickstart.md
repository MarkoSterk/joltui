# Quickstart

This page builds an application with a layout, two pages, a router and the application class.

## A layout

A *layout* is the frame around your pages: header, navigation, footer. It contains an element
that the router fills with the current page, here `<main id="page">`.

```typescript title="src/app/layouts/mainLayout.ts"
import { CustomElement, component, html, layout } from "joltui";
import type MyApp from "../app.js";

@layout
@component({ tagName: "main-layout" })
export default class MainLayout extends CustomElement<MyApp> {
    override markup = () => html`
        <header>
            <nav>
                <a href="/">Home</a>
                <a href="/about">About</a>
            </nav>
        </header>

        <main id="page"></main>

        <footer>Built with JoltUI</footer>
    `;
}
```

## Pages

A *page* is a component that the router renders for a URL.

```typescript title="src/app/pages/homePage.ts"
import { CustomElement, component, html, page } from "joltui";
import type MyApp from "../app.js";

@page({ path: "/", title: "Home" })
@component({ tagName: "home-page" })
export default class HomePage extends CustomElement<MyApp> {
    override markup = () => html`
        <h1>Hello from JoltUI</h1>
        <p>This page is a custom element called <code>&lt;home-page&gt;</code>.</p>
    `;
}
```

```typescript title="src/app/pages/aboutPage.ts"
import { CustomElement, component, html, page } from "joltui";
import type MyApp from "../app.js";

@page({ path: "/about", title: "About" })
@component({ tagName: "about-page" })
export default class AboutPage extends CustomElement<MyApp> {
    override markup = () => html`
        <h1>About</h1>
        <p>Running on {{= this.app.appName }}.</p>
    `;
}
```

!!! warning "Decorator order matters"

    `@component` must be the decorator closest to the class. Decorators run bottom-up:
    `@component` registers the element and its metadata, and `@page`, `@layout` and `@auth`
    above it extend that metadata. Putting `@page` below `@component` throws
    `@page requires @component to be applied below it.`

## Router and application

The router knows the layout, the default target selector and (thanks to the Vite plugin) all
pages. The application creates the router in its `routerGenerator()` method.

```typescript title="src/app/router.ts"
import { Router } from "joltui";
import type MyApp from "./app.js";

export default class MyRouter extends Router<MyApp> {}
```

```typescript title="src/app/app.ts"
import { App } from "joltui";
import MainLayout from "./layouts/mainLayout.js";
import MyRouter from "./router.js";

export default class MyApp extends App<MyApp> {
    protected override routerGenerator(): MyRouter {
        return new MyRouter({
            app: this,
            baseLayout: MainLayout,
            defaultTarget: "#page",
        });
    }
}
```

??? note "Without the Vite plugin"

    List the pages on the router explicitly:

    ```typescript
    import AboutPage from "./pages/aboutPage.js";
    import HomePage from "./pages/homePage.js";

    const pages = [HomePage, AboutPage] as const;

    return new MyRouter({
        app: this,
        pages,
        baseLayout: MainLayout,
        defaultTarget: "#page",
    });
    ```

The entry point creates the application and initializes it in the container:

```typescript title="src/main.ts"
import MyApp from "./app/app.js";

const app = new MyApp({
    appName: "My App",
    dataStructure: {
        user: null,
    },
});

await app.init("#app");
```

## Run it

```sh
npx vite
```

Opening <http://localhost:5173/> shows the layout with the home page inside it. Clicking
*About* changes the URL and swaps the page without reloading the document: same-origin links
are intercepted by the router automatically.

## Build for production

```sh
npx vite build
```

The output in `dist/` is a static bundle. Because the router uses the History API, the web
server must answer unknown paths with `index.html`; see [Deployment](../deployment.md).
