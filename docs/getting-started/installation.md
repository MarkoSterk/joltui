# Installation

## Requirements

- a modern browser with Custom Elements and the History API;
- **TypeScript 5** with *standard* decorators (the TC39 proposal, not `experimentalDecorators`);
- an ES-module build tool. The documentation uses **Vite**.

## Create the project

```sh
mkdir my-app && cd my-app
npm init -y
npm install joltui
npm install --save-dev typescript vite \
    vite-plugin-typescript-transform joltui-vite-plugin
```

- `joltui-vite-plugin` discovers pages automatically ([Vite plugin](../guide/vite-plugin.md)).
  It is optional; without it you list the pages on the router yourself.
- `vite-plugin-typescript-transform` compiles TypeScript with the TypeScript compiler itself, so
  standard decorators and `accessor` fields are emitted exactly as TypeScript defines them.

## TypeScript configuration

The important options are the ES2022 target, `useDefineForClassFields` and the absence of
`experimentalDecorators`:

```json title="tsconfig.json"
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "useDefineForClassFields": true,
    "experimentalDecorators": false,
    "noEmit": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*.ts", "vite.config.ts"]
}
```

!!! warning "`experimentalDecorators` must be off"

    JoltUI's decorators follow the standard decorator signature. With
    `experimentalDecorators: true`, TypeScript emits the legacy form and the decorators fail.

## Vite configuration

```typescript title="vite.config.ts"
import ts from "typescript";
import { defineConfig } from "vite";
import joltui from "joltui-vite-plugin";
import { vitePluginTypescriptTransform } from "vite-plugin-typescript-transform";

export default defineConfig({
    plugins: [
        joltui(),
        vitePluginTypescriptTransform({
            enforce: "pre",
            filter: { files: { include: /\.ts$/ } },
            tsconfig: {
                override: {
                    target: ts.ScriptTarget.ES2022,
                    experimentalDecorators: false,
                    useDefineForClassFields: true,
                },
            },
        }),
    ],
    build: { target: "es2022" },
});
```

## The HTML page

JoltUI renders into a single container element. Everything else in `index.html` is ordinary
HTML: style sheets, fonts, analytics and so on.

```html title="index.html"
<!doctype html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>My App</title>
</head>
<body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

Continue with the [quickstart](quickstart.md).
