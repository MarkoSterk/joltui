function assertAccessor(context, decoratorName) {
    if (context.static) {
        throw new TypeError(`${decoratorName} cannot decorate a static accessor.`);
    }
    if (context.private) {
        throw new TypeError(`${decoratorName} cannot decorate a private accessor.`);
    }
    if (typeof context.name !== "string") {
        throw new TypeError(`${decoratorName} does not support symbol-named accessors.`);
    }
    return context.name;
}
function assertNonEmptyString(value, errorMessage) {
    const normalizedValue = value.trim();
    if (!normalizedValue) {
        throw new TypeError(errorMessage);
    }
    return normalizedValue;
}
function cloneInitialValue(value) {
    if (value === undefined ||
        value === null) {
        return value;
    }
    return structuredClone(value);
}
function createEmptyNodeList() {
    return document.querySelectorAll(":not(*)");
}
export function react(initialValue, bindingName) {
    return function (target, context) {
        const propertyName = assertAccessor(context, "@react");
        const binding = bindingName?.trim() ||
            propertyName;
        return {
            init() {
                return cloneInitialValue(initialValue);
            },
            get() {
                return target.get.call(this);
            },
            set(value) {
                const previousValue = target.get.call(this);
                if (Object.is(previousValue, value)) {
                    return;
                }
                target.set.call(this, value);
                this.invalidate(binding);
            },
        };
    };
}
export function reactFactory(initialValueFactory, bindingName) {
    if (typeof initialValueFactory !==
        "function") {
        throw new TypeError("@reactFactory requires an initial-value factory.");
    }
    return function (target, context) {
        const propertyName = assertAccessor(context, "@reactFactory");
        const binding = bindingName?.trim() ||
            propertyName;
        return {
            init() {
                return initialValueFactory();
            },
            get() {
                return target.get.call(this);
            },
            set(value) {
                const previousValue = target.get.call(this);
                if (Object.is(previousValue, value)) {
                    return;
                }
                target.set.call(this, value);
                this.invalidate(binding);
            },
        };
    };
}
export function queryParam(parameterName, defaultValue = null, bindingName) {
    const normalizedName = assertNonEmptyString(parameterName, "Query parameter name cannot be empty.");
    const binding = bindingName?.trim() ||
        `query-${normalizedName}`;
    const queryBinding = `query.${normalizedName}`;
    return function (_target, context) {
        assertAccessor(context, "@queryParam");
        return {
            init() {
                return defaultValue;
            },
            get() {
                const value = this.app
                    .queryParameters[normalizedName];
                return (value ??
                    defaultValue);
            },
            set(value) {
                this.app
                    .updateQueryParameters({
                    [normalizedName]: value,
                });
                if (binding !== queryBinding) {
                    this.invalidate(binding);
                }
            },
        };
    };
}
export function select(selector, options = {}) {
    const normalizedSelector = assertNonEmptyString(selector, "Query selector cannot be empty.");
    return function (_target, context) {
        const propertyName = assertAccessor(context, "@select");
        return {
            init() {
                return null;
            },
            get() {
                const element = this.querySelector(normalizedSelector);
                if (element === null &&
                    options.required) {
                    throw new Error(`Required element '${normalizedSelector}' ` +
                        `for property '${propertyName}' was not found.`);
                }
                return element;
            },
            set() {
                throw new TypeError(`Selected element property ` +
                    `'${propertyName}' is read-only.`);
            },
        };
    };
}
export function selectAll(selector, options = {}) {
    const normalizedSelector = assertNonEmptyString(selector, "Query selector cannot be empty.");
    return function (_target, context) {
        const propertyName = assertAccessor(context, "@selectAll");
        return {
            init() {
                return createEmptyNodeList();
            },
            get() {
                const elements = this.querySelectorAll(normalizedSelector);
                if (options.required &&
                    elements.length === 0) {
                    throw new Error(`No elements matching ` +
                        `'${normalizedSelector}' were found ` +
                        `for required property '${propertyName}'.`);
                }
                return elements;
            },
            set() {
                throw new TypeError(`Selected elements property ` +
                    `'${propertyName}' is read-only.`);
            },
        };
    };
}
//# sourceMappingURL=properties.js.map