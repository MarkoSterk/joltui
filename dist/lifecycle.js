export var Lifecycle;
(function (Lifecycle) {
    Lifecycle["EXTENSION_INIT"] = "extension-init";
    Lifecycle["BEFORE_INIT"] = "before-init";
    Lifecycle["BEFORE_INIT_RESOLVE"] = "before-init-resolve";
    Lifecycle["AFTER_INIT"] = "after-init";
    Lifecycle["BEFORE_RERENDER"] = "before-rerender";
    Lifecycle["AFTER_RERENDER"] = "after-rerender";
    Lifecycle["AFTER_DISCONNECT"] = "after-disconnect";
})(Lifecycle || (Lifecycle = {}));
const LIFECYCLE_STAGES = Symbol("joltui.lifecycleStages");
export function lifecycle(...stages) {
    if (stages.length === 0) {
        throw new Error("@lifecycle requires at least one lifecycle stage.");
    }
    const uniqueStages = Object.freeze([...new Set(stages)]);
    return function (method, context) {
        if (context.static) {
            throw new TypeError("@lifecycle cannot decorate a static method.");
        }
        if (context.private) {
            throw new TypeError("@lifecycle cannot decorate a private method.");
        }
        if (typeof context.name !== "string") {
            throw new TypeError("@lifecycle does not support symbol-named methods.");
        }
        method[LIFECYCLE_STAGES] = uniqueStages;
    };
}
export function getLifecycleMethods(instance, stage) {
    const prototypeChain = [];
    let prototype = Object.getPrototypeOf(instance);
    while (prototype && prototype !== Object.prototype) {
        prototypeChain.unshift(prototype);
        prototype = Object.getPrototypeOf(prototype);
    }
    const effectiveOwners = new Map();
    for (const currentPrototype of [...prototypeChain].reverse()) {
        for (const propertyName of Object.getOwnPropertyNames(currentPrototype)) {
            if (propertyName !== "constructor" &&
                !effectiveOwners.has(propertyName)) {
                effectiveOwners.set(propertyName, currentPrototype);
            }
        }
    }
    const methods = [];
    for (const currentPrototype of prototypeChain) {
        for (const propertyName of Object.getOwnPropertyNames(currentPrototype)) {
            if (propertyName === "constructor" ||
                effectiveOwners.get(propertyName) !== currentPrototype) {
                continue;
            }
            const descriptor = Object.getOwnPropertyDescriptor(currentPrototype, propertyName);
            const method = descriptor?.value;
            if (typeof method !== "function" ||
                !method[LIFECYCLE_STAGES]?.includes(stage)) {
                continue;
            }
            methods.push({
                name: propertyName,
                method,
            });
        }
    }
    return methods;
}
//# sourceMappingURL=lifecycle.js.map