
export interface ReactivePropertyHost {
    invalidate(bindingName: string): void;
}

export interface QueryParameterHost
    extends ReactivePropertyHost {
    readonly app: {
        readonly queryParameters:
            Readonly<Record<string, string>>;

        updateQueryParameters(
            parameters: Record<
                string,
                string | number | null
            >,
        ): void;
    };
}

export interface SelectOptions {
    required?: boolean;
    /** Query inside the owning app's container instead of this element. */
    global?: boolean;
}

export interface RequiredSelectOptions
    extends SelectOptions {
    required: true;
}

export interface OptionalSelectOptions
    extends SelectOptions {
    required?: false;
}

export interface SelectAllOptions extends SelectOptions {}

function getSelectionRoot(
    host: ParentNode,
    global: boolean = false,
): ParentNode {
    if (!global) {
        return host;
    }

    const app = (host as ParentNode & {
        readonly app?: { readonly container: ParentNode };
    }).app;

    if (!app) {
        throw new Error(
            "Global selection requires an initialized application.",
        );
    }

    return app.container;
}

type AccessorTarget<
    THost,
    TValue,
> = ClassAccessorDecoratorTarget<
    THost,
    TValue
>;

type AccessorContext<
    THost,
    TValue,
> = ClassAccessorDecoratorContext<
    THost,
    TValue
>;

type AccessorResult<
    THost,
    TValue,
> = ClassAccessorDecoratorResult<
    THost,
    TValue
>;

function assertAccessor(
    context: ClassAccessorDecoratorContext,
    decoratorName: string,
): string {
    if (context.static) {
        throw new TypeError(
            `${decoratorName} cannot decorate a static accessor.`,
        );
    }

    if (context.private) {
        throw new TypeError(
            `${decoratorName} cannot decorate a private accessor.`,
        );
    }

    if (typeof context.name !== "string") {
        throw new TypeError(
            `${decoratorName} does not support symbol-named accessors.`,
        );
    }

    return context.name;
}

function assertNonEmptyString(
    value: string,
    errorMessage: string,
): string {
    const normalizedValue = value.trim();

    if (!normalizedValue) {
        throw new TypeError(errorMessage);
    }

    return normalizedValue;
}

function cloneInitialValue<TValue>(
    value: TValue,
): TValue {
    if (
        value === undefined ||
        value === null
    ) {
        return value;
    }

    return structuredClone(value);
}

function createEmptyNodeList<
    TElement extends Element,
>(): NodeListOf<TElement> {
    return document.querySelectorAll<TElement>(
        ":not(*)",
    );
}

export function react<TValue>(
    initialValue: TValue,
    bindingName?: string,
) {
    return function <
        THost extends ReactivePropertyHost,
    >(
        target: AccessorTarget<
            THost,
            TValue
        >,
        context: AccessorContext<
            THost,
            TValue
        >,
    ): AccessorResult<
        THost,
        TValue
    > {
        const propertyName =
            assertAccessor(
                context,
                "@react",
            );

        const binding =
            bindingName?.trim() ||
            propertyName;

        return {
            init(): TValue {
                return cloneInitialValue(
                    initialValue,
                );
            },

            get(
                this: THost,
            ): TValue {
                return target.get.call(this);
            },

            set(
                this: THost,
                value: TValue,
            ): void {
                const previousValue =
                    target.get.call(this);

                if (
                    Object.is(
                        previousValue,
                        value,
                    )
                ) {
                    return;
                }

                target.set.call(
                    this,
                    value,
                );

                this.invalidate(binding);
            },
        };
    };
}

export function reactFactory<TValue>(
    initialValueFactory: () => TValue,
    bindingName?: string,
) {
    if (
        typeof initialValueFactory !==
        "function"
    ) {
        throw new TypeError(
            "@reactFactory requires an initial-value factory.",
        );
    }

    return function <
        THost extends ReactivePropertyHost,
    >(
        target: AccessorTarget<
            THost,
            TValue
        >,
        context: AccessorContext<
            THost,
            TValue
        >,
    ): AccessorResult<
        THost,
        TValue
    > {
        const propertyName =
            assertAccessor(
                context,
                "@reactFactory",
            );

        const binding =
            bindingName?.trim() ||
            propertyName;

        return {
            init(): TValue {
                return initialValueFactory();
            },

            get(
                this: THost,
            ): TValue {
                return target.get.call(this);
            },

            set(
                this: THost,
                value: TValue,
            ): void {
                const previousValue =
                    target.get.call(this);

                if (
                    Object.is(
                        previousValue,
                        value,
                    )
                ) {
                    return;
                }

                target.set.call(
                    this,
                    value,
                );

                this.invalidate(binding);
            },
        };
    };
}

export function queryParam(
    parameterName: string,
    defaultValue: string,
    bindingName?: string,
): <
    THost extends QueryParameterHost,
>(
    target: AccessorTarget<
        THost,
        string
    >,
    context: AccessorContext<
        THost,
        string
    >,
) => AccessorResult<
    THost,
    string
>;

export function queryParam(
    parameterName: string,
    defaultValue?: null,
    bindingName?: string,
): <
    THost extends QueryParameterHost,
>(
    target: AccessorTarget<
        THost,
        string | null
    >,
    context: AccessorContext<
        THost,
        string | null
    >,
) => AccessorResult<
    THost,
    string | null
>;

export function queryParam(
    parameterName: string,
    defaultValue: string | null = null,
    bindingName?: string,
) {
    const normalizedName =
        assertNonEmptyString(
            parameterName,
            "Query parameter name cannot be empty.",
        );

    const binding =
        bindingName?.trim() ||
        `query-${normalizedName}`;
    const queryBinding =
        `query.${normalizedName}`;

    return function <
        THost extends QueryParameterHost,
        TValue extends string | null,
    >(
        _target: AccessorTarget<
            THost,
            TValue
        >,
        context: AccessorContext<
            THost,
            TValue
        >,
    ): AccessorResult<
        THost,
        TValue
    > {
        assertAccessor(
            context,
            "@queryParam",
        );

        return {
            init(): TValue {
                return defaultValue as TValue;
            },

            get(
                this: THost,
            ): TValue {
                const value =
                    this.app
                        .queryParameters[
                            normalizedName
                        ];

                return (
                    value ??
                    defaultValue
                ) as TValue;
            },

            set(
                this: THost,
                value: TValue,
            ): void {
                this.app
                    .updateQueryParameters({
                        [normalizedName]:
                            value,
                    });

                if (binding !== queryBinding) {
                    this.invalidate(binding);
                }
            },
        };
    };
}

export function select<
    TElement extends Element = Element,
>(
    selector: string,
    options: RequiredSelectOptions,
): <
    THost extends ParentNode,
>(
    target: AccessorTarget<
        THost,
        TElement
    >,
    context: AccessorContext<
        THost,
        TElement
    >,
) => AccessorResult<
    THost,
    TElement
>;

export function select<
    TElement extends Element = Element,
>(
    selector: string,
    options?: OptionalSelectOptions,
): <
    THost extends ParentNode,
>(
    target: AccessorTarget<
        THost,
        TElement | null
    >,
    context: AccessorContext<
        THost,
        TElement | null
    >,
) => AccessorResult<
    THost,
    TElement | null
>;

export function select<
    TElement extends Element = Element,
>(
    selector: string,
    options: SelectOptions = {},
) {
    const normalizedSelector =
        assertNonEmptyString(
            selector,
            "Query selector cannot be empty.",
        );

    return function <
        THost extends ParentNode,
        TValue extends TElement | null,
    >(
        _target: AccessorTarget<
            THost,
            TValue
        >,
        context: AccessorContext<
            THost,
            TValue
        >,
    ): AccessorResult<
        THost,
        TValue
    > {
        const propertyName =
            assertAccessor(
                context,
                "@select",
            );

        return {
            init(): TValue {
                return null as TValue;
            },

            get(
                this: THost,
            ): TValue {
                const element =
                    getSelectionRoot(this, options.global).querySelector<
                        TElement
                    >(
                        normalizedSelector,
                    );

                if (
                    element === null &&
                    options.required
                ) {
                    throw new Error(
                        `Required element '${normalizedSelector}' ` +
                        `for property '${propertyName}' was not found.`,
                    );
                }

                return element as TValue;
            },

            set(): never {
                throw new TypeError(
                    `Selected element property ` +
                    `'${propertyName}' is read-only.`,
                );
            },
        };
    };
}

export function selectAll<
    TElement extends Element = Element,
>(
    selector: string,
    options: SelectAllOptions = {},
): <
    THost extends ParentNode,
>(
    target: AccessorTarget<
        THost,
        NodeListOf<TElement>
    >,
    context: AccessorContext<
        THost,
        NodeListOf<TElement>
    >,
) => AccessorResult<
    THost,
    NodeListOf<TElement>
> {
    const normalizedSelector =
        assertNonEmptyString(
            selector,
            "Query selector cannot be empty.",
        );

    return function <
        THost extends ParentNode,
    >(
        _target: AccessorTarget<
            THost,
            NodeListOf<TElement>
        >,
        context: AccessorContext<
            THost,
            NodeListOf<TElement>
        >,
    ): AccessorResult<
        THost,
        NodeListOf<TElement>
    > {
        const propertyName =
            assertAccessor(
                context,
                "@selectAll",
            );

        return {
            init(): NodeListOf<TElement> {
                return createEmptyNodeList<
                    TElement
                >();
            },

            get(
                this: THost,
            ): NodeListOf<TElement> {
                const elements =
                    getSelectionRoot(this, options.global).querySelectorAll<
                        TElement
                    >(
                        normalizedSelector,
                    );

                if (
                    options.required &&
                    elements.length === 0
                ) {
                    throw new Error(
                        `No elements matching ` +
                        `'${normalizedSelector}' were found ` +
                        `for required property '${propertyName}'.`,
                    );
                }

                return elements;
            },

            set(): never {
                throw new TypeError(
                    `Selected elements property ` +
                    `'${propertyName}' is read-only.`,
                );
            },
        };
    };
}
