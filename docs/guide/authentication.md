# Authentication and authorization

The `@auth` decorator declares which pages and layouts need a signed-in user, and which roles
that user needs. The router enforces the declarations before it renders anything. *How* a user is
authenticated is up to your application: you answer two questions in your router subclass.

## Declaring requirements

```typescript
import { auth, component, CustomElement, page } from "joltui";

// any signed-in user
@auth()
@page({ path: "/drafts", title: "Drafts" })
@component({ tagName: "drafts-page" })
export default class DraftsPage extends CustomElement<MyApp> {}

// signed-in user with the ADMIN role
@auth(["ADMIN"])
@page({ path: "/admin/users", title: "Users" })
@component({ tagName: "admin-users-page" })
export default class AdminUsersPage extends CustomElement<MyApp> {}
```

`@auth` goes **above** `@page` or `@layout`. It may only decorate pages and layouts, not ordinary
components. Roles are values of any type (strings, enum members, numbers); JoltUI passes them to
your code unchanged.

### Protecting layouts

A protected layout acts as a gatekeeper for every route that uses it, as a page layout or as a
sublayout:

```typescript
@auth(["STAFF"])
@layout
@component({ tagName: "admin-layout" })
export default class AdminLayout extends CustomElement<MyApp> {}

@auth(["BILLING"])
@page({
    path: "/admin/invoices",
    subLayouts: [{ target: "#page", layout: AdminLayout }],
    target: "#admin-content",
})
@component({ tagName: "invoices-page" })
export default class InvoicesPage extends CustomElement<MyApp> {}
```

## Implementing the checks

The router has two methods that throw `NotImplementedError` by default. An application that uses
`@auth` must override them:

```typescript title="src/app/router.ts"
import { Router } from "joltui";
import type MyApp from "./app.js";
import type { User } from "./types.js";

export default class MyRouter extends Router<MyApp> {
    override isAuthenticated(): boolean {
        return this.app.getData<User | null>("user") !== null;
    }

    override checkUserRoles(roles: unknown[]): boolean {
        const user = this.app.getData<User | null>("user");
        return Boolean(user && roles.some(role => user.roles.includes(role)));
    }
}
```

Both methods may be asynchronous, for example to ask the server or refresh a token:

```typescript
override async isAuthenticated(): Promise<boolean> {
    if (this.app.getData("user")) return true;
    const response = await fetch("/api/session", { credentials: "include" });
    const session: User | null = response.ok ? await response.json() : null;
    this.app.setData("user", session);
    return session !== null;
}
```

## How a route is checked

For each navigation the router collects the requirements of the route's **authentication
chain**: the layout, then each sublayout, then the page.

1. If **any** member requires authentication, `isAuthenticated()` is called **once**. If it
   returns `false`, the navigation fails with an `AuthenticationError`.
2. Then, for **each** member that lists roles, `checkUserRoles(roles)` is called with that
   member's roles. If any call returns `false`, the navigation fails with an
   `AuthorizationError`.

Requirements are therefore cumulative. In the example above, a user needs `STAFF` (from the
layout) **and** `BILLING` (from the page) to open `/admin/invoices`. Within a single call it is up
to you whether one matching role is enough (`some`) or all are needed (`every`).

All checks run **before anything is rendered**, and they run on every navigation, even when the
protected layout is already on screen and would be reused. Route parameters are published only
after authorization succeeds.

## Responding to failures

Authentication and authorization failures go to the application's
[error handlers](error-handling.md):

```typescript
import {
    AuthenticationError,
    AuthorizationError,
    ErrorHandler,
    handles,
} from "joltui";
import ForbiddenPage from "./errorPages/forbiddenPage.js";

export default class MyErrorHandler extends ErrorHandler<MyApp> {
    @handles(AuthenticationError)
    async signIn(error: AuthenticationError): Promise<void> {
        const target = encodeURIComponent(error.path);
        await this.app.router.redirect(`/login?target=${target}`);
    }

    @handles(AuthorizationError)
    async forbidden(error: AuthorizationError): Promise<void> {
        await this.app.router.showErrorPage(ForbiddenPage, {
            error,
            title: "Access denied",
        });
    }
}
```

`AuthenticationError.path` is the path the user tried to open. `AuthorizationError` additionally
carries the `roles` that were required.

After a successful login, the login page redirects back:

```typescript
@queryParam("target", "/")
accessor target!: string;

login = async (event: Event): Promise<void> => {
    event.preventDefault();
    this.app.setData("user", await this.signInWithForm(event));
    await this.app.router.redirect(this.target);
};
```

The same two errors are raised when a [server component](server-components.md) request is
answered with `401` or `403`, so one pair of handlers covers both cases.

!!! warning "Client-side checks are about user experience, not security"

    They keep users away from screens they cannot use, but anyone can modify JavaScript running
    in their own browser. Every API the application calls must enforce the same rules on the
    server.

## Signing out

Signing out is a data change followed by navigation:

```typescript
logout = async (): Promise<void> => {
    this.app.setData("user", null);
    this.app.clearTemplatesCache();   // if cached templates depend on the user
    await this.app.router.redirect("/");
};
```

Bindings on `app.user`, such as the layout's *Sign in* / *Profile* switch, update immediately.
