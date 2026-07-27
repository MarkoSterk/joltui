import Router from "./router.js";
import ErrorHandler, {
    type ErrorHandlerClass,
} from "./errorHandler.js";
import {
    CustomElement,
    type CustomElementClass,
} from "./customElement.js";
import { transformSelector } from "./selectorParser/index.js";
import { requireElementMetadata } from "./elementMetadata.js";
import {
    Lifecycle,
    getLifecycleMethods,
} from "./lifecycle.js";

export const dataEventEnum = {
    CHANGE: "app-data-change",
    QUERY_CHANGE: "query-parameter-change",
} as const;

export type AppDataChangeDetail = {
    field: string;
};

export type AppDataChangeEvent =
    CustomEvent<AppDataChangeDetail>;

export type AppQueryChangeDetail = {
    field: string;
};

export type AppQueryChangeEvent =
    CustomEvent<AppQueryChangeDetail>;

interface AppEventMap
    extends GlobalEventHandlersEventMap {
    "app-data-change": AppDataChangeEvent;
    "query-parameter-change": AppQueryChangeEvent;
}

type AppEventListener<
    K extends keyof AppEventMap,
> = (
    this: Element,
    event: AppEventMap[K],
) => void;

type DataChangeListener =
    AppEventListener<
        typeof dataEventEnum.CHANGE
    >;

export type DataStructure =
    Record<string, unknown>;

export type AppContainer<
    TApp extends App<TApp> = App<any>,
> = Element & {
    app: TApp;
};

export type AppConfig<
    TApp extends App<TApp> = App<any>,
> = {
    appName: string;
    serverComponentsUrl?: string | null;
    dataStructure?: DataStructure | null;
    container?: AppContainer<TApp> | null;
    templatesCacheDuration?: number | null;
    templatesCacheCleanupInterval?: number | null;
};

type ElementHtmlSetter = (
    this: Element,
    value: string,
) => void;

type TemplatesCacheEntry = {
    template: string;
    duration: number;
    setTime: number;
};

function assertCacheDuration(
    value: number,
    propertyName: string,
): void {
    if (
        typeof value !== "number" ||
        !Number.isFinite(value) ||
        value < 0
    ) {
        throw new TypeError(
            `${propertyName} must be a finite, non-negative number.`,
        );
    }
}

function stableSerialize(
    value: unknown,
    seen: WeakSet<object> = new WeakSet(),
): string {
    if (value === null) {
        return "null";
    }

    if (typeof value === "number" && !Number.isFinite(value)) {
        return JSON.stringify({
            type: "number",
            value: String(value),
        });
    }

    if (typeof value === "bigint") {
        return JSON.stringify({
            type: "bigint",
            value: value.toString(),
        });
    }

    if (typeof value !== "object") {
        return JSON.stringify(
            value === undefined
                ? { type: "undefined" }
                : value,
        ) ?? String(value);
    }

    if (value instanceof Date) {
        return JSON.stringify({
            type: "date",
            value: value.toISOString(),
        });
    }

    if (seen.has(value)) {
        throw new TypeError(
            "Template cache key values cannot contain circular references.",
        );
    }

    seen.add(value);

    const serialized = Array.isArray(value)
        ? `[${value.map(item => stableSerialize(item, seen)).join(",")}]`
        : `{${Object.entries(value)
            .sort(([first], [second]) =>
                first.localeCompare(second),
            )
            .map(([key, item]) =>
                `${JSON.stringify(key)}:${stableSerialize(item, seen)}`,
            )
            .join(",")}}`;

    seen.delete(value);
    return serialized;
}

class App<
    TApp extends App<TApp> = any,
> {
    readonly elements:
        readonly CustomElementClass<TApp>[] = [];

    readonly errorHandlers:
        readonly ErrorHandlerClass<TApp>[] = [];

    protected _errorHandlerInstances:
        readonly ErrorHandler<TApp>[] = [];

    protected readonly _identifier = "app";
    protected readonly _appName: string;
    protected _serverComponentsUrl: string | null = null;

    protected _container:
        AppContainer<TApp> | null;

    protected _dataStructure:
        Map<string, unknown>;

    protected _router:
        Router<TApp> | null = null;

    protected readonly _dataChangeListeners:
        Map<string, DataChangeListener> =
            new Map();

    protected readonly _originalInnerHTML:
        ElementHtmlSetter;

    protected readonly _originalOuterHTML:
        ElementHtmlSetter;

    protected readonly _originalInsertAdjacentHTML:
        typeof Element.prototype.insertAdjacentHTML;

    protected readonly _originalSetAttribute:
        typeof HTMLElement.prototype.setAttribute;

    protected readonly _originalGetAttribute:
        typeof HTMLElement.prototype.getAttribute;

    protected readonly _originalRemoveAttribute:
        typeof HTMLElement.prototype.removeAttribute;

    protected readonly _originalDocQS:
        typeof Document.prototype.querySelector;

    protected readonly _originalDocQSA:
        typeof Document.prototype.querySelectorAll;

    protected readonly _originalElQS:
        typeof Element.prototype.querySelector;

    protected readonly _originalElQSA:
        typeof Element.prototype.querySelectorAll;

    protected readonly _templatesCache:
        Map<string, TemplatesCacheEntry>;

    protected readonly _pendingTemplateCache:
        Map<string, Promise<string>> = new Map();

    protected _templatesCacheDefaultDuration: number = 300;

    protected _templatesCacheCleanupInterval: number = 60;

    protected _templatesCacheCleanupTimer:
        ReturnType<typeof globalThis.setInterval> | null = null;

    constructor({
        appName,
        serverComponentsUrl = null,
        dataStructure = null,
        container = null,
        templatesCacheDuration = null,
        templatesCacheCleanupInterval = null,
    }: AppConfig<TApp>) {
        if (
            typeof appName !== "string" ||
            appName.trim().length === 0
        ) {
            throw new TypeError(
                "Application name must be a non-empty string.",
            );
        }

        this._appName = appName;
        if (templatesCacheDuration !== null) {
            assertCacheDuration(
                templatesCacheDuration,
                "templatesCacheDuration",
            );
            this._templatesCacheDefaultDuration = templatesCacheDuration;
        }

        if (templatesCacheCleanupInterval !== null) {
            assertCacheDuration(
                templatesCacheCleanupInterval,
                "templatesCacheCleanupInterval",
            );
            this._templatesCacheCleanupInterval =
                templatesCacheCleanupInterval;
        }

        if (serverComponentsUrl !== null) {
            this.serverComponentsUrl =
                serverComponentsUrl;
        }

        this._container =
            container as AppContainer<TApp> | null;

        this._dataStructure = new Map(
            Object.entries(dataStructure ?? {}),
        );

        this._originalInnerHTML =
            this.getRequiredSetter(
                Element.prototype,
                "innerHTML",
            );

        this._originalOuterHTML =
            this.getRequiredSetter(
                Element.prototype,
                "outerHTML",
            );

        this._originalInsertAdjacentHTML =
            Element.prototype
                .insertAdjacentHTML;

        this._originalSetAttribute =
            HTMLElement.prototype.setAttribute;

        this._originalGetAttribute =
            HTMLElement.prototype.getAttribute;

        this._originalRemoveAttribute =
            HTMLElement.prototype
                .removeAttribute;

        this._originalDocQS =
            Document.prototype.querySelector;

        this._originalDocQSA =
            Document.prototype.querySelectorAll;

        this._originalElQS =
            Element.prototype.querySelector;

        this._originalElQSA =
            Element.prototype.querySelectorAll;

        this._templatesCache = new Map<string, TemplatesCacheEntry>;
    }

    init = async (
        target?: string | Element,
    ): Promise<void> => {
        const container =
            this._resolveContainer(target);

        this._container = container;
        this._container.app = this.application;
        this._container.setAttribute(
            "app-id",
            this.generateHash(),
        );

        this._startTemplatesCacheCleanup();

        this.registerCustomElements(
            this.elements,
        );

        this._modifyPrototypeMethods();

        this._errorHandlerInstances = this._initializeErrorHandlers();

        await this._runLifecycleStage(
            Lifecycle.EXTENSION_INIT,
        );

        await this._runLifecycleStage(
            Lifecycle.BEFORE_INIT,
        );

        this._router =
            this.routerGenerator();

        if (this._router) {
            await this._router.route();
        }

        await this._waitForSubelements();

        await this._runLifecycleStage(
            Lifecycle.AFTER_INIT,
        );
    };

    protected get application(): TApp {
        return this as unknown as TApp;
    }

    protected routerGenerator():
        Router<TApp> | null {
        return null;
    }

    protected _resolveContainer(
        target?: string | Element,
    ): AppContainer<TApp> {
        const configuredTarget =
            target ?? this._container;

        if (!configuredTarget) {
            throw new Error(
                "Missing application container at startup.",
            );
        }

        const container =
            typeof configuredTarget === "string"
                ? document.querySelector(
                    configuredTarget,
                )
                : configuredTarget;

        if (!container) {
            throw new Error(
                "Could not find the application container.",
            );
        }

        return container as AppContainer<TApp>;
    }

    registerCustomElements(
        elements:
            readonly CustomElementClass<TApp>[],
    ): void {
        for (const element of elements) {
            const metadata =
                requireElementMetadata(element);

            const registered =
                customElements.get(
                    metadata.tagName,
                );

            if (registered) {
                if (registered !== element) {
                    throw new Error(
                        `Custom element ` +
                        `'${metadata.tagName}' is already ` +
                        `registered with another constructor.`,
                    );
                }

                continue;
            }

            customElements.define(
                metadata.tagName,
                element,
            );
        }
    }

    registerDataListener = (
        component: CustomElement<TApp>,
    ): void => {
        const dataField =
            component.dataField;

        if (!dataField) {
            return;
        }

        if (
            !this._dataStructure.has(
                dataField,
            )
        ) {
            throw new Error(
                `Data field '${dataField}' does not exist.`,
            );
        }

        const listener:
            DataChangeListener =
            event => {
                if (
                    event.detail.field ===
                    dataField
                ) {
                    void component.rerender();
                }
            };

        const key =
            this._generateListenerKey(
                dataField,
                component,
            );

        const existingListener =
            this._dataChangeListeners.get(
                key,
            );

        if (existingListener) {
            this.removeEventListener(
                dataEventEnum.CHANGE,
                existingListener,
            );
        }

        this._dataChangeListeners.set(
            key,
            listener,
        );

        this.addEventListener(
            dataEventEnum.CHANGE,
            listener,
        );
    };

    removeDataListener = (
        component: CustomElement<TApp>,
    ): void => {
        const dataField =
            component.dataField;

        if (!dataField) {
            return;
        }

        const key =
            this._generateListenerKey(
                dataField,
                component,
            );

        const listener =
            this._dataChangeListeners.get(
                key,
            );

        if (!listener) {
            return;
        }

        this.removeEventListener(
            dataEventEnum.CHANGE,
            listener,
        );

        this._dataChangeListeners.delete(
            key,
        );
    };

    generateHash = (
        length = 16,
    ): string => {
        if (
            !Number.isInteger(length) ||
            length <= 0
        ) {
            throw new RangeError(
                "Hash length must be a positive integer.",
            );
        }

        const bytes =
            new Uint8Array(length);

        crypto.getRandomValues(bytes);

        return Array.from(
            bytes,
            byte =>
                byte
                    .toString(16)
                    .padStart(2, "0"),
        ).join("");
    };

    protected _generateListenerKey(
        field: string,
        component: CustomElement<TApp>,
    ): string {
        return (
            `${field}-` +
            `${component.tagName}-` +
            `${component.hashId}`
        );
    }

    protected async _waitForSubelements():
        Promise<void> {
        const customElements =
            Array.from(
                this.querySelectorAll("*"),
            ).filter(
                (
                    element,
                ): element is CustomElement<TApp> =>
                    element instanceof
                    CustomElement,
            );

        await Promise.all(
            customElements.map(
                element =>
                    element.initComplete,
            ),
        );
    }

    protected _initializeErrorHandlers(): ErrorHandler<TApp>[] {
        const handlerInstances = [];
        for(const ErrorHandlerClass of this.errorHandlers){
            if (
                typeof ErrorHandlerClass !==
                    "function" ||
                !(
                    ErrorHandlerClass.prototype
                    instanceof ErrorHandler
                )
            ) {
                throw new TypeError(
                    "Application error handlers must extend ErrorHandler.",
                );
            }

            handlerInstances.push(new ErrorHandlerClass(
                this.application,
            ));
        }
        return handlerInstances;
    }

    protected async _runLifecycleStage(
        stage: Lifecycle,
    ): Promise<void> {
        for (
            const { method }
            of getLifecycleMethods(
                this,
                stage,
            )
        ) {
            await method.call(this);
        }
    }

    querySelector<
        TElement extends Element = Element,
    >(
        selector: string,
    ): TElement | null {
        return this.container
            .querySelector<TElement>(
                selector,
            );
    }

    querySelectorAll<
        TElement extends Element = Element,
    >(
        selector: string,
    ): NodeListOf<TElement> {
        return this.container
            .querySelectorAll<TElement>(
                selector,
            );
    }

    getElementById(
        id: string,
    ): Element | null {
        return this.querySelector(
            `#${CSS.escape(id)}`,
        );
    }

    getElementsByClassName(
        className: string,
    ): HTMLCollectionOf<Element> {
        return this.container
            .getElementsByClassName(
                className,
            );
    }

    getElementsByTagName<
        K extends keyof HTMLElementTagNameMap,
    >(
        tagName: K,
    ): HTMLCollectionOf<
        HTMLElementTagNameMap[K]
    > {
        return this.container
            .getElementsByTagName(
                tagName,
            );
    }

    matches(
        selector: string,
    ): boolean {
        return this.container
            .matches(selector);
    }

    handleError = async (
        error: unknown,
    ): Promise<void> => {
        if (!(error instanceof Error)) {
            throw new Error("Failed to handle error. Provided instance is not an instance of Error.");
        }
        for (
            const errorHandler
            of this._errorHandlerInstances
        ) {
            if (
                await errorHandler.handle(
                    error,
                )
            ) {
                return;
            }
        }

        throw error;
    };

    addEventListener<
        K extends keyof AppEventMap,
    >(
        eventType: K,
        listener: AppEventListener<K>,
        options?:
            boolean |
            AddEventListenerOptions,
    ): void;

    addEventListener(
        eventType: string,
        listener:
            EventListenerOrEventListenerObject,
        options?:
            boolean |
            AddEventListenerOptions,
    ): void;

    addEventListener(
        eventType: string,
        listener:
            EventListenerOrEventListenerObject,
        options?:
            boolean |
            AddEventListenerOptions,
    ): void {
        this.container.addEventListener(
            eventType,
            listener,
            options,
        );
    }

    removeEventListener<
        K extends keyof AppEventMap,
    >(
        eventType: K,
        listener: AppEventListener<K>,
        options?:
            boolean |
            EventListenerOptions,
    ): void;

    removeEventListener(
        eventType: string,
        listener:
            EventListenerOrEventListenerObject,
        options?:
            boolean |
            EventListenerOptions,
    ): void;

    removeEventListener(
        eventType: string,
        listener:
            EventListenerOrEventListenerObject,
        options?:
            boolean |
            EventListenerOptions,
    ): void {
        this.container.removeEventListener(
            eventType,
            listener,
            options,
        );
    }

    insertAdjacentHTML(
        position: InsertPosition,
        markup: string,
    ): void {
        this.container
            .insertAdjacentHTML(
                position,
                markup,
            );
    }

    protected _modifyPrototypeMethods = () => {
        const appInstance = this;

        const normalizeAttributeName = (
            name: string,
        ): string => {
            if (!name.startsWith(":")) {
                return name;
            }

            return (
                `data-jolt-` +
                name.substring(1).trim()
            );
        };

        HTMLElement.prototype.setAttribute = function(
            name: string,
            value: string,
        ): void {
            appInstance._originalSetAttribute.call(
                this,
                normalizeAttributeName(name),
                value,
            );
        };

        HTMLElement.prototype.removeAttribute = function(
            name: string,
        ): void {
            appInstance._originalRemoveAttribute.call(
                this,
                normalizeAttributeName(name),
            );
        };

        HTMLElement.prototype.getAttribute = function(
            name: string,
        ): string | null {
            return appInstance._originalGetAttribute.call(
                this,
                normalizeAttributeName(name),
            );
        };

        Element.prototype.insertAdjacentHTML = function(position, html){
            const customElement = this.closest("[data-hash-id]") as CustomElement<TApp> | null;
            if(customElement){
                const renderedTemplate = customElement.dotJSengine(html)
                if(!renderedTemplate){
                    return;
                }
                appInstance._originalInsertAdjacentHTML.call(this, position, renderedTemplate)
                customElement.hydrate();
                return;
            }
            appInstance._originalInsertAdjacentHTML.call(this, position, html);
        }
        Object.defineProperty(Element.prototype, 'innerHTML',  {
            configurable: true,
            enumerable: true,
            set: function(this: Element, html: string){
                html = html.trim();
                const customElement = this.closest("[data-hash-id]") as CustomElement<TApp> | null;
                if(!customElement){
                    appInstance._originalInnerHTML.call(this, html);
                    return;
                }
                appInstance._originalInnerHTML.call(this, "");
                this.insertAdjacentHTML("afterbegin", html);
            }
        });
        Object.defineProperty(Element.prototype, 'outerHTML', {
            configurable: true,
            enumerable: true,
            set: function(this: Element, html: string){
                html = html.trim();
                const customElement = this.closest("[data-hash-id]") as CustomElement<TApp> | null;
                if(customElement){
                    const renderedTemplate = customElement.dotJSengine(html)
                    if(!renderedTemplate){
                        return;
                    }
                    appInstance._originalOuterHTML.call(this, renderedTemplate);
                    customElement.hydrate();
                    return;
                }
                appInstance._originalOuterHTML.call(this, html);
            }
        });

        Document.prototype.querySelector = function(selector: string) {
            const newSelector = transformSelector(selector)
            return appInstance._originalDocQS.call(this, newSelector);
        };

        Document.prototype.querySelectorAll = function(selector: string) {
            const newSelector = transformSelector(selector)
            return appInstance._originalDocQSA.call(this, newSelector);
        };

        Element.prototype.querySelector = function(selector: string) {
            const newSelector = transformSelector(selector)
            return appInstance._originalElQS.call(this, newSelector);
        };

        Element.prototype.querySelectorAll = function(selector: string) {
            const newSelector = transformSelector(selector)
            return appInstance._originalElQSA.call(this, newSelector);
        };

    }


    getRequiredSetter(
        prototype: object,
        propertyName: string,
    ): ElementHtmlSetter {
        const descriptor =
            Object.getOwnPropertyDescriptor(
                prototype,
                propertyName,
            );

        if (
            typeof descriptor?.set !==
            "function"
        ) {
            throw new Error(
                `Missing setter for ` +
                `"${propertyName}".`,
            );
        }

        return descriptor.set as ElementHtmlSetter;
    }

    getData<T = unknown>(
        field: string,
    ): T {
        if (!this._dataStructure.has(field)
        ) {
            throw new Error(
                `Data field '${field}' does not exist.`,
            );
        }
        return this._dataStructure.get(field) as T;
    }

    setData(
        field: string,
        data: unknown,
    ): void {
        if (!this._dataStructure.has(field)
        ) {
            throw new Error(
                `Data field '${field}' does not exist.`,
            );
        }
        this._dataStructure.set(
            field,
            data,
        );
        this._dataChangeEvent(field);
    }

    protected _dataChangeEvent(
        field: string,
    ): void {
        this.container.dispatchEvent(
            new CustomEvent<
                AppDataChangeDetail
            >(
                dataEventEnum.CHANGE,
                {
                    detail: { field },
                },
            ),
        );
    }

    protected _queryChangeEvent(
        field: string,
    ): void {
        this.container.dispatchEvent(
            new CustomEvent<
                AppQueryChangeDetail
            >(
                dataEventEnum.QUERY_CHANGE,
                {
                    detail: { field },
                },
            ),
        );
    }

    protected _getChangedQueryParameterNames(
        previousParameters: URLSearchParams,
        currentParameters: URLSearchParams,
    ): string[] {
        const parameterNames = new Set([
            ...previousParameters.keys(),
            ...currentParameters.keys(),
        ]);
        const changedParameterNames: string[] = [];

        for (const parameterName of parameterNames) {
            const previousValues =
                previousParameters.getAll(
                    parameterName,
                );
            const currentValues =
                currentParameters.getAll(
                    parameterName,
                );

            if (
                previousValues.length !==
                    currentValues.length ||
                previousValues.some(
                    (value, index) =>
                        value !==
                        currentValues[index],
                )
            ) {
                changedParameterNames.push(
                    parameterName,
                );
            }
        }

        return changedParameterNames;
    }

    protected _emitQueryParameterChanges(
        parameterNames: readonly string[],
    ): void {
        for (const parameterName of parameterNames) {
            this._queryChangeEvent(parameterName);
        }
    }

    get data():
        ReadonlyMap<string, unknown> {
        return this._dataStructure;
    }

    get children(): HTMLCollection {
        return this.container.children;
    }

    get childNodes(): NodeListOf<ChildNode> {
        return this.container.childNodes;
    }

    get container():
        AppContainer<TApp> {
        if (!this._container) {
            throw new Error(
                "Application container is not initialized.",
            );
        }

        return this._container;
    }

    get router(): Router<TApp> {
        if (!this._router) {
            throw new Error(
                "Router is not initialized.",
            );
        }

        return this._router;
    }

    get appName(): string {
        return this._appName;
    }

    get serverComponentsUrl(): string | null {
        return this._serverComponentsUrl;
    }

    set serverComponentsUrl(value: string) {
        if (typeof value !== "string") {
            throw new TypeError(
                "Server components URL must be a string.",
            );
        }

        this._serverComponentsUrl = value;
    }

    get identifier(): string {
        return this._identifier;
    }

    get originalInnerHTML():
        ElementHtmlSetter {
        return this._originalInnerHTML;
    }

    get originalInsertAdjacentHTML():
        typeof Element.prototype.insertAdjacentHTML {
        return this
            ._originalInsertAdjacentHTML;
    }

    get queryParameters():
        Record<string, string> {
        return Object.fromEntries(
            new URLSearchParams(
                location.search,
            ),
        );
    }

    set queryParameters(
        params: Record<string, string>,
    ) {
        const url =
            new URL(location.href);
        const previousParameters =
            new URLSearchParams(url.search);

        url.search = "";

        for (
            const [key, value]
            of Object.entries(params)
        ) {
            url.searchParams.set(
                key,
                value,
            );
        }

        const changedParameterNames =
            this._getChangedQueryParameterNames(
                previousParameters,
                url.searchParams,
            );

        if (changedParameterNames.length === 0) {
            return;
        }

        history.pushState(
            history.state,
            "",
            url,
        );

        this._emitQueryParameterChanges(
            changedParameterNames,
        );
    }

    setQueryParameters(params: Record<
            string, string
        >,): void{
        this.queryParameters = params;
    }

    updateQueryParameters(
        params: Record<
            string,
            string | number | null
        >,
    ): void {
        const url =
            new URL(location.href);
        const previousParameters =
            new URLSearchParams(url.search);

        for (
            const [key, value]
            of Object.entries(params)
        ) {
            if (value === null) {
                url.searchParams.delete(key);
                continue;
            }

            url.searchParams.set(
                key,
                String(value),
            );
        }

        const changedParameterNames =
            this._getChangedQueryParameterNames(
                previousParameters,
                url.searchParams,
            );

        if (changedParameterNames.length === 0) {
            return;
        }

        history.pushState(
            history.state,
            "",
            url,
        );

        this._emitQueryParameterChanges(
            changedParameterNames,
        );
    }

    createQueryParametersString(
        params: Record<
            string,
            string | number
        >,
    ): string {
        const searchParams =
            new URLSearchParams();

        for (
            const [key, value]
            of Object.entries(params)
        ) {
            searchParams.set(
                key,
                String(value),
            );
        }

        return searchParams.toString();
    }

    getTemplateCacheKey(
        tagName: string,
        args: Record<string, unknown> = {},
    ): string {
        const queryParameters = Array.from(
            new URLSearchParams(location.search).entries(),
        ).sort(
            ([firstKey, firstValue], [secondKey, secondValue]) =>
                firstKey.localeCompare(secondKey) ||
                firstValue.localeCompare(secondValue),
        );
        const routeParameters =
            this._router?.routeParameters ?? {};

        return stableSerialize({
            tagName: tagName.toLowerCase(),
            routeParameters,
            queryParameters,
            args,
            appData: Object.fromEntries(
                this._dataStructure,
            ),
        });
    }

    setCachedTemplate(
        key: string,
        template: string,
        duration: number,
    ): void {
        assertCacheDuration(duration, "duration");

        if (duration === 0) {
            this._templatesCache.delete(key);
            return;
        }

        this._templatesCache.set(key, {
            template,
            duration,
            setTime: Date.now(),
        });
    }

    getCachedTemplate(key: string): string | null {
        const cache = this._templatesCache.get(key);

        if (!cache) {
            return null;
        }

        if (
            Date.now() - cache.setTime >=
            cache.duration * 1000
        ) {
            this._templatesCache.delete(key);
            return null;
        }

        return cache.template;
    }

    async getOrSetCachedTemplate(
        key: string,
        duration: number,
        templateFactory: () => string | Promise<string>,
    ): Promise<string> {
        const cachedTemplate =
            this.getCachedTemplate(key);

        if (cachedTemplate !== null) {
            return cachedTemplate;
        }

        const pendingTemplate =
            this._pendingTemplateCache.get(key);

        if (pendingTemplate) {
            return await pendingTemplate;
        }

        const templatePromise = Promise.resolve()
            .then(templateFactory)
            .then(template => {
                this.setCachedTemplate(
                    key,
                    template,
                    duration,
                );
                return template;
            })
            .finally(() => {
                this._pendingTemplateCache.delete(key);
            });

        this._pendingTemplateCache.set(
            key,
            templatePromise,
        );

        return await templatePromise;
    }

    removeCachedTemplate(key: string): boolean {
        return this._templatesCache.delete(key);
    }

    cleanTemplatesCache = (): number => {
        const currentTime = Date.now();
        let removedEntries = 0;

        for (const [key, cache] of this._templatesCache) {
            if (
                currentTime - cache.setTime >=
                cache.duration * 1000
            ) {
                this._templatesCache.delete(key);
                removedEntries++;
            }
        }

        return removedEntries;
    };

    protected _startTemplatesCacheCleanup(): void {
        if (this._templatesCacheCleanupTimer !== null) {
            globalThis.clearInterval(
                this._templatesCacheCleanupTimer,
            );
            this._templatesCacheCleanupTimer = null;
        }

        if (this._templatesCacheCleanupInterval === 0) {
            return;
        }

        this._templatesCacheCleanupTimer =
            globalThis.setInterval(
                this.cleanTemplatesCache,
                this._templatesCacheCleanupInterval * 1000,
            );
    }

    get hash(): string {
        return location.hash;
    }

    get port(): string {
        return location.port;
    }

    get hostname(): string {
        return location.hostname;
    }

    get host(): string {
        return location.host;
    }

    get pathname(): string {
        return location.pathname;
    }

    get origin(): string {
        return location.origin;
    }

    get templatesCacheDuration(): number {
        return this._templatesCacheDefaultDuration;
    }

    set templatesCacheDuration(duration: number) {
        assertCacheDuration(
            duration,
            "templatesCacheDuration",
        );
        this._templatesCacheDefaultDuration = duration;
    }

    get templatesCacheCleanupInterval(): number {
        return this._templatesCacheCleanupInterval;
    }

    set templatesCacheCleanupInterval(
        interval: number,
    ) {
        assertCacheDuration(
            interval,
            "templatesCacheCleanupInterval",
        );
        this._templatesCacheCleanupInterval = interval;
        this._startTemplatesCacheCleanup();
    }
}

export default App;
