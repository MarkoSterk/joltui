# Without a router

`routerGenerator()` returns `null` by default. An App without a router is still useful: it can
host components embedded in a server-rendered page, giving them shared data, templates, events
and error handling without client-side routing.

```typescript
import { App } from "joltui";

export default class WidgetsApp extends App<WidgetsApp> {}
```

## Initialization order

A custom element initializes as soon as it is both *defined* and *connected*, and it must find the
`[app-id]` container at that moment. When the tags are already present in the server's HTML,
initialize the App first and import the component modules afterwards:

```html
<div id="widgets">
    <search-box></search-box>
    <cart-summary></cart-summary>
</div>
```

```typescript
const app = new WidgetsApp({
    appName: "Widgets",
    dataStructure: { cart: [] },
});
await app.init("#widgets");

// Defining the elements now upgrades the tags already in the page.
await import("./components/searchBox.js");
await import("./components/cartSummary.js");
```

The same rule explains why pages and layouts can be imported statically in a routed application:
they enter the DOM only when the router renders them, which happens after the container has been
set up.

## Progressive enhancement

Components without a `markup` method keep the HTML the server rendered into them and only attach
behaviour ([prerendered markup](components.md#where-markup-comes-from)). Combined with an App
without a router, this turns server-rendered pages into interactive ones without rewriting their
templates on the client.
