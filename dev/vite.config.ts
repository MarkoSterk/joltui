import { fileURLToPath, URL } from "node:url";
import ts from "typescript";
import { defineConfig } from "vite";
import minifyHTMLLiterals from
    "@lit-labs/rollup-plugin-minify-html-literals";
import {
    vitePluginTypescriptTransform,
} from "vite-plugin-typescript-transform";

export default defineConfig({
    root: fileURLToPath(
        new URL(".", import.meta.url),
    ),

    plugins: [
        {
            ...minifyHTMLLiterals({
                include: ["**/*.ts"],
                failOnError: true,
            }),
            apply: "build",
            enforce: "pre",
        },
        vitePluginTypescriptTransform({
            enforce: "pre",

            filter: {
                files: {
                    include: /\.ts$/,
                },
            },

            tsconfig: {
                override: {
                target: ts.ScriptTarget.ES2022,
                module: ts.ModuleKind.ESNext,
                moduleResolution:
                    ts.ModuleResolutionKind.Bundler,
                experimentalDecorators: false,
                useDefineForClassFields: true,
                sourceMap: true,
                inlineSources: true,
            },
            },
        }),
    ],

    resolve: {
        alias: {
            joltui: fileURLToPath(
                new URL("../src/index.ts", import.meta.url),
            ),
        },
    },

    server: {
        port: 5173,
        open: true,
    },

    build: {
        target: "es2022",
        outDir: fileURLToPath(
            new URL("../dev-dist", import.meta.url),
        ),
        emptyOutDir: true,
        cssCodeSplit: true,
        manifest: true,
        modulePreload: {
            polyfill: true,
        },
        rolldownOptions: {
            output: {
                entryFileNames:
                    "assets/[name]-[hash].js",
                chunkFileNames:
                    "assets/chunks/[name]-[hash].js",
                assetFileNames:
                    "assets/[name]-[hash][extname]",
            },
        },
    },
});
