import { fileURLToPath, URL } from "node:url";
import ts from "typescript";
import { defineConfig } from "vite";
import {
    vitePluginTypescriptTransform,
} from "vite-plugin-typescript-transform";

export default defineConfig({
    root: fileURLToPath(
        new URL(".", import.meta.url),
    ),

    plugins: [
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
    },
});