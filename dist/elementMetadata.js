const elementMetadata = new WeakMap();
const customElementNamePattern = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)+$/;
function assertClassDecorator(context) {
    if (context.kind !== "class") {
        throw new TypeError("Element decorators can only decorate classes.");
    }
}
function assertComponentConfigs(configs) {
    if (!configs ||
        typeof configs !== "object") {
        throw new TypeError("Component configuration is required.");
    }
    if (typeof configs.tagName !== "string" ||
        !customElementNamePattern.test(configs.tagName)) {
        throw new TypeError(`Invalid custom element tag name ` +
            `'${String(configs.tagName)}'.`);
    }
    assertOptionalName(configs.dataField, "dataField");
    assertOptionalName(configs.groupName, "groupName");
    if (configs.useServer !== undefined &&
        configs.useServer !== null &&
        typeof configs.useServer !== "boolean") {
        throw new TypeError("useServer must be a boolean, null, or undefined.");
    }
    if (configs.cacheDuration !== undefined &&
        (typeof configs.cacheDuration !== "number" ||
            !Number.isFinite(configs.cacheDuration) ||
            configs.cacheDuration < 0)) {
        throw new TypeError("cacheDuration must be a finite, non-negative number or undefined.");
    }
    if (configs.cache !== undefined &&
        typeof configs.cache !== "boolean") {
        throw new TypeError("cache must be a boolean or undefined.");
    }
}
function assertOptionalName(value, propertyName) {
    if (value !== undefined &&
        value !== null &&
        (typeof value !== "string" ||
            value.trim().length === 0)) {
        throw new TypeError(`${propertyName} must be a non-empty ` +
            `string, null, or undefined.`);
    }
}
function assertPageConfigs(configs) {
    if (!configs ||
        typeof configs !== "object") {
        throw new TypeError("Page configuration is required.");
    }
    if (typeof configs.path !== "string" ||
        configs.path.trim().length === 0 ||
        !configs.path.startsWith("/")) {
        throw new TypeError("Page path must be a non-empty string " +
            "starting with '/'.");
    }
    assertOptionalName(configs.title, "title");
    assertOptionalName(configs.target, "target");
    if (configs.subLayouts !== undefined &&
        configs.subLayouts !== null) {
        if (!Array.isArray(configs.subLayouts)) {
            throw new TypeError("Page subLayouts must be an array, null, or undefined.");
        }
        for (const [index, subLayout] of configs.subLayouts.entries()) {
            if (!subLayout ||
                typeof subLayout !== "object") {
                throw new TypeError(`Page subLayouts[${index}] must be an object.`);
            }
            if (typeof subLayout.target !== "string" ||
                subLayout.target.trim().length === 0) {
                throw new TypeError(`Page subLayouts[${index}].target must be ` +
                    "a non-empty selector.");
            }
            if (typeof subLayout.layout !== "function") {
                throw new TypeError(`Page subLayouts[${index}].layout must be ` +
                    "a CustomElement class.");
            }
        }
    }
    if (configs.extras !== undefined &&
        configs.extras !== null &&
        (typeof configs.extras !== "object" ||
            Array.isArray(configs.extras))) {
        throw new TypeError("Page extras must be an object, null, or undefined.");
    }
}
function defineTagName(elementClass, tagName) {
    Object.defineProperty(elementClass, "tagName", {
        configurable: false,
        enumerable: true,
        writable: false,
        value: tagName,
    });
}
function setElementMetadata(elementClass, metadata) {
    elementMetadata.set(elementClass, Object.freeze(metadata));
}
export function setElementAuthenticationMetadata(elementClass, authentication) {
    const metadata = elementMetadata.get(elementClass);
    if (!metadata ||
        (metadata.kind !== "page" &&
            metadata.kind !== "layout")) {
        throw new TypeError("@auth requires @page or @layout to be applied below it.");
    }
    setElementMetadata(elementClass, {
        ...metadata,
        authentication: Object.freeze({
            authenticationRequired: authentication.authenticationRequired,
            rolesRequired: Object.freeze([
                ...authentication.rolesRequired,
            ]),
        }),
    });
}
function requireComponentMetadata(elementClass, decoratorName) {
    const metadata = elementMetadata.get(elementClass);
    if (!metadata) {
        throw new TypeError(`@${decoratorName} requires @component ` +
            `to be applied below it.`);
    }
    if (metadata.kind !== "component") {
        throw new TypeError(`@${decoratorName} cannot be applied to ` +
            `an element already decorated as ` +
            `'${metadata.kind}'.`);
    }
    return metadata;
}
export function component(configs) {
    assertComponentConfigs(configs);
    return function componentDecorator(elementClass, context) {
        assertClassDecorator(context);
        if (elementMetadata.has(elementClass)) {
            throw new TypeError(`Element '${context.name ?? configs.tagName}' ` +
                `already has component metadata.`);
        }
        defineTagName(elementClass, configs.tagName);
        setElementMetadata(elementClass, {
            kind: "component",
            tagName: configs.tagName,
            dataField: configs.dataField ?? null,
            groupName: configs.groupName ?? null,
            useServer: configs.useServer ?? null,
            cache: configs.cache ?? false,
            cacheDuration: configs.cacheDuration ?? null,
        });
        context.addInitializer(() => {
            const registered = customElements.get(configs.tagName);
            if (registered) {
                if (registered !== elementClass) {
                    throw new Error(`Custom element ` +
                        `'${configs.tagName}' is already ` +
                        `registered with another constructor.`);
                }
                return;
            }
            customElements.define(configs.tagName, elementClass);
        });
    };
}
export function page(pathOrConfigs) {
    const configs = typeof pathOrConfigs === "string"
        ? { path: pathOrConfigs }
        : pathOrConfigs;
    assertPageConfigs(configs);
    return function pageDecorator(elementClass, context) {
        assertClassDecorator(context);
        const componentMetadata = requireComponentMetadata(elementClass, "page");
        const authentication = configs.authentication
            ? Object.freeze({
                authenticationRequired: configs.authentication
                    .authenticationRequired,
                rolesRequired: Object.freeze([
                    ...configs.authentication
                        .rolesRequired,
                ]),
            })
            : null;
        setElementMetadata(elementClass, {
            ...componentMetadata,
            kind: "page",
            path: configs.path,
            layout: configs.layout ?? null,
            subLayouts: Object.freeze((configs.subLayouts ?? []).map(subLayout => Object.freeze({
                target: subLayout.target
                    .trim(),
                layout: subLayout.layout,
            }))),
            title: configs.title ?? null,
            target: configs.target ?? null,
            extras: Object.freeze({
                ...(configs.extras ?? {}),
            }),
            authentication,
        });
    };
}
export function layout(elementClass, context) {
    assertClassDecorator(context);
    const componentMetadata = requireComponentMetadata(elementClass, "layout");
    setElementMetadata(elementClass, {
        ...componentMetadata,
        kind: "layout",
        authentication: null,
    });
}
export function getElementMetadata(elementClass) {
    return elementMetadata.get(elementClass) ?? null;
}
export function requireElementMetadata(elementClass) {
    const metadata = getElementMetadata(elementClass);
    if (!metadata) {
        throw new TypeError(`Element '${elementClass.name}' must use @component.`);
    }
    return metadata;
}
//# sourceMappingURL=elementMetadata.js.map