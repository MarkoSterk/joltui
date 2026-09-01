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
import type {
    LazyDependency,
} from "./lazy.js";
import {
    AuthenticationError,
    AuthorizationError,
    HttpRequestError,
    InternalServerError,
    NetworkError,
    ServerComponentNotFound,
    ServerComponentBadRequestResponse,
} from "./errors.js";

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

    constructor(
        elementName: string,
        options?: ErrorOptions,
    ) {
        super(
            `Error in dotJS templating engine in element ${elementName}`,
            options,
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

export type InitializationState =
    | "pending"
    | "fulfilled"
    | "rejected";

export class ElementInitializationError extends Error {
    readonly element: CustomElement;
    readonly elementName: string;

    constructor(
        element: CustomElement,
        options?: ErrorOptions,
    ) {
        const elementName =
            element.tagName.toLowerCase();

        super(
            `Failed to initialize element ` +
            `'${elementName}'.`,
            options,
        );

        this.name = "ElementInitializationError";
        this.element = element;
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

export type FetchHtmlRequest = {
    tagName: string;
    groupName: string;
    routeParameters?: Record<string, string|number>|null;
    queryParameters?: Record<string, string>;
    attributes?: Record<string, any>
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

    readonly dependencies:
        readonly LazyDependency[];

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

export const html = (
    strings: TemplateStringsArray,
    ...values: unknown[]
): string => {
    return strings.reduce(
        (result, part, index) =>
            result + part + (values[index] ?? ""),
        "",
    );
};


export abstract class CustomElement<TApp extends App = App> extends HTMLElement {
    static readonly tagName: string = "";

    static readonly dependencies:
        readonly LazyDependency[] = [];

    protected _app: TApp | null = null;

    protected _resolveInitialization:
        | (() => void)
        | null = null;

    protected _rejectInitialization:
        | ((reason: Error) => void)
        | null = null;

    protected _initializationState:
        InitializationState = "pending";

    protected _initializationError:
        Error | null = null;

    protected _initializationTask:
        Promise<void> | null = null;

    protected _templateSettings: TemplateSettings =
        createTemplateSettings();

    protected _parent: CustomElement | null = null;

    protected _renderTime = 0;

    protected _lastRender = 0;

    protected _abort = false;

    readonly initComplete: Promise<void>;

    rndId: number;

    hashId = "";

    // markup: MarkupMethod = function (
    //     this: CustomElement,
    // ): never {
    //     throw new MissingMarkupMethod(this.tagName);
    // };

    markup: MarkupMethod | null = null;

    constructor() {
        super();

        this.rndId = randomId();

        this.initComplete = new Promise<void>(
            (resolve, reject) => {
                this._resolveInitialization = resolve;
                this._rejectInitialization = reject;
            },
        );

        void this.initComplete.catch(
            () => undefined,
        );

    }

    async connectedCallback(): Promise<void> {
        if (
            this._initializationState !== "pending" ||
            this._initializationTask
        ) {
            return;
        }

        if (this.hasAttribute("defer")) {
            this._completeInitialization();
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
        this.app.removeEventListener(
            dataEventEnum.QUERY_CHANGE,
            this._updateBoundQueryParamParts,
        );
        if (this.dataField) {
            this.app.removeDataListener(this);
        }
        void this._runLifecycle(
            Lifecycle.AFTER_DISCONNECT
        );
    }

    initElement = (): Promise<void> => {
        if (this._initializationTask) {
            return this._initializationTask;
        }

        if (this._initializationState !== "pending") {
            return this.initComplete;
        }

        this._initializationTask =
            this._initializeElement();

        return this._initializationTask;
    };

    protected _initializeElement = async (): Promise<void> => {
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

            await this._loadDependencies();

            if (this._completeIfAborted()) {
                return;
            }

            await this._runLifecycle(
                Lifecycle.BEFORE_INIT
            );

            if (this._completeIfAborted()) {
                return;
            }

            this.app.addEventListener(
                dataEventEnum.CHANGE,
                this._updateBoundAppDataParts,
            );

            this.app.addEventListener(
                dataEventEnum.QUERY_CHANGE,
                this._updateBoundQueryParamParts,
            );

            if (this.dataField) {
                this.app.registerDataListener(this);
            }

            await this.render();

            if (this._completeIfAborted()) {
                return;
            }

            await this._waitForSubelements();

            if (this._completeIfAborted()) {
                return;
            }

            await this._runLifecycle(
                Lifecycle.BEFORE_INIT_RESOLVE,
            );

            this._completeInitialization();

            await this._runLifecycle(
                Lifecycle.AFTER_INIT,
            );
        } catch (error: unknown) {
            this._abort = true;

            if (
                this._initializationState ===
                "pending"
            ) {
                const initializationError =
                    error instanceof
                    ElementInitializationError
                        ? error
                        : new ElementInitializationError(
                              this,
                              { cause: error },
                          );

                this._failInitialization(
                    initializationError,
                );

                await this._handleError(
                    initializationError,
                );
                return;
            }

            await this._handleError(error);
        }
    };

    protected _completeInitialization(): void {
        if (
            this._initializationState !== "pending"
        ) {
            return;
        }

        this._initializationState = "fulfilled";
        this._resolveInitialization?.();
        this._resolveInitialization = null;
        this._rejectInitialization = null;
    }

    protected _failInitialization(error: Error): void {
        if (
            this._initializationState !== "pending"
        ) {
            return;
        }

        this._initializationState = "rejected";
        this._initializationError = error;
        this._rejectInitialization?.(error);
        this._resolveInitialization = null;
        this._rejectInitialization = null;
    }

    protected _completeIfAborted(): boolean {
        if (!this._abort && this.isConnected) {
            return false;
        }

        this._completeInitialization();
        return true;
    }

    protected async _loadDependencies(): Promise<void> {
        const constructorChain:
            Array<typeof CustomElement> = [];

        let constructor =
            this.constructor as typeof CustomElement;

        while (
            constructor === CustomElement ||
            constructor.prototype instanceof
                CustomElement
        ) {
            constructorChain.unshift(constructor);
            constructor = Object.getPrototypeOf(
                constructor,
            ) as typeof CustomElement;
        }

        const dependencies =
            new Set<LazyDependency>();

        for (const elementClass of constructorChain) {
            if (
                !Object.prototype.hasOwnProperty.call(
                    elementClass,
                    "dependencies",
                )
            ) {
                continue;
            }

            const declaredDependencies =
                elementClass.dependencies;

            if (!Array.isArray(declaredDependencies)) {
                throw new TypeError(
                    `Static dependencies for ` +
                    `'${this.tagName}' must be an array.`,
                );
            }

            for (const dependency of declaredDependencies) {
                if (
                    !dependency ||
                    typeof dependency.load !== "function"
                ) {
                    throw new TypeError(
                        `Invalid lazy dependency declared by ` +
                        `'${this.tagName}'.`,
                    );
                }

                dependencies.add(dependency);
            }
        }

        await Promise.all(
            Array.from(
                dependencies,
                dependency => dependency.load(),
            ),
        );
    }

    protected async _handleError(
        error: unknown,
    ): Promise<void> {
        await this.app.handleErrorOnce(error);
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
            if(this.markup == null){
                throw new MissingMarkupMethod(this.tagName);
            }
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

    templateCacheKey(): string {
        return this.app.getTemplateCacheKey(
            this.tagName,
            this.args,
        );
    }

    render = async (): Promise<void> => {
        try {
            const renderTemplate = async (): Promise<string> => {
                if(this.useServer){
                    return await this._fetchHTML();
                }
                if (!this.markup) {
                    const markup = this.innerHTML.trim();
                    return markup;
                }
                return await this._markup();
            }

            let renderedHtml: string;

            if (this.cache) {
                const cacheKey =
                    this.templateCacheKey();

                if (
                    (
                        typeof cacheKey !== "string" ||
                        cacheKey.trim().length === 0
                    )
                ) {
                    throw new TypeError(
                        "templateCacheKey must return a non-empty string.",
                    );
                }
                const cacheDuration =
                    this.cacheDuration ??
                    this.app.templatesCacheDuration;

                renderedHtml = cacheDuration > 0
                    ? await this.app.getOrSetCachedTemplate(
                        cacheKey,
                        cacheDuration,
                        renderTemplate,
                    )
                    : await renderTemplate();
            } else {
                renderedHtml = await renderTemplate();
            }

            this.innerHTML = renderedHtml;
        } catch (error: unknown) {
            this._abort = true;

            throw error;
        }
    };

    _fetchHTML = async (): Promise<string> => {
        return await this.fetchHTML({
            tagName: this.tagName.toLowerCase(),
            groupName: this.groupName == null ? "default" : this.groupName,
            queryParameters: this.app.queryParameters || {},
            routeParameters: this.app?.router.routeParameters || {},
            attributes: this.args,
        });
    }

    fetchHTML = async (request: FetchHtmlRequest): Promise<string> => {
        if (!this.app.serverComponentsUrl) {
            throw new Error(
                "If using server components you need to provide the " +
                "'serverComponentsUrl' property at application initialization."
            );
        }
        let response: Response;
        try {
            response = await fetch(this.app.serverComponentsUrl, {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                    
                },
                body: JSON.stringify(request)
            });
        } catch {
            throw new NetworkError(
                "Failed to fetch requested content. Server unresponsive."
            );
        }
        if (!response.ok) {
            return this._checkFetchHTMLError(response);
        }
        try {
            const text = await response.text();
            if(text.trim().length === 0){
                throw new MarkupFetchError(
                    "Fetched HTML markup was empty for a 2xx response.",
                    this.tagName
                );
            }
            return text;
        } catch(error: unknown){
            if (error instanceof MarkupFetchError) {
                throw error;
            }
            throw new MarkupFetchError(
                "Failed to read fetched html markup for 2xx responses.",
                this.tagName
            );
        }
    };

    _checkFetchHTMLError = (response: Response): never => {
        const requestedPath =
            `${location.pathname}${location.search}`;

        if(response.status >= 500){
            throw new InternalServerError(`Server component fetch failed with status ${response.status}`);
        }
        switch(response.status){
            case 400:
                throw new ServerComponentBadRequestResponse(this.tagName.toLowerCase(), this.groupName || "default");
            case 401:   
                throw new AuthenticationError(requestedPath);
            case 403:
                throw new AuthorizationError(requestedPath, []);
            case 404:
                throw new ServerComponentNotFound(this.tagName.toLowerCase(), this.groupName || "default")
            default:
                throw new HttpRequestError("POST", response);
        }
    }

    rerender = async (): Promise<void> => {
        try {
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
        } catch (error: unknown) {
            this._abort = true;
            await this._handleError(error);
            throw error;
        }
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

    protected _updateBoundQueryParamParts:
        EventListener = (
        event: Event,
    ): void => {
        const customEvent =
            event as CustomEvent<{
                field: string;
            }>;
        this._refreshBoundElements(
            `query.${customEvent.detail.field}`,
        );
    }

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

    protected _hydrate = (
        roots: readonly Element[] | null = null,
    ): void => {
        const elements = roots
            ? roots.flatMap(root => [
                  root,
                  ...Array.from(
                      root.querySelectorAll("*"),
                  ),
              ])
            : Array.from(
                  this.querySelectorAll(
                      `[data-parent-id="${this.hashId}"]` +
                      `[data-render-time="${this.lastRender}"]`,
                  ),
              );

        const elementsWithEvents =
            this._allElementsWithEvents(
                elements,
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
            await this._handleError(
                new MethodExecutionError(
                    methodName,
                    this.tagName,
                    { cause: error },
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
        allElements: Iterable<Element>,
    ): ElementEventConfig[] {
        const elementsWithEvents:
            ElementEventConfig[] = [];

        for (const element of allElements) {
            elementsWithEvents.push(
                ...this._elementWithEvent(
                    element,
                ),
            );
        }

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

            throw new DotJSEngineError(
                this.tagName,
                { cause: error },
            );
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

        return parsedTemplate;
    }

    protected _tagInsertedElements = (
        roots: readonly Element[],
    ): void => {
        this._lastRender = Date.now();

        for (const root of roots) {
            const elements = [
                root,
                ...Array.from(
                    root.querySelectorAll("*"),
                ),
            ];

            for (const child of elements) {
                child.setAttribute(
                    "data-parent-id",
                    this.hashId,
                );

                child.setAttribute(
                    "data-render-time",
                    this.lastRender.toString(),
                );
            }
        }
    };

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

    get initializationState(): InitializationState {
        return this._initializationState;
    }

    get initializationError(): Error | null {
        return this._initializationError;
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

    get cache(): boolean {
        return this.metadata.cache;
    }

    get cacheDuration(): number | null {
        return this.metadata.cacheDuration;
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

    get tagInsertedElements(): (
        roots: readonly Element[],
    ) => void {
        return this._tagInsertedElements;
    }

    get hydrate(): (
        roots?: readonly Element[] | null,
    ) => void {
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
