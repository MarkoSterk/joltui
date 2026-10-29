# Error handling

JoltUI routes errors from every part of an application to one place: the **error handler
classes** registered on the App. The design follows the Java pattern of `@ControllerAdvice`
classes with `@ExceptionHandler` methods: handlers are declared by annotating methods with the
error types they handle, and the framework picks the right one.

## Writing an error handler

```typescript title="src/app/errorHandler.ts"
import {
    AuthenticationError,
    ErrorHandler,
    RouteNotFoundError,
    handles,
} from "joltui";
import type MyApp from "./app.js";
import NotFoundPage from "./errorPages/notFoundPage.js";
import { ValidationError } from "./errors.js";

export default class MyErrorHandler extends ErrorHandler<MyApp> {
    @handles(AuthenticationError)
    async signIn(error: AuthenticationError): Promise<void> {
        await this.app.router.redirect(`/login?target=${encodeURIComponent(error.path)}`);
    }

    @handles(RouteNotFoundError)
    async notFound(error: RouteNotFoundError): Promise<void> {
        await this.app.router.showErrorPage(NotFoundPage, {
            error,
            title: "Page not found",
        });
    }

    @handles(ValidationError)
    showValidation(error: ValidationError): void {
        this.app.setData("formErrors", error.fieldErrors);
    }
}
```

Register the class on the application:

```typescript
export default class MyApp extends App<MyApp> {
    override readonly errorHandlers:
        readonly ErrorHandlerClass<MyApp>[] = [MyErrorHandler];
}
```

The App creates one instance of each class during `init()` and passes itself to the constructor,
so handler methods can use `this.app`. A method may handle several types:
`@handles(NetworkError, InternalServerError)`.

## Where errors come from

You rarely call the error handlers yourself. JoltUI calls them for:

| Source | Error passed to the handlers |
| --- | --- |
| An event handler throws | `MethodExecutionError` (cause: your error) |
| A lifecycle hook throws during initialization | `ElementInitializationError` → `MethodExecutionError` → your error |
| `markup()` throws during initialization | `ElementInitializationError` → `RenderError` → your error |
| A route does not exist | `RouteNotFoundError` |
| Authentication / authorization fails | `AuthenticationError` / `AuthorizationError` |
| A link-click navigation throws | `RouteFailedError` (cause: the failure) |
| A server component cannot be loaded | see [Server components](server-components.md#failures) |

To report an error from your own code, pass it to the App:

```typescript
try {
    await this.save();
} catch (error) {
    await this.app.handleError(error);
}
```

`handleError` throws if no handler accepts the error. `handleErrorOnce` remembers each error
object and handles it only once; JoltUI uses it so that an initialization failure that propagates
through several parent components is reported a single time.

## Errors and their causes

### HTTP response details

Non-successful HTTP responses from server components and `RequestHelper` retain
their existing error types and expose an `error.response` snapshot:

| Field | Meaning |
| --- | --- |
| `status`, `statusText`, `ok` | HTTP status information |
| `headers` | Browser-visible response headers, as `Headers` |
| `body` | Original response text, including server error IDs |
| `data` | Parsed JSON when the content type is JSON and parsing succeeds |
| `url`, `redirected`, `type` | Response metadata; URL falls back to the requested URL |
| `method` | Request method |
| `tagName`, `groupName` | Requested component, for server-component requests |
| `synthetic` | Whether no HTTP response was available |
| `bodyReadError` | Failure to read the body, if any; the HTTP error is retained |

For example, an existing `@handles(InternalServerError)` handler can read
`error.response.body` or `error.response.headers.get("x-error-id")`.
The snapshot is not a Fetch `Response`: its body is an already-read string.
Empty bodies remain empty; malformed JSON remains available as raw text.
Successful responses that fail JSON decoding in `RequestHelper` also retain
their body, or their body-read error.

Network failures use the same interface with `synthetic: true`, `status: 0`,
`statusText: ""`, `ok: false`, `type: "error"`, `redirected: false`, empty headers
and body, plus the known request context. The original exception is in `cause`.
Zero is a sentinel, not an HTTP status returned by a server. Errors constructed
without a response (including local route authentication failures) also have a
synthetic snapshot; unknown request fields are empty.

Response capture does not display server HTML or change initialization/recovery
behavior. Browser-restricted headers are unavailable.

JoltUI wraps errors to add context: *which* method of *which* component failed. The original error
is kept in the standard `cause` property, just like Java's exception chaining:

```typescript
class ValidationError extends Error {
    constructor(readonly fieldErrors: Record<string, string>) {
        super("Validation failed");
        this.name = "ValidationError";
    }
}

// in a component
save(): void {
    throw new ValidationError({ title: "Title is required" });
}
```

The handlers receive a `MethodExecutionError` whose `cause` is the `ValidationError`. Handler
resolution looks through the chain, so `@handles(ValidationError)` is called with the
`ValidationError` itself.

## How a handler is chosen

For each error, the App asks its handler classes **in registration order**. The first class with a
matching method handles the error, and the search stops. Within one class:

1. Take the error.
2. **Exact type match:** look for a method registered for the error's own class; if there is none,
   for its parent class, grandparent, and so on up to `Error`.
3. **`instanceof` match:** otherwise, test the registered types with `instanceof` in discovery
   order. This includes types with a custom `Symbol.hasInstance`, which lets you handle errors
   from libraries such as Zod (`@handles(ZodError)`) without JoltUI depending on them.
4. **Follow the cause:** otherwise, repeat with `error.cause`.

Discovery order is subclass methods before base-class methods, declaration order within a class,
and argument order within `@handles`.

!!! warning "Keep catch-all handlers in a separate class"

    Step 2 walks up to `Error`. A `@handles(Error)` method therefore matches the *outer* wrapper,
    such as `MethodExecutionError`, before the cause is ever inspected. Put specific handlers in
    one class and a catch-all in a second class registered **last**:

    ```typescript
    override readonly errorHandlers = [
        MyErrorHandler,        // specific types, inspects causes
        FallbackErrorHandler,  // @handles(Error): logs and notifies
    ];
    ```

If no class handles an error, it is rethrown and appears in the browser console as an uncaught
error. Nothing is swallowed silently.

### Inheritance between handler classes

- a **decorated** override in a subclass replaces the base method's registration;
- an **undecorated** override removes it (decorators are not inherited);
- unrelated inherited handlers stay active.

Two different effective methods in one class hierarchy cannot register the same error type; the
constructor throws.

## Error pages

`router.showErrorPage()` renders any component as an error page without changing the URL or the
history:

```typescript
@handles(RouteNotFoundError)
async notFound(error: RouteNotFoundError): Promise<void> {
    await this.app.router.showErrorPage(NotFoundPage, {
        error,
        title: "Page not found",
    });
}
```

The error page is an ordinary `@component`. It does not need `@page` and is not registered with
the router:

```typescript
@component({ tagName: "not-found-page" })
export default class NotFoundPage extends CustomElement<MyApp> {
    override markup = () => html`
        <section class="not-found">
            <h1>404</h1>
            <p>Nothing was found at <code>{{! this.app.pathname }}</code>.</p>
            <a href="/">Back to the start</a>
        </section>
    `;
}
```

| Option | Default | Meaning |
| --- | --- | --- |
| `error` | — | The error being handled; see below. |
| `title` | — | Document title (passed through `titleGenerator`). |
| `layout` | base layout | Layout to render the page in. |
| `target` | default target | Target selector inside the layout. |
| `args` | — | Arguments passed to the error page component. |

While an error page is shown, `router.currentRoute` is `null`, route parameters are empty and the
sublayout chain is removed. The normal route start, layout-change and finish events still apply.
Error pages do **not** run authorization, so choose a layout that unauthenticated visitors may
see.

!!! tip "Always pass the `error`"

    The router remembers which navigation produced the error. If the user has started a newer
    navigation by the time a slow handler calls `showErrorPage`, the call is ignored instead of
    replacing the newer page. A new navigation also cancels an error page that is still
    initializing, and showing a second error page while one is initializing is rejected, which
    prevents endless loops when the error page itself fails.

## Initialization errors

When a component fails to initialize, its `initComplete` promise rejects with an
`ElementInitializationError`:

| Property | Description |
| --- | --- |
| `element` | The component instance that failed. |
| `elementName` | Its tag name. |
| `cause` | The underlying error (dependency, hook, render or child failure). |

The same error object propagates unchanged to parent components waiting for the child, and the
error handlers see it once.

The complete list of error classes is in the [error reference](../reference/errors.md).
