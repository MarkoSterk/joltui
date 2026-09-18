export type LazyImportLoader<TModule = unknown> = () => Promise<TModule>;
export type LazyDependency<TModule = unknown> = Readonly<{
    name: string | null;
    load(): Promise<TModule>;
    preload(): Promise<TModule>;
}>;
export declare class DependencyLoadError extends Error {
    readonly dependencyName: string | null;
    constructor(dependencyName: string | null, options?: ErrorOptions);
}
export declare function lazy<TModule>(loader: LazyImportLoader<TModule>, dependencyName?: string): LazyDependency<TModule>;
//# sourceMappingURL=lazy.d.ts.map