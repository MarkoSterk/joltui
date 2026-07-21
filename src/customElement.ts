import App, {
    type AppContainer,
    dataEventEnum,
} from "./app.js";

import doT, {
    type DoTDataBindTemplates,
    type DoTSanitizeFunction,
    type DoTTemplateSettings,
} from "./dotjs/dot.js";

import {
    Lifecycle,
    getLifecycleMethods,
} from "./lifecycle.js";

import {
    requireElementMetadata,
    type ElementMetadata,
} from "./elementMetadata.js";
import { AuthenticationError, AuthorizationError, InternalServerError, NetworkError } from "./errors.js";

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

    constructor(
        methodName: string,
        elementName: string,
        options?: ErrorOptions,
    ) {
        super(
            `Failed to execute method '${methodName}' ` +
            `on element '${elementName}'`,
            options,
        );

        this.name = "MethodExecutionError";
        this.methodName = methodName;
        this.elementName = elementName;
    }
}

export class MarkupFetchError extends Error{
    protected elementName: string;
    constructor(msg: string, tagName: string){
        super(msg);
        this.elementName = tagName;
        this.name = "MarkupFetchError";
    }
}

type MaybePromise<T> = T | Promise<T>;

export type ComponentMethod = (
    this: CustomElement,
    ...args: any[]
) => MaybePromise<unknown>;

export type MarkupMethod = (
    this: CustomElement,
) => MaybePromise<string>;

export type TemplateFunction = (
    this: CustomElement,
    ...args: unknown[]
) => unknown;

export type CustomElementClass<
    TApp extends App = App,
    TElement extends CustomElement<TApp> = CustomElement<TApp>,
> = CustomElementConstructor & {
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

export const html = String.raw;

export abstract class CustomElement<TApp extends App = App> extends HTMLElement {
    static readonly tagName: string = "";

    protected _app: TApp | null = null;

    protected _resolveInitialization:
        | (() => void)
        | null = null;

    protected _templateSettings: TemplateSettings =
        createTemplateSettings();

    protected _parent: CustomElement | null = null;

    protected _renderTime = 0;

    protected _lastRender = 0;

    protected _abort = false;

    protected readonly _virtualRenderDiv =
        "virtual-render-div";

    readonly initComplete: Promise<void>;

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
        if (this.hasAttribute("defer")) {
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
        if (this.dataField) {
            this.app.removeDataListener(this);
        }
        void this._runLifecycle(
            Lifecycle.AFTER_DISCONNECT
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

            this._app = appContainer.app as TApp;

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


            this._templateSettings =
                createTemplateSettings();

            await this._runLifecycle(
                Lifecycle.BEFORE_INIT
            );

            this.app.addEventListener(
                dataEventEnum.CHANGE,
                this._updateBoundAppDataParts,
            );

            if (this.dataField) {
                this.app.registerDataListener(this);
            }

            await this.render();

            if (this._abort) {
                this._resolveInitComplete();
                return;
            }

            await this._waitForSubelements();

            await this._runLifecycle(
                Lifecycle.BEFORE_INIT_RESOLVE,
            );

            this._resolveInitComplete();

            await this._runLifecycle(
                Lifecycle.AFTER_INIT,
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

    protected async _runLifecycle(
        stage: Lifecycle,
    ): Promise<void> {
        for (const { name, method } of getLifecycleMethods(this, stage)) {
            try {
                await method.call(this);
            } catch (error: unknown) {
                throw new MethodExecutionError(
                    name,
                    this.tagName,
                    { cause: error },
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
            const renderedHtml = this.useServer ? await this.fetchHTML() : await this._markup();

            this.innerHTML = renderedHtml;
        } catch (error: unknown) {
            this._abort = true;

            await this._handleError(error);
        }
    };

    fetchHTML = async (): Promise<string> => {
        if(!this.app.serverComponentsUrl){
            throw new Error("If using server components you need to provide the 'serverComponentsUrl' property at application initialization.")
        }
        try{
            let response = await fetch(this.app.serverComponentsUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    tagName: this.tagName.toLowerCase(),
                    groupName: this.groupName == null ? "default" : this.groupName,
                    queryParameters: this.app.queryParameters || {},
                    routeParameters: this.app?.router.routeParameters || {}
                })
            })
            if(!response.ok){
                if(response.status == 401){
                    throw new AuthenticationError("Missing authentication for requested route");
                }
                if(response.status == 403){
                    throw new AuthorizationError("User is not authorized for this route", []);
                }
                if(response.status == 500){
                    throw new InternalServerError("Something went wrong on the server during component content fetch");
                }
            }
            try{
                return await response.text();
            }catch(e: unknown){
                throw new MarkupFetchError("Failed to parse fetched html markup.", this.tagName);
            }
        }catch(e: unknown){
            throw new NetworkError("Failed to fetch requested content. Server unresponsive.");
        }
    }

    rerender = async (): Promise<void> => {
        this._templateSettings.dataBinds.clear();

        await this._runLifecycle(
            Lifecycle.BEFORE_RERENDER,
        );

        await this.render();

        if (this._abort) {
            return;
        }

        await this._waitForSubelements();

        await this._runLifecycle(
            Lifecycle.AFTER_RERENDER,
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

    invalidate(bindingName: string): void {
        if (!bindingName) {
            throw new TypeError("Binding name cannot be empty.");
        }

        this._refreshBoundElements(bindingName);
    }

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
        return async (event: Event): Promise<void> => {
            await this._executeElementMethod(
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
                    event,
                    args,
                );
            } else {
                await boundMethod.call(
                    this,
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

    get data(): ReadonlyMap<string, unknown>{
        return this.app.data;
    }

    get lastRender(): number {
        return this._lastRender;
    }

    get app(): TApp {
        if (!this._app) {
            throw new Error(
                `Application object not found ` +
                `for element '${this.tagName}'`,
            );
        }

        return this._app;
    }

    get metadata(): ElementMetadata<TApp> {
        return requireElementMetadata(
            this.constructor as CustomElementClass<TApp>,
        );
    }

    get dataField(): string | null {
        return this.metadata.dataField;
    }

    get groupName(): string | null {
        return this.metadata.groupName;
    }

    get useServer(): boolean | null {
        return this.metadata.useServer;
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

export default CustomElement;
