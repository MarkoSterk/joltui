# Server components

JoltUI renders on the client, but a component's template does not have to come from the client.
A component can ask a server for its markup; the server decides *what* is shown, and the client
class provides *behaviour*.

## Setting up

Configure the endpoint on the App and opt components in with `useServer`:

```typescript
const app = new MyApp({
    appName: "Portal",
    serverComponentsUrl: "/api/components",
});
```

```typescript
@component({
    tagName: "account-summary",
    groupName: "account",
    useServer: true,
})
export default class AccountSummary extends CustomElement<MyApp> {
    refresh = async (): Promise<void> => {
        await this.rerender();
    };
}
```

```html
<account-summary :currency="EUR"></account-summary>
```

## The request

To render, the component sends a `POST` request to `serverComponentsUrl?<current query string>`
with credentials included and a JSON body:

```json
{
    "tagName": "account-summary",
    "groupName": "account",
    "routeParameters": { "accountId": 42 },
    "queryParameters": { "tab": "overview" },
    "attributes": { "currency": "EUR" }
}
```

`attributes` contains the component's arguments (`this.args`, from its `data-jolt-*`
attributes). `groupName` defaults to `"default"`. The server identifies the component by
`tagName` (and `groupName`, if it organises templates in groups) and answers with HTML.

!!! tip "Patera"

    The [Patera](https://patera.markosterk.com) Python framework implements this endpoint in its
    `patera-joltui` extension, with typed group and component handlers.

## The response is a template

The returned HTML is treated exactly like the output of `markup()`. doT expressions are evaluated
with the client component as `this`, `@event` and `:argument` shorthands are expanded, and event
handlers are bound to the client class's methods:

```html
<!-- returned by the server -->
<section class="summary">
    <h2>Balance: 1,204.50 EUR</h2>
    <button @click="refresh">Refresh</button>
    <p data-bind="app.user">Signed in as {{! this.app.user?.name }}</p>
</section>
```

Server components can contain bindings and child components like any other template.

## Failures

| Response | Error |
| --- | --- |
| network failure | `NetworkError` |
| `400` | `ServerComponentBadRequestResponse` |
| `401` | `AuthenticationError` |
| `403` | `AuthorizationError` |
| `404` | `ServerComponentNotFound` |
| `5xx` | `InternalServerError` |
| any other non-2xx | `HttpRequestError` |
| `2xx` with an empty or unreadable body | `MarkupFetchError` |

The error fails the component's initialization (or rejects `rerender()`) and reaches the
[error handlers](error-handling.md) as usual. A missing `serverComponentsUrl` is reported as a
configuration error.

## Customising the request

`fetchHTML(request, options)` performs the request. It is an instance property rather than a
prototype method, so `super.fetchHTML` is not available. To extend it, capture the inherited
function in the constructor and wrap it:

```typescript
@component({ tagName: "price-list", useServer: true })
export default class PriceList extends CustomElement<MyApp> {
    constructor() {
        super();
        const baseFetchHTML = this.fetchHTML;
        this.fetchHTML = async (request, options = {}) =>
            await baseFetchHTML(
                {
                    ...request,
                    attributes: {
                        ...request.attributes,
                        locale: this.app.getData("locale"),
                    },
                },
                options,   // always forward: carries the signal and cache settings
            );
    }
}
```

Always forward `options`: they contain the abort signal and the cache settings. The cache key is
computed from the request *before* your override changes it; if the added value affects the
response, include it in [`templateCacheKey()`](template-caching.md#cache-keys) too.

## Prefetching

`prefetchHTML(request, options?)` loads a server template into the cache ahead of time. It uses an
independent request that is not tied to any component's lifetime:

```typescript
@lifecycle(Lifecycle.AFTER_INIT)
warmUpDetails(): void {
    void this.prefetchHTML({ tagName: "order-details", groupName: "orders" });
}
```

When an `<order-details>` element with matching parameters renders later, its template comes from
the cache.
