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
};

export type AuthenticationMetadata = Readonly<{
    authenticationRequired: boolean;
    rolesRequired: readonly unknown[];
}>;

export type PageConfigs<
    TApp extends App = App,
> = {
    path: string;
    layout?: CustomElementClass<TApp> | null;
    title?: string | null;
    target?: string | null;
    extras?: Record<string, unknown> | null;
    authentication?: AuthenticationMetadata | null;
    roles?: readonly unknown[] | null;
};

type BaseElementMetadata = Readonly<{
    tagName: string;
    dataField: string | null;
    groupName: string | null;
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
    }>;

export type PageMetadata<
    TApp extends App = App,
> =
    BaseElementMetadata &
    Readonly<{
        kind: "page";
        path: string;
        layout: CustomElementClass<TApp> | null;
        title: string | null;
        target: string | null;
        extras: Readonly<Record<string, unknown>>;
        authentication: {
            authenticationRequired: boolean;
            rolesRequired: unknown[];
        } | null;
        roles: unknown[] | null;
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
            },
        );
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
                ? {
                    authenticationRequired:
                        configs.authentication
                            .authenticationRequired,
                    rolesRequired: [
                        ...configs.authentication
                            .rolesRequired,
                    ],
                }
                : null;

        setElementMetadata(
            elementClass,
            {
                ...componentMetadata,
                kind: "page",
                path: configs.path,
                layout:
                    configs.layout ?? null,
                title:
                    configs.title ?? null,
                target:
                    configs.target ?? null,
                extras: Object.freeze({
                    ...(configs.extras ?? {}),
                }),
                authentication,
                roles:
                    configs.roles
                        ? [...configs.roles]
                        : null,
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
