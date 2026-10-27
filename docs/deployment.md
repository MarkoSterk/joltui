# Deployment

A JoltUI application builds to a static bundle: HTML, JavaScript chunks and assets. Any static web
server or CDN can host it, as long as it sends unknown paths to `index.html`.

## Build

```sh
npx vite build
```

The output is written to `dist/`. Preview the production build locally with:

```sh
npx vite preview
```

## The history-API fallback

The router uses the History API, so URLs such as `/posts/42` exist only in the browser. When a
user reloads that page or opens a bookmark, the server receives a request for `/posts/42` and must
answer with `index.html`; the router then renders the right page. Without the fallback, the server
returns its own 404.

=== "nginx"

    ```nginx
    server {
        listen 80;
        root /srv/my-app/dist;

        location / {
            try_files $uri $uri/ /index.html;
        }

        # Hashed assets can be cached forever.
        location /assets/ {
            add_header Cache-Control "public, max-age=31536000, immutable";
        }
    }
    ```

=== "Apache"

    ```apache
    # .htaccess in the dist/ folder
    <IfModule mod_rewrite.c>
        RewriteEngine On
        RewriteBase /
        RewriteRule ^index\.html$ - [L]
        RewriteCond %{REQUEST_FILENAME} !-f
        RewriteCond %{REQUEST_FILENAME} !-d
        RewriteRule . /index.html [L]
    </IfModule>
    ```

=== "Caddy"

    ```caddy
    example.com {
        root * /srv/my-app/dist
        try_files {path} /index.html
        file_server
    }
    ```

=== "Netlify"

    ```text
    # public/_redirects (copied to dist/ by Vite)
    /*    /index.html   200
    ```

=== "Python (Patera)"

    Serve `dist/` as static files and add a catch-all route that returns `index.html` for paths
    that are not API endpoints. Keep API routes under a prefix such as `/api`, so the fallback
    never hides them.

!!! warning "Keep API paths out of the fallback"

    A fallback that answers *everything* with `index.html` turns a mistyped API call into an HTML
    response with status `200`. Exclude your API prefix (and the server-components endpoint) from
    the fallback, so they return proper errors.

## Hosting below a path

To serve the application from a sub-path such as `/portal/`, configure both the build and the
router:

```typescript title="vite.config.ts"
export default defineConfig({
    base: "/portal/",
    plugins: [/* ... */],
});
```

```typescript title="src/app/app.ts"
return new MyRouter({
    app: this,
    baseLayout: MainLayout,
    defaultTarget: "#page",
    baseUrl: "/portal",
});
```

`base` makes Vite emit asset URLs below `/portal/`; `baseUrl` prefixes every page path. Links in
templates must contain the full path (`/portal/about`), or use
`router.redirect(path, { useBaseUrl: true })` for programmatic navigation. See
[Base URLs](guide/routing.md#base-urls).

## Checklist

- [x] **Configure the history-API fallback** and test a reload on a deep URL.
- [x] **Exclude API paths** from the fallback.
- [x] **Cache hashed assets** (`/assets/*`) for a long time; serve `index.html` with
  `Cache-Control: no-cache` so users pick up new releases.
- [x] **Enforce authorization on the server.** [`@auth`](guide/authentication.md) only guards the
  user interface.
- [x] **Escape untrusted data** in templates with `{{! }}`
  ([Templates](guide/templates.md#escaping-and-security)), and consider a Content Security Policy.
- [x] **Point `serverComponentsUrl`** at the production endpoint, if you use
  [server components](guide/server-components.md). Requests include credentials, so the endpoint
  must be same-origin or configured for credentialed CORS.
- [x] **Register an error handler** for `RouteNotFoundError`, so unknown URLs show a proper page
  ([Error pages](guide/error-handling.md#error-pages)).
- [x] **Build with the same TypeScript settings** as in development (standard decorators,
  `useDefineForClassFields`).
