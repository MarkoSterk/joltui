import {
    SelectorType,
    parse,
    stringify,
} from "./cssWhat/index.js";

type SelectorToken = {
    type: string;
    name?: string;
    data?: string | ParsedSelector | null;
};

type ParsedSelector = SelectorToken[][];

const joltAttributePrefix = ":";
const normalizedAttributePrefix = "data-jolt-";

function transformTokens(
    selectors: ParsedSelector,
): void {
    for (const selector of selectors) {
        for (const token of selector) {
            if (
                token.type === SelectorType.Attribute &&
                token.name?.startsWith(
                    joltAttributePrefix,
                )
            ) {
                token.name =
                    normalizedAttributePrefix +
                    token.name.substring(
                        joltAttributePrefix.length,
                    );
            }

            if (
                token.type === SelectorType.Pseudo &&
                Array.isArray(token.data)
            ) {
                transformTokens(token.data);
            }
        }
    }
}

export function transformSelector(
    selector: string,
): string {
    if (!/\[\s*:/.test(selector)) {
        return selector;
    }

    const parsedSelector =
        parse(selector) as ParsedSelector;

    transformTokens(parsedSelector);

    return stringify(parsedSelector);
}
