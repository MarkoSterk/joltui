# Components

Everything visible in a JoltUI application is a component: a class that extends
`CustomElement` and is registered with `@component`. Layouts and pages are components with extra
metadata, so this page applies to them as well.

## Declaring a component

```typescript
import { CustomElement, component, html } from "joltui";
import type MyApp from "../app.js";

@component({ tagName: "user-card" })
export default class UserCard extends CustomElement<MyApp> {
    override markup = () => html`
        <article class="card">
            <h2>{{! this.args.name }}</h2>
            <p>{{! this.args.email }}</p>
        </article>
    `;
}
```

`@component`:

1. validates the configuration;
2. stores the component's metadata and sets the static `tagName` property;
3. calls `customElements.define(tagName, Class)` when the class is defined.

The element is therefore registered as soon as its module is imported. Defining the same tag
name twice with the same class is harmless; a tag name already registered with a *different*
class throws.

### Configuration options

| Option | Type | Meaning |
| --- | --- | --- |
| `tagName` | `string` | Required. Lowercase, starting with a letter and containing at least one hyphen, e.g. `user-card`. |
| `dataField` | `string` | Re-render the whole component when this application data field changes. |
| `useServer` | `boolean` | Fetch markup from the server instead of calling `markup()` ([Server components](server-components.md)). |
| `groupName` | `string` | Sent with server-component requests to group related components. |
| `cache` | `boolean` | Cache this component's template ([Template caching](template-caching.md)). |
| `cacheDuration` | `number` | Cache lifetime in seconds; overrides the App default. |

## Where markup comes from

A component gets its HTML from one of three sources, checked in this order:

1. **The server**, if `useServer: true`. The response is used as the template.
2. **The `markup` method**, if one is defined. This is by far the most common case.
3. **Its own children** ("prerendered" markup). Without a server and a `markup` method, the
   component keeps the HTML it already contains, converts `@event` and `:argument` attributes
   to their long forms and attaches event listeners. Template expressions in it are *not*
   evaluated on this first pass.

Prerendered components are useful for progressive enhancement of HTML a server has already
produced:

```html
<!-- produced by the server -->
<newsletter-box>
    <form @submit="subscribe">
        <input name="email" type="email" required>
        <button>Subscribe</button>
    </form>
</newsletter-box>
```

```typescript
@component({ tagName: "newsletter-box" })
export default class NewsletterBox extends CustomElement<MyApp> {
    async subscribe(event: Event): Promise<void> {
        event.preventDefault();
        // ...
    }
}
```

!!! warning "Use prerendered markup sparingly"

    Child custom elements inside prerendered markup must already be registered when the host
    initializes. Import them, or declare them as [lazy dependencies](lazy-dependencies.md);
    otherwise initialization fails with an error naming the unregistered child. Heavy nesting
    of prerendered components is discouraged.

## The `markup` method

`markup` is a property holding a function that returns a template string, or a promise of one:

```typescript
override markup = () => html`<p>Hello {{! this.args.name }}</p>`;

// Asynchronous markup: await data before producing the template
override markup = async () => {
    const response = await fetch("/api/stats", { signal: this.abortSignal });
    const stats: Stats = await response.json();
    return html`<p>${stats.visitors} visitors today</p>`;
};
```

### The `html` helper

`html` is a tagged-template function that joins the literal parts and the interpolated values,
turning `null` and `undefined` into empty strings. It exists so that editors highlight the HTML
and build tools such as `minify-html-literals` can recognise and minify it.

### `${...}` versus `{{= ... }}`

A template can contain two kinds of expressions, evaluated at different times:

- `${expression}` is JavaScript template-literal interpolation. It is evaluated **when
  `markup()` runs**, and its result becomes part of the template text.
- `{{= expression }}` is a doT expression. It is evaluated **when the template is rendered**,
  and again every time a `data-bind` region containing it is refreshed.

```typescript
override markup = () => html`
    <p>Rendered at ${new Date().toLocaleTimeString()}</p>
    <p data-bind="count">Count: {{= this.count }}</p>
`;
```

!!! warning "Inside `data-bind` regions always use `{{= }}` or `{{! }}`"

    A `${}` value is baked into the stored region template and never changes. The distinction
    also matters for the [template cache](template-caching.md), which stores the text *after*
    `${}` and *before* `{{ }}` evaluation.

## Using components inside components

Import the module and write the tag:

```typescript
import "./userCard.js";

override markup = () => html`
    <section>
        <user-card :name="Ada Lovelace" :email="ada@example.com"></user-card>
    </section>
`;
```

The parent waits until all of its direct child components have initialized before its own
initialization completes. A layout is therefore ready only when everything inside it is ready.

### Arguments

Attributes that start with `data-jolt-`, or the shorthand `:`, are a component's **arguments**.
`this.args` returns them as an object. Each value is parsed as JSON when possible, so numbers,
booleans, arrays and objects arrive with their proper types:

```html
<user-card :user-id="42" :admin="true" :tags='["staff","ops"]' :name="Ada"></user-card>
```

```typescript
this.args; // { "user-id": 42, admin: true, tags: ["staff", "ops"], name: "Ada" }
```

!!! note "Attribute names are case-insensitive"

    The HTML parser lowercases attribute names, so `:userId` arrives as `this.args.userid`. Use
    lowercase or kebab-case argument names.

### Generating tags in code

Every component class has a static `generate(hashId?, args?)` method that returns its tag as an
HTML string, with arguments serialized and escaped:

```typescript
import UserCard from "./userCard.js";

override markup = () => html`
    <ul>
        ${this.users.map(user =>
            `<li>${UserCard.generate(null, { "user-id": user.id, name: user.name })}</li>`,
        ).join("")}
    </ul>
`;
```

The router uses `generate()` itself to insert layouts and pages.

## Events

`@click="save"` means "when this element receives `click`, call `this.save(event)`". The long
form `jolt-click="save"` is equivalent. Any event name works, including custom events with
hyphens:

```typescript
override markup = () => html`
    <form @submit="save">
        <input name="title" @input="validate">
        <button type="submit">Save</button>
    </form>
`;

save = async (event: Event): Promise<void> => {
    event.preventDefault();
    const data = new FormData(event.currentTarget as HTMLFormElement);
    // ...
};

validate(event: Event): void {
    // ...
}
```

Handlers can be methods or arrow-function properties. They may be asynchronous; JoltUI awaits
them and stops waiting if the component is removed in the meantime.

!!! danger "Do not reuse `HTMLElement` member names"

    A component *is* an `HTMLElement`. A handler called `remove`, `click`, `focus`, `append` or
    `close`, or a property called `title`, `hidden` or `dir`, replaces the element's own
    member. The router, for example, calls `element.remove()` to discard superseded pages.
    Choose specific names such as `deletePost` or `closeDialog`. The same applies to
    `CustomElement`'s own members: `app`, `args`, `data`, `cache`, `parent`, `metadata`,
    `render`, `rerender`, `invalidate` and the others in the
    [reference](../reference/custom-element.md).

### Handler arguments

If the element that triggered the event has arguments, they are passed as a second parameter.
This is the idiomatic way to tell list items apart:

```typescript
override markup = () => html`
    <ul>
        {{~ this.posts :post }}
            <li>
                {{! post.title }}
                <button @click="deletePost" :post-id="{{= post.id }}">Delete</button>
            </li>
        {{~}}
    </ul>
`;

deletePost(event: Event, args: { "post-id": number }): void {
    const posts = this.app.getData<Post[]>("posts");
    this.app.setData("posts", posts.filter(post => post.id !== args["post-id"]));
}
```

### Errors in handlers

If a handler throws or rejects, JoltUI wraps the error in a `MethodExecutionError` (with the
original as `cause`) and passes it to the application's [error handlers](error-handling.md). You
do not need `try`/`catch` in every handler just to report failures.

## Re-rendering

Three ways to update what a component shows, from most to least targeted:

1. **Bindings.** A change to bound data refreshes only the bound regions. `@react` properties,
   `app.setData`, query-parameter updates and attribute changes do this automatically;
   `this.invalidate("name")` does it manually ([Reactivity](reactivity.md)).
2. **`dataField`.** A component configured with `dataField: "user"` re-renders completely
   whenever `app.setData("user", ...)` is called.
3. **`rerender()`.** Re-renders the whole component on demand, running the `BEFORE_RERENDER` and
   `AFTER_RERENDER` hooks.

```typescript
@component({ tagName: "account-menu", dataField: "user" })
export default class AccountMenu extends CustomElement<MyApp> { /* ... */ }
```

A full re-render replaces all of the component's children. Child components are recreated and
lose their internal state, which is why bindings are usually the better tool. If several
re-renders overlap, only the latest one is committed.

## Selecting elements

`@select` and `@selectAll` expose descendants as read-only accessor properties. The query runs
every time the property is read, so it always reflects the current DOM:

```typescript
import { select, selectAll } from "joltui";

@select<HTMLInputElement>("#email", { required: true })
accessor emailInput!: HTMLInputElement;

@select<HTMLElement>(".error")
accessor errorBox!: HTMLElement | null;

@selectAll<HTMLInputElement>("input[required]")
accessor requiredInputs!: NodeListOf<HTMLInputElement>;

validate(): boolean {
    return Array.from(this.requiredInputs).every(input => input.value);
}
```

With `required: true`, reading the property throws if nothing matches. Assigning to a selected
property throws as well. Selectors may use the `:` shorthand: `@select("[:role=primary]")`
matches `data-jolt-role="primary"`.

By default, selections query inside the custom element. Set `global: true` to query
inside the owning app's container, including sibling components:

```typescript
@select<HTMLDivElement>("#notification", { required: true, global: true })
accessor notification!: HTMLDivElement;

@selectAll<HTMLButtonElement>("button", { global: true })
accessor appButtons!: NodeListOf<HTMLButtonElement>;
```

`global` defaults to `false`. Global selections require an initialized app and stay
within its container. The query runs on every read; `required` behaves the same in
both scopes.

## Element identity

| Member | Description |
| --- | --- |
| `hashId` / `data-hash-id` | Random identifier, unique per instance. |
| `data-parent-id` | `hashId` of the component that rendered this element. |
| `parent` | The parent `CustomElement`, if any. |
| `app` | The application instance. |
| `args` | Parsed arguments. |
| `metadata` | Decorator metadata (kind, tag name, configuration). |
| `initComplete` | Promise resolved when initialization succeeds. |
| `initializationState` | `"pending"`, `"fulfilled"` or `"rejected"`. |
| `initializationError` | The failure, if initialization was rejected. |
| `abortSignal` | Aborted when the element is removed ([Cancellation](cancellation.md)). |
| `lastRender` | Timestamp of the last render. |

The `hashId` makes it possible to find a specific instance; see
[Component communication](communication.md).
