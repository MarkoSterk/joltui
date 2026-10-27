# Lifetime and cancellation

Single-page applications create and remove components constantly. A page that is still loading
data when the user navigates away should stop its work, and must certainly not write its results
into a page that no longer exists. JoltUI gives every component a **lifetime** expressed as a
standard `AbortSignal`.

## The lifetime signal

Every `CustomElement` has a read-only `abortSignal`. It is aborted when the element is removed from
the DOM (`disconnectedCallback`). The abort reason is an `ElementDisconnectedError`.

Pass the signal to anything that accepts one:

```typescript
@lifecycle(Lifecycle.BEFORE_INIT)
async loadComments(): Promise<void> {
    const response = await fetch(`/api/posts/${this.postId}/comments`, {
        signal: this.abortSignal,
    });
    this.comments = await response.json();
}
```

```typescript
document.addEventListener("keydown", this.onKey, {
    signal: this.abortSignal,   // listener removed with the component
});
```

Work that cannot be cancelled, such as a dynamic import or a library without signal support,
simply finishes. After every such `await`, check the signal before producing side effects:

```typescript
async loadDetails(): Promise<void> {
    const { renderChart } = await import("./chartLibrary.js");
    this.abortSignal.throwIfAborted();   // stop if we were removed meanwhile
    renderChart(this.querySelector("#chart"));
}
```

## What JoltUI does on removal

When a component is disconnected:

- its `abortSignal` is aborted;
- its pending initialization promises (`initComplete`, `initElement()`) reject with an
  `ElementDisconnectedError`;
- it stops listening to application data and query-parameter changes;
- event handlers that are still awaiting stop waiting;
- an in-progress render is abandoned before it commits any markup;
- `AFTER_DISCONNECT` hooks run, with the signal already aborted.

**Cancellation is not an error.** `ElementDisconnectedError` is never passed to the application's
error handlers, even when it propagates through a parent's initialization or through the router.
Successful initialization still resolves `initComplete` immediately before `AFTER_INIT`, and once
fulfilled it is not changed by a later disconnection.

## Recognising cancellation

When you call `initElement()` or `rerender()` yourself, or catch errors around work tied to the
signal, use `isElementCancellation(error)`. It also detects a cancellation hidden in an error's
`cause` chain:

```typescript
import { isElementCancellation } from "joltui";

try {
    await this.rerender();
} catch (error) {
    if (isElementCancellation(error)) return;   // expected: we were removed
    throw error;
}
```

JoltUI's own event, lifecycle and routing paths already do this.

## Overlapping renders

If `render()` or `rerender()` is called while a previous render is still in progress (for instance
an asynchronous `markup()` waiting for the network), **the latest render wins**:

- superseded calls resolve quietly without committing markup or running the remaining hooks;
- existing bindings stay active until the replacement markup is ready;
- the component's lifetime is unaffected.

Synchronous binding refreshes (`invalidate`, data changes) do nothing once a component's lifetime
has ended.

## Combining signals

Sometimes work should stop for two reasons: the component disappears, *or* a newer request
replaces the current one. Search-as-you-type is the classic case. `AbortSignal.any` combines both:

```typescript
private searchController: AbortController | null = null;

async search(event: Event): Promise<void> {
    this.searchController?.abort();
    this.searchController = new AbortController();

    const signal = AbortSignal.any([this.abortSignal, this.searchController.signal]);

    const query = (event.target as HTMLInputElement).value;
    try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal });
        this.results = await response.json();
    } catch (error) {
        if (signal.aborted) return;   // replaced or removed: not a failure
        throw error;
    }
}
```

## Navigation and cancellation

Every navigation has its own `AbortController`. When a new navigation starts, the previous one is
aborted and the layouts, sublayouts and page it had *started* creating are removed, which ends
their lifetimes. Layouts from a navigation that has *completed* are left alone and can be reused.

## Rules for element instances

- **A removed instance cannot be reused.** Its lifetime has ended; create a new element instead.
- **Moving an element in the DOM ends its lifetime too**, because moving triggers
  `disconnectedCallback`. Do not detach and re-insert components to preserve their state; keep
  the state in application data instead.
- Do not tie **shared cached work** to one component's lifetime signal
  ([Template caching](template-caching.md)); cancelling it would affect every waiting component.
