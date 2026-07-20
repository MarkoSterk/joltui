export enum Lifecycle {
    EXTENSION_INIT = "extension-init",
    BEFORE_INIT = "before-init",
    BEFORE_INIT_RESOLVE = "before-init-resolve",
    AFTER_INIT = "after-init",
    BEFORE_RERENDER = "before-rerender",
    AFTER_RERENDER = "after-rerender",
    AFTER_DISCONNECT = "after-disconnect",
}

export type LifecycleTarget = object;

export type LifecycleMethod = (
    this: LifecycleTarget,
) => void | Promise<void>;

const LIFECYCLE_STAGES = Symbol("joltui.lifecycleStages");

type DecoratedLifecycleMethod = LifecycleMethod & {
    [LIFECYCLE_STAGES]?: readonly Lifecycle[];
};

export type RegisteredLifecycleMethod = {
    name: string;
    method: LifecycleMethod;
};

export function lifecycle(...stages: Lifecycle[]) {
    if (stages.length === 0) {
        throw new Error(
            "@lifecycle requires at least one lifecycle stage.",
        );
    }

    const uniqueStages = Object.freeze([...new Set(stages)]);

    return function <
        TThis extends LifecycleTarget,
        TMethod extends (
            this: TThis,
            ...args: any[]
        ) => void | Promise<void>,
    >(
        method: TMethod,
        context: ClassMethodDecoratorContext<TThis, TMethod>,
    ): void {
        if (context.static) {
            throw new TypeError(
                "@lifecycle cannot decorate a static method.",
            );
        }

        if (context.private) {
            throw new TypeError(
                "@lifecycle cannot decorate a private method.",
            );
        }

        if (typeof context.name !== "string") {
            throw new TypeError(
                "@lifecycle does not support symbol-named methods.",
            );
        }

        (
            method as unknown as DecoratedLifecycleMethod
        )[LIFECYCLE_STAGES] = uniqueStages;
    };
}

export function getLifecycleMethods(
    instance: LifecycleTarget,
    stage: Lifecycle,
): readonly RegisteredLifecycleMethod[] {
    const prototypeChain: object[] = [];
    let prototype: object | null = Object.getPrototypeOf(instance);

    while (prototype && prototype !== Object.prototype) {
        prototypeChain.unshift(prototype);
        prototype = Object.getPrototypeOf(prototype);
    }

    const effectiveOwners = new Map<string, object>();

    for (const currentPrototype of [...prototypeChain].reverse()) {
        for (
            const propertyName
            of Object.getOwnPropertyNames(currentPrototype)
        ) {
            if (
                propertyName !== "constructor" &&
                !effectiveOwners.has(propertyName)
            ) {
                effectiveOwners.set(propertyName, currentPrototype);
            }
        }
    }

    const methods: RegisteredLifecycleMethod[] = [];

    for (const currentPrototype of prototypeChain) {
        for (
            const propertyName
            of Object.getOwnPropertyNames(currentPrototype)
        ) {
            if (
                propertyName === "constructor" ||
                effectiveOwners.get(propertyName) !== currentPrototype
            ) {
                continue;
            }

            const descriptor = Object.getOwnPropertyDescriptor(
                currentPrototype,
                propertyName,
            );

            const method = descriptor?.value as
                | DecoratedLifecycleMethod
                | undefined;

            if (
                typeof method !== "function" ||
                !method[LIFECYCLE_STAGES]?.includes(stage)
            ) {
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
