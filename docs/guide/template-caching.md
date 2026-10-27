# Template caching

Any template, from the server or from `markup()`, can be cached so that it is not produced again
for every instance.

## Enabling the cache

Caching is opt-in per component:

```typescript
@component({ tagName: "about-page", cache: true, cacheDuration: 300 })
```

Without `cacheDuration` the App's `templatesCacheDuration` (default 300 seconds) applies. A
duration of `0` disables caching for the component.

```typescript
const app = new MyApp({
    appName: "Example",
    templatesCacheDuration: 300,
    templatesCacheCleanupInterval: 60,
});
```

## What is cached

The cache stores the **template**: the string returned by `markup()`, or the HTML returned by the
server. It does *not* store the rendered result. doT expressions (`{{= }}`, `{{? }}`, `{{~ }}`) are
still evaluated on every render with the component's current state, and bindings still work.

What the cache freezes is everything that went into producing the template:

- values interpolated with `${}`;
- data that an asynchronous `markup()` fetched;
- the server's response.

That makes caching most valuable for server components and for `markup()` methods that do
expensive work:

```typescript
@component({ tagName: "country-select", cache: true, cacheDuration: 3600 })
export default class CountrySelect extends CustomElement<MyApp> {
    override markup = async () => {
        const response = await fetch("/api/countries");
        const countries: Country[] = await response.json();
        return html`
            <select name="country">
                ${countries.map(country =>
                    `<option value="${country.code}">${country.name}</option>`,
                ).join("")}
            </select>
        `;
    };
}
```

The country list is fetched once an hour, however many forms show the selector.

!!! warning "Do not tie cached work to one component"

    The cached factory runs once and its result is shared. Passing `this.abortSignal` to the
    request above would let the removal of one component cancel work that other instances are
    waiting for. JoltUI itself cancels only each component's *wait* for a shared result, never
    the shared work.

## Cache keys

The default key combines:

- the tag name;
- the current route parameters;
- the current query parameters (sorted);
- the component's arguments;
- for server components, also the group name.

Two instances with different arguments, or the same component on different URLs, get different
cache entries. **Application data is not part of the key**, and `setData()` does not invalidate
cached templates.

If the template depends on something else, such as the user's locale or permissions, override
`templateCacheKey()`. It must return a non-empty string:

```typescript
override templateCacheKey(): string {
    const locale = this.app.getData<string>("locale");
    return `catalog:${locale}:${this.args.category}`;
}
```

For server components, the method receives the outgoing request as a parameter.

## Concurrency

If several components request the same key at once, they share one in-flight operation. A
component removed while waiting stops waiting, but the shared request continues for the others
and still populates the cache.

## Invalidation and cleanup

The application decides when cached templates become invalid: login, logout, an account switch, a
permission change, or an update to data the templates are built from:

```typescript
this.app.setData("user", null);
this.app.clearTemplatesCache();
```

| Member | Purpose |
| --- | --- |
| `clearTemplatesCache()` | Remove every entry. Requests already running finish for their callers but cannot repopulate the cache. |
| `removeCachedTemplate(key)` | Remove one entry. |
| `cleanTemplatesCache()` | Remove expired entries now; returns how many were removed. |
| `templatesCacheCleanupInterval` | Seconds between automatic cleanups (`0` = off); can be changed at runtime. |
| `templatesCacheDuration` | Default lifetime in seconds; can be changed at runtime. |
| `getCachedTemplate`, `setCachedTemplate`, `getOrSetCachedTemplate` | Low-level access for custom caching. |

Expired entries are also removed lazily when they are requested.

Clearing the cache does not abort network requests or re-render components already on screen.
After an account change, also navigate away from or re-render the affected components; their
lifetime signals cancel their existing work.
