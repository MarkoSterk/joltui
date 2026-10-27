# Layouts and sublayouts

A **layout** is a component that frames pages: it renders the parts of the screen that stay the
same between pages and contains a *target* element into which the router inserts the current
page. JoltUI supports one base layout per route plus an optional **chain of sublayouts** between
the layout and the page.

## Declaring a layout

A layout is a component with `@layout` above `@component`:

```typescript
import { CustomElement, component, html, layout } from "joltui";
import type MyApp from "../app.js";

@layout
@component({ tagName: "main-layout" })
export default class MainLayout extends CustomElement<MyApp> {
    override markup = () => html`
        <header class="site-header">…</header>
        <main id="page"></main>
        <footer class="site-footer">…</footer>
    `;
}
```

Layouts are full components: they can have reactive state, bindings, event handlers and
lifecycle hooks. Navigation menus, notification badges and sign-in status usually live in the
layout.

## The base layout and per-page layouts

The router's `baseLayout` is used for every page that does not choose another one. A page can
select a different layout, and a different target inside it:

```typescript
@page({
    path: "/login",
    title: "Sign in",
    layout: AuthLayout,
    target: "#auth-content",
})
@component({ tagName: "login-page" })
export default class LoginPage extends CustomElement<MyApp> { /* … */ }
```

```typescript
@layout
@component({ tagName: "auth-layout" })
export default class AuthLayout extends CustomElement<MyApp> {
    override markup = () => html`
        <main class="auth-shell">
            <a class="brand" href="/">MyApp</a>
            <div id="auth-content"></div>
        </main>
    `;
}
```

### Layout reuse

When the next route uses **the same layout class** as the current one, the router keeps the
existing layout instance and only replaces the page inside its target. The layout is not
re-rendered: its state, scroll position and any open menus survive navigation. When the layout
class differs, the router replaces the whole contents of the app container with the new layout
and emits `route-change.layout-change.finished`.

## Sublayout chains

Larger applications often have sections with their own navigation, such as an account area with a
sidebar or an admin area with tabs. Sublayouts express that nesting without nested route
definitions:

```typescript
@page({
    path: "/account/profile",
    title: "Profile",
    subLayouts: [
        { target: "#page", layout: AccountLayout },
        { target: "#account-content", layout: ProfileLayout },
    ],
    target: "#profile-content",
})
@component({ tagName: "profile-page" })
export default class ProfilePage extends CustomElement<MyApp> {}
```

The chain is resolved from the outside in:

1. `#page` is looked up inside the **base layout**, and `AccountLayout` is rendered there;
2. `#account-content` is looked up inside `AccountLayout`, and `ProfileLayout` is rendered there;
3. the page's own `target`, `#profile-content`, is looked up inside the **last sublayout**, and the
   page is rendered there.

Every class in the chain must use `@layout`. Its module registers it through `@component`, and
the router validates that registration from the page metadata.

```text
main-layout                 (base layout)
└─ #page
   └─ account-layout        (sublayout 0)
      └─ #account-content
         └─ profile-layout  (sublayout 1)
            └─ #profile-content
               └─ profile-page
```

### Reuse along the chain

Sublayouts are reused the same way layouts are. When consecutive pages request the same ordered
sequence of `(target, layout)` pairs, the existing sublayout instances and their state are kept.
At the **first difference**, that sublayout and everything below it are replaced. A page without
sublayouts removes the active chain before it renders.

```typescript
@auth()
@layout
@component({ tagName: "profile-sublayout" })
export default class ProfileSublayout extends CustomElement<MyApp> {
    override markup = () => html`
        <div class="row">
            <nav class="col-3">
                <a href="/profile">Profile</a>
                <a href="/profile-billing">Billing</a>
            </nav>
            <div id="subcontent" class="col-9"></div>
        </div>
    `;
}
```

```typescript
@page({
    path: "/profile",
    title: "Profile",
    subLayouts: [{ target: "#page-content", layout: ProfileSublayout }],
    target: "#subcontent",
})
@component({ tagName: "profile-page" })
export default class ProfilePage extends CustomElement<MyApp> { /* … */ }

@page({
    path: "/profile-billing",
    title: "Billing",
    subLayouts: [{ target: "#page-content", layout: ProfileSublayout }],
    target: "#subcontent",
})
@component({ tagName: "profile-billing" })
export default class ProfileBilling extends CustomElement<MyApp> { /* … */ }
```

Moving between `/profile` and `/profile-billing` swaps only the contents of `#subcontent`; the
sidebar instance stays in place. Navigating to `/`, a page without sublayouts, removes it.

To avoid repeating the chain on every page, keep it in a constant:

```typescript
export const profileSection = [
    { target: "#page-content", layout: ProfileSublayout },
] as const;

@page({ path: "/profile", subLayouts: profileSection, target: "#subcontent" })
```

!!! note "One page per route"

    JoltUI renders one page per route and has no nested route definitions. Sublayouts are the
    composition mechanism.

## Targets

Targets are CSS selectors. The router first checks whether the layout element itself matches the
selector, then searches inside it. Use ids or other selectors unique within the layout; the first
match wins.

Sublayout elements receive two extra attributes, `data-jolt-router-layout` and
`data-jolt-layout-depth` (0 for the first sublayout), which are handy for styling and debugging.

## Protecting a whole section

Because `ProfileSublayout` carries `@auth()`, every route that uses it requires a signed-in user.
The pages themselves do not need the decorator. See [Authentication](authentication.md).
