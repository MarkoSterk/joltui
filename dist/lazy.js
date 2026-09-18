export class DependencyLoadError extends Error {
    dependencyName;
    constructor(dependencyName, options) {
        super(dependencyName
            ? `Failed to load lazy dependency '${dependencyName}'.`
            : "Failed to load a lazy dependency.", options);
        this.name = "DependencyLoadError";
        this.dependencyName = dependencyName;
    }
}
export function lazy(loader, dependencyName) {
    if (typeof loader !== "function") {
        throw new TypeError("Lazy dependency loader must be a function.");
    }
    if (dependencyName !== undefined &&
        (typeof dependencyName !== "string" ||
            dependencyName.trim().length === 0)) {
        throw new TypeError("Lazy dependency name must be a non-empty string or undefined.");
    }
    const name = dependencyName?.trim() || null;
    let pending = null;
    const load = () => {
        if (pending) {
            return pending;
        }
        pending = Promise.resolve()
            .then(loader)
            .catch((cause) => {
            pending = null;
            throw new DependencyLoadError(name, { cause });
        });
        return pending;
    };
    return Object.freeze({
        name,
        load,
        preload: load,
    });
}
//# sourceMappingURL=lazy.js.map