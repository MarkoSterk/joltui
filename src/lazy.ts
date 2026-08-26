export type LazyImportLoader<TModule = unknown> =
    () => Promise<TModule>;

export type LazyDependency<TModule = unknown> =
    Readonly<{
        load(): Promise<TModule>;
        preload(): Promise<TModule>;
    }>;

export class DependencyLoadError extends Error {
    constructor(options?: ErrorOptions) {
        super(
            "Failed to load a lazy dependency.",
            options,
        );
        this.name = "DependencyLoadError";
    }
}

export function lazy<TModule>(
    loader: LazyImportLoader<TModule>,
): LazyDependency<TModule> {
    if (typeof loader !== "function") {
        throw new TypeError(
            "Lazy dependency loader must be a function.",
        );
    }

    let pending: Promise<TModule> | null = null;

    const load = (): Promise<TModule> => {
        if (pending) {
            return pending;
        }

        pending = Promise.resolve()
            .then(loader)
            .catch((cause: unknown) => {
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
