export declare enum Lifecycle {
    EXTENSION_INIT = "extension-init",
    BEFORE_INIT = "before-init",
    BEFORE_INIT_RESOLVE = "before-init-resolve",
    AFTER_INIT = "after-init",
    BEFORE_RERENDER = "before-rerender",
    AFTER_RERENDER = "after-rerender",
    AFTER_DISCONNECT = "after-disconnect"
}
export type LifecycleTarget = object;
export type LifecycleMethod = (this: LifecycleTarget) => void | Promise<void>;
export type RegisteredLifecycleMethod = {
    name: string;
    method: LifecycleMethod;
};
export declare function lifecycle(...stages: Lifecycle[]): <TThis extends LifecycleTarget, TMethod extends (this: TThis, ...args: any[]) => void | Promise<void>>(method: TMethod, context: ClassMethodDecoratorContext<TThis, TMethod>) => void;
export declare function getLifecycleMethods(instance: LifecycleTarget, stage: Lifecycle): readonly RegisteredLifecycleMethod[];
//# sourceMappingURL=lifecycle.d.ts.map