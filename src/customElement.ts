import App, {
    type AppContainer,
    dataEventEnum,
} from "./app.js";

import doT, {
    type DoTDataBindTemplates,
    type DoTSanitizeFunction,
    type DoTTemplateSettings,
} from "./dotjs/dot.js";

export class RenderError extends Error {
    protected readonly elementName: string;

    constructor(elementName: string) {
        super(`Failed to render element ${elementName}`);
        this.name = "RenderError";
        this.elementName = elementName;
    }
}

export class MissingMarkupMethod extends Error {
    protected readonly elementName: string;

    constructor(elementName: string) {
        super(`Missing markup method for element ${elementName}`);
        this.name = "MissingMarkupMethod";
        this.elementName = elementName;
    }
}

export class DotJSEngineError extends Error {
    protected readonly elementName: string;

    constructor(elementName: string) {
        super(
            `Error in dotJS templating engine in element ${elementName}`,
        );

        this.name = "DotJSEngineError";
        this.elementName = elementName;
    }
}

export class MethodExecutionError extends Error {
    protected readonly methodName: string;
    protected readonly elementName: string;

    constructor(methodName: string, elementName: string) {
        super(
            `Failed to execute method '${methodName}' ` +
            `on element '${elementName}'`,
        );

        this.name = "MethodExecutionError";
        this.methodName = methodName;
        this.elementName = elementName;
    }
}

type MaybePromise<T> = T | Promise<T>;

export type ComponentMethod = (
    this: CustomElement,
    ...args: any[]
) => MaybePromise<unknown>;

export type LifecycleMethod = (
    this: CustomElement,
) => MaybePromise<void>;

export type MarkupMethod = (
    this: CustomElement,
) => MaybePromise<string>;

export type TemplateFunction = (
    this: CustomElement,
    ...args: unknown[]
) => unknown;

export type ComponentMethods = Record<
    string,
    ComponentMethod
>;

export type LifecycleMethods = Record<
    string,
    LifecycleMethod
>;

export type PropertyDescriptorFactory = (
    this: CustomElement,
    propertyName: string,
) => PropertyDescriptor;

export type PropertyDefinition =
    | PropertyDescriptor
    | PropertyDescriptorFactory;

export type PropertyDefinitions = Record<
    string,
    PropertyDefinition
>;

export type CustomElementConfig = {
    tagName: string;
    markup: MarkupMethod;
    methods?: ComponentMethods;
    beforeInit?: LifecycleMethods;
    beforeInitResolve?: LifecycleMethods;
    afterInit?: LifecycleMethods;
    beforeRerender?: LifecycleMethods;
    afterRerender?: LifecycleMethods;
    afterDisconnect?: LifecycleMethods;
    dataField?: string | null;
    define?: PropertyDefinitions;
    templateFunctions?: Record<string, TemplateFunction>;
};

export type CustomElementClass<
    TElement extends CustomElement = CustomElement,
> = {
    new (): TElement;

    readonly tagName: string;

    generate(
        hashId?: string | null,
        args?: Record<string, unknown> | null,
    ): string;
};

type ElementEventConfig = {
    element: Element;
    eventName: string;
    methodName: string;
};

type DataBindTemplates = DoTDataBindTemplates;

export type TemplateSettings = DoTTemplateSettings & {
    evaluate: RegExp;
    interpolate: RegExp;
    encode: RegExp;
    use: RegExp;
    define: RegExp;
    conditional: RegExp;
    iterate: RegExp;
    varname: string;
    strip: boolean;
    append: boolean;
    selfcontained: boolean;
    def: Record<string, TemplateFunction>;
    dataBinds: Map<string, DataBindTemplates>;
    sanitizeFunc: DoTSanitizeFunction;
};

const baseTemplateSettings = Object.freeze({
    evaluate: /\{\{([\s\S]+?)\}\}/g,
    interpolate: /\{\{=([\s\S]+?)\}\}/g,
    encode: /\{\{!([\s\S]+?)\}\}/g,
    use: /\{\{#([\s\S]+?)\}\}/g,
    define:
        /\{\{##\s*([\w.$]+)\s*(:|=)([\s\S]+?)#\}\}/g,
    conditional:
        /\{\{\?(\?)?\s*([\s\S]*?)\s*\}\}/g,
    iterate:
        /\{\{~\s*(?:\}\}|([\s\S]+?)\s*:\s*([\w$]+)\s*(?::\s*([\w$]+))?\s*\}\})/g,
    varname: "it",
    strip: true,
    append: true,
    selfcontained: false,
} satisfies Omit<
    TemplateSettings,
    "def" | "dataBinds" | "sanitizeFunc"
>);

function createTemplateSettings(): TemplateSettings {
    return {
        ...baseTemplateSettings,
        def: {},
        dataBinds: new Map<string, DataBindTemplates>(),
        sanitizeFunc: value => value,
    };
}

export function randomId(
    max: number = 10000,
    min: number = 1,
): number {
    return (
        Math.floor(
            Math.random() * (max - min + 1),
        ) + min
    );
}

export function defineValue(
    initValue: unknown,
    triggerRerender: boolean = true,
): PropertyDescriptorFactory {
    return function defineValueInner(
        this: CustomElement,
        name: string,
    ): PropertyDescriptor {
        const clonedValue =
            window.structuredClone(initValue);

        if (
            clonedValue !== undefined &&
            clonedValue !== null
        ) {
            this._values[name] = clonedValue;
        }

        return {
            configurable: true,
            enumerable: true,

            get(this: CustomElement): unknown {
                return this._values[name];
            },

            set(
                this: CustomElement,
                value: unknown,
            ): void {
                this._values[name] = value;

                if (triggerRerender) {
                    this._refreshBoundElements(name);
                }
            },
        };
    };
}

export function queryParameter(
    name: string,
    defaultValue: string|null = null,
    triggerRerender: boolean = true,
): PropertyDescriptorFactory {
    if (!name) {
        throw new Error(
            "Missing or invalid query parameter name",
        );
    }

    return function queryParameterInner(
        this: CustomElement,
    ): PropertyDescriptor {
        return {
            configurable: true,
            enumerable: true,

            get(this: CustomElement): string|null {
                return (
                    this.app.queryParameters[name] ??
                    defaultValue
                );
            },

            set(
                this: CustomElement,
                value: string|number,
            ): void {
                this.app.updateQueryParameters({[name]: `${value}`});

                if (triggerRerender) {
                    this._refreshBoundElements(
                        `query-${name}`,
                    );
                }
            },
        };
    };
}

export function querySelector<
    TElement extends Element = Element,
>(
    selector: string,
): PropertyDescriptorFactory {
    if (!selector) {
        throw new Error(
            "Missing or invalid selector for querySelector",
        );
    }

    return function querySelectorInner(
        this: CustomElement,
    ): PropertyDescriptor {
        return {
            configurable: true,
            enumerable: true,

            get(this: CustomElement): TElement | null {
                return this.querySelector<TElement>(
                    selector,
                );
            },
        };
    };
}

export function querySelectorAll<
    TElement extends Element = Element,
>(
    selector: string,
): PropertyDescriptorFactory {
    if (!selector) {
        throw new Error(
            "Missing or invalid selector for querySelectorAll",
        );
    }

    return function querySelectorAllInner(
        this: CustomElement,
    ): PropertyDescriptor {
        return {
            configurable: true,
            enumerable: true,

            get(
                this: CustomElement,
            ): NodeListOf<TElement> {
                return this.querySelectorAll<TElement>(
                    selector,
                );
            },
        };
    };
}

export const html = String.raw;

export class CustomElement extends HTMLElement {
    static readonly tagName: string = "";

    protected _app: App | null = null;

    protected _resolveInitialization:
        | (() => void)
        | null = null;

    protected _templateSettings: TemplateSettings =
        createTemplateSettings();

    protected _dataField: string | null = null;

    protected _parent: CustomElement | null = null;

    protected _protectedProperties: string[] = [];

    protected _methods: ComponentMethods | null = {};

    protected _beforeInit: LifecycleMethods = {};

    protected _beforeInitResolve: LifecycleMethods = {};

    protected _afterInit: LifecycleMethods = {};

    protected _beforeRerender: LifecycleMethods = {};

    protected _afterRerender: LifecycleMethods = {};

    protected _afterDisconnect: LifecycleMethods = {};

    protected _define: PropertyDefinitions = {};

    protected _templateFunctions: Record<
        string,
        TemplateFunction
    > = {};

    protected _renderTime = 0;

    protected _lastRender = 0;

    protected _abort = false;

    protected readonly _virtualRenderDiv =
        "virtual-render-div";

    readonly initComplete: Promise<void>;

    readonly _values: Record<string, unknown> = {};

    rndId: number;

    hashId = "";

    markup: MarkupMethod = function (
        this: CustomElement,
    ): never {
        throw new MissingMarkupMethod(this.tagName);
    };

    constructor() {
        super();

        this.rndId = randomId();

        this.initComplete = new Promise<void>(
            resolve => {
                this._resolveInitialization = resolve;
            },
        );
    }

    async connectedCallback(): Promise<void> {
        const deferValue =
            this.getAttribute("defer");

        const dataDeferValue =
            this.getAttribute("data-jolt-defer");

        const deferValues = [
            "",
            "true",
            "defer",
        ];

        const deferred =
            (
                this.hasAttribute("defer") &&
                deferValues.includes(
                    deferValue ?? "",
                )
            ) ||
            (
                this.hasAttribute(
                    "data-jolt-defer",
                ) &&
                deferValues.includes(
                    dataDeferValue ?? "",
                )
            );

        if (deferred) {
            this._resolveInitComplete();
            return;
        }

        await this.initElement();
    }

    disconnectedCallback(): void {
        if (!this._app) {
            return;
        }

        this._abort = true;

        this.app.removeEventListener(
            dataEventEnum.CHANGE,
            this._updateBoundAppDataParts,
        );

        if (this._dataField) {
            this.app.removeDataListener(this);
        }

        void this._runMethods(
            this._afterDisconnect,
        );
    }

    initElement = async (): Promise<void> => {
        try {
            this._abort = false;

            const appContainer =
                this.closest<AppContainer>("[app-id]");

            if (!appContainer?.app) {
                throw new Error(
                    `Failed to detect application ` +
                    `container for ${this.tagName}`,
                );
            }

            this._app = appContainer.app;

            this.rndId = randomId();

            this.hashId =
                this.getAttribute("data-hash-id") ??
                this.generateHash();

            if (
                !this.hasAttribute("data-hash-id")
            ) {
                this.setAttribute(
                    "data-hash-id",
                    this.hashId,
                );
            }

            if (
                !this.hasAttribute(
                    "data-parent-id",
                )
            ) {
                const parent =
                    this.parentElement?.closest<CustomElement>(
                        "[data-hash-id]",
                    ) ?? null;

                const parentId =
                    parent?.getAttribute(
                        "data-hash-id",
                    );

                if (parent && parentId) {
                    this.setAttribute(
                        "data-parent-id",
                        parentId,
                    );

                    this._parent = parent;
                }
            }

            this._dataField =
                this.getAttribute("data-field") ??
                this._dataField;

            this._templateSettings =
                createTemplateSettings();

            this._assignTemplateFunctions();

            this._protectedProperties =
                Object.getOwnPropertyNames(this);

            this._assignMethods();

            this._assignDefinedGettersAndSetters();

            await this._runMethods(
                this._beforeInit,
            );

            this.app.addEventListener(
                dataEventEnum.CHANGE,
                this._updateBoundAppDataParts,
            );

            if (this._dataField) {
                this.app.registerDataListener(this);
            }

            await this.render();

            if (this._abort) {
                this._resolveInitComplete();
                return;
            }

            await this._waitForSubelements();

            await this._runMethods(
                this._beforeInitResolve,
            );

            this._resolveInitComplete();

            await this._runMethods(
                this._afterInit,
            );
        } catch (error: unknown) {
            this._abort = true;
            this._resolveInitComplete();

            await this._handleError(error);
        }
    };

    protected _resolveInitComplete(): void {
        this._resolveInitialization?.();
        this._resolveInitialization = null;
    }

    protected async _handleError(
        error: unknown,
    ): Promise<void> {
        if (this._app) {
            await this._app.handleError(error);
            return;
        }

        console.error(error);
    }

    protected _assignTemplateFunctions(): void {
        for (
            const [
                name,
                templateFunction,
            ] of Object.entries(
                this._templateFunctions,
            )
        ) {
            this._templateSettings.def[name] =
                templateFunction.bind(this);
        }
    }

    protected _assignMethods(): void {
        if (!this._methods) {
            return;
        }

        for (
            const [name, method]
            of Object.entries(this._methods)
        ) {
            this._assertPublicMemberName(
                name,
                "method",
            );

            Object.defineProperty(
                this,
                name,
                {
                    configurable: true,
                    enumerable: false,
                    writable: true,
                    value: method.bind(this),
                },
            );
        }

        this._methods = null;
    }

    protected _assignDefinedGettersAndSetters(): void {
        for (
            const [
                propertyName,
                definition,
            ] of Object.entries(this._define)
        ) {
            this._assertPublicMemberName(
                propertyName,
                "property",
            );

            const descriptor =
                typeof definition === "function"
                    ? definition.call(
                          this,
                          propertyName,
                      )
                    : definition;

            Object.defineProperty(
                this,
                propertyName,
                descriptor,
            );
        }
    }

    protected _assertPublicMemberName(
        name: string,
        memberType: "method" | "property",
    ): void {
        if (
            this._protectedProperties.includes(
                name,
            ) ||
            name.startsWith("_") ||
            name.startsWith("#")
        ) {
            throw new Error(
                `Illegal or protected ${memberType} ` +
                `name '${name}' on element ` +
                `'${this.tagName}'`,
            );
        }
    }

    protected async _runMethods(
        methods: LifecycleMethods,
    ): Promise<void> {
        for (
            const [name, method]
            of Object.entries(methods)
        ) {
            try {
                await method.call(this);
            } catch {
                throw new MethodExecutionError(
                    name,
                    this.tagName,
                );
            }
        }
    }

    protected async _markup(): Promise<string> {
        try {
            return await this.markup.call(this);
        } catch (error: unknown) {
            if (
                error instanceof
                MissingMarkupMethod
            ) {
                throw error;
            }

            throw new RenderError(this.tagName);
        }
    }

    render = async (): Promise<void> => {
        try {
            const renderedHtml =
                await this._markup();

            this.innerHTML = renderedHtml;
        } catch (error: unknown) {
            this._abort = true;

            await this._handleError(error);
        }
    };

    rerender = async (): Promise<void> => {
        this._templateSettings.dataBinds.clear();

        await this._runMethods(
            this._beforeRerender,
        );

        await this.render();

        if (this._abort) {
            return;
        }

        await this._waitForSubelements();

        await this._runMethods(
            this._afterRerender,
        );
    };

    protected async _waitForSubelements(): Promise<
        void
    > {
        const customElements = Array.from(
            this.querySelectorAll("*"),
        ).filter(
            (
                element,
            ): element is CustomElement =>
                element instanceof CustomElement,
        );

        await Promise.all(
            customElements.map(
                element => element.initComplete,
            ),
        );
    }

    generateHash(
        length: number = 16,
    ): string {
        return this.app.generateHash(length);
    }

    protected _updateBoundAppDataParts:
        EventListener = (
        event: Event,
    ): void => {
        const customEvent =
            event as CustomEvent<{
                field: string;
            }>;

        this._refreshBoundElements(
            `app.${customEvent.detail.field}`,
        );
    };

    _refreshBoundElements(
        propertyName: string,
    ): void {
        this._renderTime = Date.now();

        const templates =
            this._templateSettings.dataBinds.get(
                propertyName,
            );

        if (!templates) {
            return;
        }

        this.querySelectorAll<HTMLElement>(
            `[data-bind="${propertyName}"]`,
        ).forEach(element => {
            const elementId =
                element.getAttribute(
                    "data-bind-id",
                );

            if (!elementId) {
                return;
            }

            const elementTemplate =
                templates[elementId];

            if (
                elementTemplate === undefined
            ) {
                return;
            }

            element.setAttribute(
                "data-render-time",
                this._renderTime.toString(),
            );

            element.innerHTML =
                elementTemplate;
        });
    }

    protected _hydrate = (): void => {
        const elementsWithEvents =
            this._allElementsWithEvents(
                this.querySelectorAll(
                    `[data-parent-id="${this.hashId}"]` +
                    `[data-render-time="${this.lastRender}"]`,
                ),
            );

        this._setEventListeners(
            elementsWithEvents,
        );
    };

    protected _setEventListeners(
        elementsWithEvents:
            ElementEventConfig[],
    ): void {
        for (
            const eventConfig
            of elementsWithEvents
        ) {
            const {
                element,
                eventName,
                methodName,
            } = eventConfig;

            const activeKey =
                `jolt-${eventName}:active`;

            const listenerKey =
                `jolt-${eventName}:active-method-` +
                methodName;

            const eventElement =
                element as Element &
                    Record<string, unknown>;

            if (eventElement[activeKey]) {
                continue;
            }

            const listener =
                this._createEventListenerMethod(
                    element,
                    methodName,
                );

            element.addEventListener(
                eventName,
                listener,
            );

            eventElement[activeKey] = true;
            eventElement[listenerKey] =
                listener;
        }
    }

    protected _createEventListenerMethod(
        element: Element,
        methodName: string,
    ): EventListener {
        return (event: Event): void => {
            void this._executeElementMethod(
                element,
                methodName,
                event,
            );
        };
    }

    protected async _executeElementMethod(
        element: Element,
        methodName: string,
        event: Event,
    ): Promise<void> {
        try {
            const args =
                this._getAllArgs(element);

            const dynamicElement =
                this as unknown as Record<
                    string,
                    unknown
                >;

            const method =
                dynamicElement[methodName];

            if (typeof method !== "function") {
                throw new Error(
                    `Method '${methodName}' ` +
                    `does not exist on element ` +
                    `'${this.tagName}'`,
                );
            }

            const boundMethod =
                method as ComponentMethod;

            if (
                Object.keys(args).length > 0
            ) {
                await boundMethod.call(
                    this,
                    element,
                    event,
                    args,
                );
            } else {
                await boundMethod.call(
                    this,
                    element,
                    event,
                );
            }
        } catch (error: unknown) {
            console.error(error);

            await this._handleError(
                new MethodExecutionError(
                    methodName,
                    this.tagName,
                ),
            );
        }
    }

    _getAllArgs(
        element:
            | Element
            | HTMLElement
            | CustomElement,
    ): Record<string, unknown> {
        const data: Record<
            string,
            unknown
        > = {};

        for (
            const attribute
            of Array.from(element.attributes)
        ) {
            const isJoltArgument =
                attribute.name.startsWith(
                    "data-jolt-",
                );

            const isColonArgument =
                attribute.name.startsWith(":");

            const isInternalArgument =
                attribute.name.startsWith(
                    "data-jolt-is-active-",
                );

            if (
                (
                    isJoltArgument ||
                    isColonArgument
                ) &&
                !isInternalArgument
            ) {
                const key = isJoltArgument
                    ? attribute.name.substring(
                          "data-jolt-".length,
                      )
                    : attribute.name.substring(1);

                let value: unknown =
                    attribute.value;

                try {
                    value = JSON.parse(
                        attribute.value.trim(),
                    );
                } catch {
                    value = attribute.value;
                }

                data[key] = value;
            }
        }

        return data;
    }

    protected _allElementsWithEvents(
        allElements: NodeListOf<Element>,
    ): ElementEventConfig[] {
        const elementsWithEvents:
            ElementEventConfig[] = [];

        allElements.forEach(element => {
            elementsWithEvents.push(
                ...this._elementWithEvent(
                    element,
                ),
            );
        });

        return elementsWithEvents;
    }

    protected _elementWithEvent(
        element: Element,
    ): ElementEventConfig[] {
        const events: ElementEventConfig[] =
            [];

        for (
            const attribute
            of Array.from(element.attributes)
        ) {
            if (
                attribute.name.startsWith(
                    "jolt-",
                ) &&
                !attribute.name.startsWith(
                    "jolt-show-if",
                )
            ) {
                events.push({
                    element,
                    eventName:
                        attribute.name.substring(
                            "jolt-".length,
                        ),
                    methodName:
                        attribute.value,
                });
            }
        }

        return events;
    }

    protected _dotJSengine = (
        template: string,
    ): string => {
        try {
            const templateFunction =
                doT.template.call(
                    this,
                    template,
                    this._templateSettings,
                    undefined,
                );

            const renderedTemplate: string =
                templateFunction.call(
                    this,
                    {},
                    this._templateSettings
                        .sanitizeFunc,
                );

            return this._parseStringTemplate(
                renderedTemplate,
            );
        } catch (error: unknown) {
            this._abort = true;

            console.error(error);

            void this._handleError(
                new DotJSEngineError(
                    this.tagName,
                ),
            );

            return "";
        }
    };

    protected _parseStringTemplate(
        template: string,
    ): string {
        let parsedTemplate =
            this._replaceAtWithJolt(template);

        parsedTemplate =
            this._replaceColonWithData(
                parsedTemplate,
            );

        const virtualElement =
            document.createElement("div");

        virtualElement.classList.add(
            this._virtualRenderDiv,
        );

        this.app.originalInsertAdjacentHTML.call(
            virtualElement,
            "afterbegin",
            parsedTemplate,
        );

        this._lastRender = Date.now();

        return this._tagAllElementsWithParent(
            virtualElement,
        ).innerHTML;
    }

    protected _tagAllElementsWithParent<
        TElement extends Element,
    >(
        element: TElement,
    ): TElement {
        element
            .querySelectorAll("*")
            .forEach(child => {
                child.setAttribute(
                    "data-parent-id",
                    this.hashId,
                );

                child.setAttribute(
                    "data-render-time",
                    this.lastRender.toString(),
                );
            });

        return element;
    }

    protected _replaceAtWithJolt(
        template: string,
    ): string {
        return template.replace(
            /@(\w+)=/g,
            "jolt-$1=",
        );
    }

    protected _replaceColonWithData(
        template: string,
    ): string {
        return template.replace(
            /:(\w+)=/g,
            "data-jolt-$1=",
        );
    }

    getData(field: string): unknown {
        return this.app.getData(field);
    }

    setData(
        field: string,
        data: unknown,
    ): void {
        this.app.setData(field, data);
    }

    get lastRender(): number {
        return this._lastRender;
    }

    get app(): App {
        if (!this._app) {
            throw new Error(
                `Application object not found ` +
                `for element '${this.tagName}'`,
            );
        }

        return this._app;
    }

    get dataField(): string | null {
        return this._dataField;
    }

    get parent(): CustomElement | null {
        return this._parent;
    }

    get args(): Record<string, unknown> {
        return this._getAllArgs(this);
    }

    get dotJSengine(): (
        template: string,
    ) => string {
        return this._dotJSengine;
    }

    get hydrate(): () => void {
        return this._hydrate;
    }

    static generate(
        hashId?: string | null,
        args: Record<
            string,
            unknown
        > | null = null,
    ): string {
        const generatedArguments =
            Object.entries(args ?? {}).map(
                ([name, value]) => {
                    const serializedValue =
                        typeof value === "string"
                            ? value
                            : JSON.stringify(value);

                    return (
                        `data-jolt-${name}="` +
                        `${escapeHtmlAttribute(
                            serializedValue,
                        )}"`
                    );
                },
            );

        const argumentString =
            generatedArguments.length > 0
                ? ` ${generatedArguments.join(
                      " ",
                  )}`
                : "";

        const hashIdAttribute = hashId
            ? (
                ` data-hash-id="` +
                `${escapeHtmlAttribute(
                    hashId,
                )}"`
            )
            : "";

        return (
            `<${this.tagName}` +
            `${hashIdAttribute}` +
            `${argumentString}>` +
            `</${this.tagName}>`
        );
    }
}

export function escapeHtmlAttribute(
    value: string,
): string {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll('"', "&quot;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
}

const validCustomElementTagName =
    /^[a-z][a-z0-9]*(?:-[a-z0-9]+)+$/;

export function ElementFactory(
    config: CustomElementConfig,
): CustomElementClass {
    const {
        tagName,
        markup,
        methods = {},
        beforeInit = {},
        beforeInitResolve = {},
        afterInit = {},
        beforeRerender = {},
        afterRerender = {},
        afterDisconnect = {},
        dataField = null,
        define = {},
        templateFunctions = {},
    } = config;

    if (!tagName) {
        throw new Error(
            "Missing tagName in ElementFactory",
        );
    }

    if (typeof markup !== "function") {
        throw new Error(
            `Missing or invalid markup method ` +
            `for element '${tagName}'`,
        );
    }

    if (
        !validCustomElementTagName.test(
            tagName,
        )
    ) {
        throw new Error(
            `Element tagName '${tagName}' must ` +
            `use valid custom-element kebab-case ` +
            `syntax and contain at least one hyphen`,
        );
    }

    class GeneratedCustomElement
        extends CustomElement
    {
        static override readonly tagName =
            tagName;

        protected override _methods:
            ComponentMethods | null = {
                ...methods,
            };

        protected override _beforeInit:
            LifecycleMethods = {
                ...beforeInit,
            };

        protected override _beforeInitResolve:
            LifecycleMethods = {
                ...beforeInitResolve,
            };

        protected override _afterInit:
            LifecycleMethods = {
                ...afterInit,
            };

        protected override _beforeRerender:
            LifecycleMethods = {
                ...beforeRerender,
            };

        protected override _afterRerender:
            LifecycleMethods = {
                ...afterRerender,
            };

        protected override _afterDisconnect:
            LifecycleMethods = {
                ...afterDisconnect,
            };

        protected override _dataField:
            string | null = dataField;

        protected override _define:
            PropertyDefinitions = {
                ...define,
            };

        protected override _templateFunctions:
            Record<
                string,
                TemplateFunction
            > = {
                ...templateFunctions,
            };

        override markup: MarkupMethod =
            markup;
    }

    return GeneratedCustomElement;
}

export default ElementFactory;