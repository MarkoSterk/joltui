// @ts-nocheck
import { parse, stringify } from "./cssWhat/index.js";
function escapeAttributeNames(astTokens) {
    return astTokens.map(tokenOrGroup => {
        if (Array.isArray(tokenOrGroup)) {
            return escapeAttributeNames(tokenOrGroup);
        }
        if (tokenOrGroup.type === 'attribute') {
            let attributeName = tokenOrGroup.name.replace(/:/g, 'data-df-');
            attributeName = attributeName.replace(/@/g, 'df-');
            return {
                ...tokenOrGroup,
                name: attributeName
            };
        }
        return { ...tokenOrGroup };
    });
}
function transformSelector(selector) {
    const ast = parse(selector);
    const escaped = escapeAttributeNames(ast);
    return stringify(escaped);
}
export { transformSelector, escapeAttributeNames };
//# sourceMappingURL=index.js.map