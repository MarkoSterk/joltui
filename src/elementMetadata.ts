import type App from "./app.js";
import type {
    CustomElement,
    CustomElementClass,
} from "./customElement.js";

export type ElementKind =
    | "component"
    | "page"
    | "layout";

export type ComponentConfigs = {
    tagName: string;
    dataField?: string | null;
    groupName?: string | null;
    useServer?: boolean | null;
    cache?: boolean;
    cacheDuration?: number;
};

export type AuthenticationMetadata = Readonly<{
    authenticationRequired: boolean;
    rolesRequired: readonly unknown[];
}>;

export type SubLayoutConfig<
    TApp extends App = App,
> = Readonly<{
    target: string;
    layout: CustomElementClass<TApp>;
}>;

export type PageConfigs<
    TApp extends App = App,
> = {
    path: string;
    layout?: CustomElementClass<TApp> | null;
    subLayouts?:
        readonly SubLayoutConfig<TApp>[] | null;
    title?: string | null;
    target?: string | null;
    extras?: Record<string, unknown> | null;
    authentication?: AuthenticationMetadata | null;
};

type BaseElementMetadata = Readonly<{
    tagName: string;
    dataField: string | null;
    groupName: string | null;
    useServer: boolean | null;
    cache: boolean;
    cacheDuration: number | null;
}>;

export type ComponentMetadata =
    BaseElementMetadata &
    Readonly<{
        kind: "component";
    }>;

export type LayoutMetadata =
    BaseElementMetadata &
    Readonly<{
        kind: "layout";
        authentication: AuthenticationMetadata | null;
    }>;

export type PageMetadata<
    TApp extends App = App,
> =
    BaseElementMetadata &
    Readonly<{
        kind: "page";
        path: string;
        layout: CustomElementClass<TApp> | null;
        subLayouts:
            readonly SubLayoutConfig<TApp>[];
        title: string | null;
        target: string | null;
        extras: Readonly<Record<string, unknown>>;
        authentication: AuthenticationMetadata | null;
    }>;

export type ElementMetadata<
    TApp extends App = App,
> =
    | ComponentMetadata
    | LayoutMetadata
    | PageMetadata<TApp>;

type DecoratedElementClass<
    TApp extends App = App,
> = CustomElementClass<
    TApp,
    CustomElement<TApp>
>;

const elementMetadata =
    new WeakMap<Function, ElementMetadata>();

const customElementNamePattern =
    /^[a-z][a-z0-9]*(?:-[a-z0-9]+)+$/;

function assertClassDecorator(
    context: ClassDecoratorContext,
): void {
    if (context.kind !== "class") {
        throw new TypeError(
            "Element decorators can only decorate classes.",
        );
    }
}

function assertComponentConfigs(
    configs: ComponentConfigs,
): void {
    if (
        !configs ||
        typeof configs !== "object"
    ) {
        throw new TypeError(
            "Component configuration is required.",
        );
    }

    if (
        typeof configs.tagName !== "string" ||
        !customElementNamePattern.test(
            configs.tagName,
        )
    ) {
        throw new TypeError(
            `Invalid custom element tag name ` +
            `'${String(configs.tagName)}'.`,
        );
    }

    assertOptionalName(
        configs.dataField,
        "dataField",
    );

    assertOptionalName(
        configs.groupName,
        "groupName",
    );

    if (
        configs.useServer !== undefined &&
        configs.useServer !== null &&
        typeof configs.useServer !== "boolean"
    ) {
        throw new TypeError(
            "useServer must be a boolean, null, or undefined.",
        );
    }

    if (
        configs.cacheDuration !== undefined &&
        (
            typeof configs.cacheDuration !== "number" ||
            !Number.isFinite(configs.cacheDuration) ||
            configs.cacheDuration < 0
        )
    ) {
        throw new TypeError(
            "cacheDuration must be a finite, non-negative number or undefined.",
        );
    }

    if (
        configs.cache !== undefined &&
        typeof configs.cache !== "boolean"
    ) {
        throw new TypeError(
            "cache must be a boolean or undefined.",
        );
    }
}

function assertOptionalName(
    value: string | null | undefined,
    propertyName: string,
): void {
    if (
        value !== undefined &&
        value !== null &&
        (
            typeof value !== "string" ||
            value.trim().length === 0
        )
    ) {
        throw new TypeError(
            `${propertyName} must be a non-empty ` +
            `string, null, or undefined.`,
        );
    }
}

function assertPageConfigs(
    configs: PageConfigs,
): void {
    if (
        !configs ||
        typeof configs !== "object"
    ) {
        throw new TypeError(
            "Page configuration is required.",
        );
    }

    if (
        typeof configs.path !== "string" ||
        configs.path.trim().length === 0 ||
        !configs.path.startsWith("/")
    ) {
        throw new TypeError(
            "Page path must be a non-empty string " +
            "starting with '/'.",
        );
    }

    assertOptionalName(
        configs.title,
        "title",
    );

    assertOptionalName(
        configs.target,
        "target",
    );

    if (
        configs.subLayouts !== undefined &&
        configs.subLayouts !== null
    ) {
        if (!Array.isArray(configs.subLayouts)) {
            throw new TypeError(
                "Page subLayouts must be an array, null, or undefined.",
            );
        }

        for (
            const [index, subLayout]
            of configs.subLayouts.entries()
        ) {
            if (
                !subLayout ||
                typeof subLayout !== "object"
            ) {
                throw new TypeError(
                    `Page subLayouts[${index}] must be an object.`,
                );
            }

            if (
                typeof subLayout.target !== "string" ||
                subLayout.target.trim().length === 0
            ) {
                throw new TypeError(
                    `Page subLayouts[${index}].target must be ` +
                    "a non-empty selector.",
                );
            }

            if (
                typeof subLayout.layout !== "function"
            ) {
                throw new TypeError(
                    `Page subLayouts[${index}].layout must be ` +
                    "a CustomElement class.",
                );
            }
        }
    }

    if (
        configs.extras !== undefined &&
        configs.extras !== null &&
        (
            typeof configs.extras !== "object" ||
            Array.isArray(configs.extras)
        )
    ) {
        throw new TypeError(
            "Page extras must be an object, null, or undefined.",
        );
    }
}

function defineTagName(
    elementClass: Function,
    tagName: string,
): void {
    Object.defineProperty(
        elementClass,
        "tagName",
        {
            configurable: false,
            enumerable: true,
            writable: false,
            value: tagName,
        },
    );
}

function setElementMetadata(
    elementClass: Function,
    metadata: ElementMetadata,
): void {
    elementMetadata.set(
        elementClass,
        Object.freeze(metadata),
    );
}

export function setElementAuthenticationMetadata<
    TApp extends App = App,
>(
    elementClass: Function,
    authentication: AuthenticationMetadata,
): void {
    const metadata =
        elementMetadata.get(elementClass) as
            | ElementMetadata<TApp>
            | undefined;

    if (
        !metadata ||
        (
            metadata.kind !== "page" &&
            metadata.kind !== "layout"
        )
    ) {
        throw new TypeError(
            "@auth requires @page or @layout to be applied below it.",
        );
    }

    setElementMetadata(
        elementClass,
        {
            ...metadata,
            authentication: Object.freeze({
                authenticationRequired:
                    authentication.authenticationRequired,
                rolesRequired: Object.freeze([
                    ...authentication.rolesRequired,
                ]),
            }),
        },
    );
}

function requireComponentMetadata(
    elementClass: Function,
    decoratorName: "page" | "layout",
): ComponentMetadata {
    const metadata =
        elementMetadata.get(elementClass);

    if (!metadata) {
        throw new TypeError(
            `@${decoratorName} requires @component ` +
            `to be applied below it.`,
        );
    }

    if (metadata.kind !== "component") {
        throw new TypeError(
            `@${decoratorName} cannot be applied to ` +
            `an element already decorated as ` +
            `'${metadata.kind}'.`,
        );
    }

    return metadata;
}

export function component<
    TApp extends App = App,
>(
    configs: ComponentConfigs,
) {
    assertComponentConfigs(configs);

    return function componentDecorator<
        TClass extends DecoratedElementClass<TApp>,
    >(
        elementClass: TClass,
        context: ClassDecoratorContext<TClass>,
    ): void {
        assertClassDecorator(context);

        if (elementMetadata.has(elementClass)) {
            throw new TypeError(
                `Element '${context.name ?? configs.tagName}' ` +
                `already has component metadata.`,
            );
        }

        defineTagName(
            elementClass,
            configs.tagName,
        );

        setElementMetadata(
            elementClass,
            {
                kind: "component",
                tagName: configs.tagName,
                dataField:
                    configs.dataField ?? null,
                groupName:
                    configs.groupName ?? null,
                useServer:
                    configs.useServer ?? null,
                cache:
                    configs.cache ?? false,
                cacheDuration:
                    configs.cacheDuration ?? null,
            },
        );

        context.addInitializer(() => {
            const registered =
                customElements.get(
                    configs.tagName,
                );

            if (registered) {
                if (registered !== elementClass) {
                    throw new Error(
                        `Custom element ` +
                        `'${configs.tagName}' is already ` +
                        `registered with another constructor.`,
                    );
                }

                return;
            }

            customElements.define(
                configs.tagName,
                elementClass,
            );
        });
    };
}

export function page<
    TApp extends App = App,
>(
    pathOrConfigs: string | PageConfigs<TApp>,
) {
    const configs: PageConfigs<TApp> =
        typeof pathOrConfigs === "string"
            ? { path: pathOrConfigs }
            : pathOrConfigs;

    assertPageConfigs(configs);

    return function pageDecorator<
        TClass extends DecoratedElementClass<TApp>,
    >(
        elementClass: TClass,
        context: ClassDecoratorContext<TClass>,
    ): void {
        assertClassDecorator(context);

        const componentMetadata =
            requireComponentMetadata(
                elementClass,
                "page",
            );

        const authentication =
            configs.authentication
                ? Object.freeze({
                    authenticationRequired:
                        configs.authentication
                            .authenticationRequired,
                    rolesRequired: Object.freeze([
                        ...configs.authentication
                            .rolesRequired,
                    ]),
                })
                : null;

        setElementMetadata(
            elementClass,
            {
                ...componentMetadata,
                kind: "page",
                path: configs.path,
                layout:
                    configs.layout ?? null,
                subLayouts: Object.freeze(
                    (configs.subLayouts ?? []).map(
                        subLayout =>
                            Object.freeze({
                                target:
                                    subLayout.target
                                        .trim(),
                                layout:
                                    subLayout.layout,
                            }),
                    ),
                ),
                title:
                    configs.title ?? null,
                target:
                    configs.target ?? null,
                extras: Object.freeze({
                    ...(configs.extras ?? {}),
                }),
                authentication,
            },
        );
    };
}

export function layout<
    TClass extends DecoratedElementClass,
>(
    elementClass: TClass,
    context: ClassDecoratorContext<TClass>,
): void {
    assertClassDecorator(context);

    const componentMetadata =
        requireComponentMetadata(
            elementClass,
            "layout",
        );

    setElementMetadata(
        elementClass,
        {
            ...componentMetadata,
            kind: "layout",
            authentication: null,
        },
    );
}

export function getElementMetadata<
    TApp extends App = App,
>(
    elementClass: Function,
): ElementMetadata<TApp> | null {
    return (elementMetadata.get(elementClass) as ElementMetadata<TApp> | undefined) ?? null;
}

export function requireElementMetadata<
    TApp extends App = App,
>(
    elementClass: Function,
): ElementMetadata<TApp> {
    const metadata =
        getElementMetadata<TApp>(
            elementClass,
        );

    if (!metadata) {
        throw new TypeError(
            `Element '${elementClass.name}' must use @component.`,
        );
    }

    return metadata;
}
