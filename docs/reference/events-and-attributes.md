# Events and attributes

## Events

All events are dispatched on the app container and bubble.

| Constant | Event name | `detail` | When |
| --- | --- | --- | --- |
| `dataEventEnum.CHANGE` | `app-data-change` | `{ field }` | `app.setData()` was called. |
| `dataEventEnum.QUERY_CHANGE` | `query-parameter-change` | `{ field }` | A query parameter changed through the App. |
| `routeEventsEnum.START` | `route-change.start` | — | Rendering of a route begins. |
| `routeEventsEnum.LAYOUT_CHANGE_FINISHED` | `route-change.layout-change.finished` | — | A new base layout has been rendered. |
| `routeEventsEnum.FINISHED` | `route-change.finished` | — | The page has rendered and the title is set. |

```typescript
this.app.addEventListener(routeEventsEnum.FINISHED, () => this.update(), {
    signal: this.abortSignal,
});
```

## Attributes

| Attribute | Set by | Meaning |
| --- | --- | --- |
| `app-id` | App | Marks the application container. |
| `data-hash-id` | component | Unique instance identifier (`hashId`). |
| `data-parent-id` | component | `hashId` of the component that rendered the element. |
| `data-render-time` | component | Render timestamp; used to find freshly inserted elements. |
| `data-bind` | you | Declares a bound region. |
| `data-bind-id` | template engine | Identifies a bound region. |
| `data-jolt-<name>` / `:<name>` | you | Component or handler argument. |
| `jolt-<event>` / `@<event>` | you | Event binding. |
| `data-jolt-router-layout` | router | Marks a sublayout element. |
| `data-jolt-layout-depth` | router | Position of a sublayout in the chain (0 = first). |
| `router-ignore` | you | Excludes a link from client-side routing. |

## Patched DOM members

`app.init()` patches these members so that JoltUI templates and shorthands work everywhere
inside components ([details](../guide/architecture.md#the-patched-dom)):

- `innerHTML`, `outerHTML` setters and `insertAdjacentHTML`;
- `setAttribute`, `getAttribute`, `removeAttribute`, `hasAttribute`, `toggleAttribute`;
- `querySelector` and `querySelectorAll` on `Document` and `Element`.
