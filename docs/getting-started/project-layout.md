# Project layout

JoltUI does not prescribe a folder structure, but the following layout keeps the roles of the
files obvious and matches the examples in this documentation:

```text
my-app/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── src/
    ├── main.ts                 creates the App and calls init()
    └── app/
        ├── app.ts              MyApp extends App<MyApp>
        ├── router.ts           MyRouter extends Router<MyApp>
        ├── errorHandler.ts     MyErrorHandler extends ErrorHandler<MyApp>
        ├── types.ts            shared types (User, Post, ...)
        ├── dependencies.ts     shared lazy() dependencies
        ├── layouts/
        │   └── mainLayout.ts
        ├── pages/
        │   ├── homePage.ts
        │   └── aboutPage.ts
        ├── components/
        │   └── counterButton.ts
        └── errorPages/
            └── notFoundPage.ts
```

| File | Role |
| --- | --- |
| `main.ts` | Entry point. The [Vite plugin](../guide/vite-plugin.md) injects the page registry here. |
| `app.ts` | The [application class](../guide/application.md): router, error handlers, app-level hooks. |
| `router.ts` | The [router subclass](../guide/routing.md): authentication checks and title generation. |
| `errorHandler.ts` | [Error handlers](../guide/error-handling.md). |
| `layouts/` | Components decorated with [`@layout`](../guide/layouts.md). |
| `pages/` | Components decorated with [`@page`](../guide/routing.md), one per file, default-exported. |
| `components/` | Ordinary [components](../guide/components.md). |
| `errorPages/` | Components shown with [`router.showErrorPage()`](../guide/error-handling.md#error-pages). |

## Conventions

- **One page per module, as the default export.** The Vite plugin requires it, and it makes the
  route table easy to read.
- **Type the application everywhere.** Declare components as `CustomElement<MyApp>`, routers as
  `Router<MyApp>` and handlers as `ErrorHandler<MyApp>`. `this.app` is then typed as your own
  class.
- **Import components where they are used.** Importing a module is what registers its custom
  element.
- **Use `import type` for the application class** in components, to avoid circular runtime
  imports between `app.ts` and the modules it references.

## The demo application

The JoltUI repository contains *Fieldnotes*, a complete demo in `dev/`: a story list, article
pages, a login, a protected drafts area and a profile section with a sublayout. Run it with:

```sh
npm install
npm run dev
```
