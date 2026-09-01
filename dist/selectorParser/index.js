import { SelectorType, parse, stringify, } from "./cssWhat/index.js";
const joltAttributePrefix = ":";
const normalizedAttributePrefix = "data-jolt-";
function transformTokens(selectors) {
    for (const selector of selectors) {
        for (const token of selector) {
            if (token.type === SelectorType.Attribute &&
                token.name?.startsWith(joltAttributePrefix)) {
                token.name =
                    normalizedAttributePrefix +
                        token.name.substring(joltAttributePrefix.length);
            }
            if (token.type === SelectorType.Pseudo &&
                Array.isArray(token.data)) {
                transformTokens(token.data);
            }
        }
    }
}
export function transformSelector(selector) {
    if (!/\[\s*:/.test(selector)) {
        return selector;
    }
    const parsedSelector = parse(selector);
    transformTokens(parsedSelector);
    return stringify(parsedSelector);
}
//# sourceMappingURL=index.js.map