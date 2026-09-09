import type App from "./app.js";
import {
    CustomElement,
    type CustomElementClass,
} from "./customElement.js";
import { requireElementMetadata } from "./elementMetadata.js";

let generatedPages: readonly CustomElementClass[] | null = null;

export function registerGeneratedPages(
    pages: readonly CustomElementClass[],
): void {
    if (!Array.isArray(pages)) {
        throw new TypeError("Generated JoltUI pages must be an array.");
    }

    const uniquePages = new Set<CustomElementClass>();

    for (const pageClass of pages) {
        if (
            typeof pageClass !== "function" ||
            !(pageClass.prototype instanceof CustomElement)
        ) {
            throw new TypeError(
                "Generated JoltUI pages must contain CustomElement classes.",
            );
        }

        const metadata = requireElementMetadata(pageClass);
        if (metadata.kind !== "page") {
            throw new TypeError(
                `Generated element '${pageClass.name}' must use @page.`,
            );
        }

        if (uniquePages.has(pageClass)) {
            throw new Error(
                `Generated page '${pageClass.name}' was registered more than once.`,
            );
        }
        uniquePages.add(pageClass);
    }

    generatedPages = Object.freeze([...uniquePages]);
}

export function getGeneratedPages<
    TApp extends App = App,
>(): readonly CustomElementClass<TApp>[] | null {
    return generatedPages as readonly CustomElementClass<TApp>[] | null;
}
