export type LazyImportLoader<TModule = unknown> =
    () => Promise<TModule>;

export type LazyDependency<TModule = unknown> =
    Readonly<{
        name: string | null;
        load(): Promise<TModule>;
        preload(): Promise<TModule>;
    }>;

export class DependencyLoadError extends Error {
    readonly dependencyName: string | null;

    constructor(
        dependencyName: string | null,
        options?: ErrorOptions,
    ) {
        super(
            dependencyName
                ? `Failed to load lazy dependency '${dependencyName}'.`
                : "Failed to load a lazy dependency.",
            options,
        );
        this.name = "DependencyLoadError";
        this.dependencyName = dependencyName;
    }
}

export function lazy<TModule>(
    loader: LazyImportLoader<TModule>,
    dependencyName?: string,
): LazyDependency<TModule> {
    if (typeof loader !== "function") {
        throw new TypeError(
            "Lazy dependency loader must be a function.",
        );
    }

    if (
        dependencyName !== undefined &&
        (
            typeof dependencyName !== "string" ||
            dependencyName.trim().length === 0
        )
    ) {
        throw new TypeError(
            "Lazy dependency name must be a non-empty string or undefined.",
        );
    }

    const name = dependencyName?.trim() || null;

    let pending: Promise<TModule> | null = null;

    const load = (): Promise<TModule> => {
        if (pending) {
            return pending;
        }

        pending = Promise.resolve()
            .then(loader)
            .catch((cause: unknown) => {
                pending = null;

                throw new DependencyLoadError(
                    name,
                    { cause },
                );
            });

        return pending;
    };

    return Object.freeze({
        name,
        load,
        preload: load,
    });
}
