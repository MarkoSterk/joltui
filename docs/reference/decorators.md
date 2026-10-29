# Decorators

| Decorator | Applies to | Purpose |
| --- | --- | --- |
| `@component({ tagName, … })` | class | Registers a custom element and its configuration. Must be closest to the class. |
| `@layout` | class | Marks a component as a layout. Above `@component`. |
| `@page(path)` / `@page({ … })` | class | Marks a component as a routable page. Above `@component`. |
| `@auth(roles?)` | class | Requires authentication (and roles) for a page or layout. Above `@page` / `@layout`. |
| `@lifecycle(...stages)` | method | Runs the method at the given [lifecycle stages](../guide/lifecycle.md). |
| `@handles(...ErrorTypes)` | method of an `ErrorHandler` | Handles the given error types. |
| `@react(initial, binding?)` | `accessor` | Reactive state; assignment refreshes `binding` (default: the property name). |
| `@reactFactory(factory, binding?)` | `accessor` | Reactive state with a per-instance factory. |
| `@queryParam(name, default?, binding?)` | `accessor` | Exposes a query parameter as a string property. |
| `@select(selector, { required?, global? })` | `accessor` | First matching descendant; `global: true` searches the app container. Read-only. |
| `@selectAll(selector, { required?, global? })` | `accessor` | All matching descendants; `global: true` searches the app container. Read-only. |

## Stacking order

Decorators run bottom-up. `@component` registers the element and must be applied first, so it
goes closest to the class:

```typescript
@auth(["ADMIN"])
@page({ path: "/admin", title: "Admin" })
@component({ tagName: "admin-page" })
export default class AdminPage extends CustomElement<MyApp> {}
```

```typescript
@auth()
@layout
@component({ tagName: "account-layout" })
export default class AccountLayout extends CustomElement<MyApp> {}
```

## Lifecycle stages

| Stage | App | Component |
| --- | :-: | :-: |
| `Lifecycle.BEFORE_INIT` | ✓ | ✓ |
| `Lifecycle.EXTENSION_INIT` | ✓ | |
| `Lifecycle.BEFORE_INIT_RESOLVE` | | ✓ |
| `Lifecycle.AFTER_INIT` | ✓ | ✓ |
| `Lifecycle.BEFORE_RERENDER` | | ✓ |
| `Lifecycle.AFTER_RERENDER` | | ✓ |
| `Lifecycle.AFTER_DISCONNECT` | | ✓ |

## Rules

- Property decorators (`@react`, `@reactFactory`, `@queryParam`, `@select`, `@selectAll`) require
  the `accessor` keyword.
- `@lifecycle` and `@handles` decorate methods, not arrow-function properties. They cannot
  decorate static, private (`#name`) or symbol-named methods.
- Decorators are not inherited by overrides: an undecorated override removes the registration.
