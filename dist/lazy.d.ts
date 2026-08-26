export type LazyImportLoader<TModule = unknown> = () => Promise<TModule>;
export type LazyDependency<TModule = unknown> = Readonly<{
    load(): Promise<TModule>;
    preload(): Promise<TModule>;
}>;
export declare class DependencyLoadError extends Error {
    constructor(options?: ErrorOptions);
}
export declare function lazy<TModule>(loader: LazyImportLoader<TModule>): LazyDependency<TModule>;
//# sourceMappingURL=lazy.d.ts.map