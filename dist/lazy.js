export class DependencyLoadError extends Error {
    constructor(options) {
        super("Failed to load a lazy dependency.", options);
        this.name = "DependencyLoadError";
    }
}
export function lazy(loader) {
    if (typeof loader !== "function") {
        throw new TypeError("Lazy dependency loader must be a function.");
    }
    let pending = null;
    const load = () => {
        if (pending) {
            return pending;
        }
        pending = Promise.resolve()
            .then(loader)
            .catch((cause) => {
            pending = null;
            throw new DependencyLoadError({
                cause,
            });
        });
        return pending;
    };
    return Object.freeze({
        load,
        preload: load,
    });
}
//# sourceMappingURL=lazy.js.map