import App, {
    type AppContainer,
    dataEventEnum,
} from "./app.js";
import { replaceShorthandAttributes } from "./templateAttributes.js";
import {
    awaitWithSignal,
    ElementDisconnectedError,
    isElementCancellation,
} from "./cancellation.js";

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

    constructor(elementName: string, options?: ErrorOptions) {
        super(`Failed to render element ${elementName}`, options);
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
    groupName?: string | null;
    routeParameters?: Record<string, string|number>|null;
    queryParameters?: Record<string, string> | null;
    attributes?: Record<string, unknown> | null;
}

export type ResolvedFetchHtmlRequest = {
    tagName: string;
    groupName: string;
    routeParameters: Record<string, string | number>;
    queryParameters: Record<string, string>;
    attributes: Record<string, unknown>;
};

export type FetchHtmlOptions = {
    signal?: AbortSignal | null;
    cache?: boolean;
    cacheDuration?: number | null;
    cacheKey?: string | null;
};

export type PrefetchHtmlOptions = Omit<
    FetchHtmlOptions,
    "signal" | "cache"
>;

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

    protected readonly _abortController = new AbortController();

    protected _renderController: AbortController | null = null;

    get abortSignal(): AbortSignal {
        return this._abortController.signal;
    }

    readonly initComplete: Promise<void>;

    rndId: number;

    hashId = "";

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

        this.abortSignal.addEventListener("abort", () => {
            this._abort = true;
            this._renderController?.abort(this.abortSignal.reason);
            this._failInitialization(this.abortSignal.reason);
        }, { once: true });

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
        try {
            await this.initElement();
        } catch (error) {
            if (!isElementCancellation(error)) throw error;
        }
    }

    disconnectedCallback(): void {
        this._abortController.abort(new ElementDisconnectedError(this.tagName));
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
        ).catch(error => this.app.handleErrorOnce(error));
    }

    initElement = (): Promise<void> => {
        if (this._initializationTask) {
            return this._initializationTask;
        }

        if (this._initializationState !== "pending") {
            return this.initComplete;
        }

        this._initializationTask =
            awaitWithSignal(this._initializeElement(), this.abortSignal);

        return this._initializationTask;
    };

    protected _initializeElement = async (): Promise<void> => {
        try {
            this.abortSignal.throwIfAborted();
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

            // Children can initialize before their parent adopts their host.
            this._normalizePrerenderedAttributes(this);

            await awaitWithSignal(this._loadDependencies(), this.abortSignal);

            this._throwIfInitializationAborted();

            await this._runLifecycle(
                Lifecycle.BEFORE_INIT
            );

            this._throwIfInitializationAborted();

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

            if (!this.useServer && !this.markup) {
                this._initializePrerenderedMarkup();
            } else {
                await this.render();
            }

            this._throwIfInitializationAborted();

            await this._waitForSubelements();

            this._throwIfInitializationAborted();

            await this._runLifecycle(
                Lifecycle.BEFORE_INIT_RESOLVE,
            );

            this.abortSignal.throwIfAborted();

            this._completeInitialization();

            await this._runLifecycle(
                Lifecycle.AFTER_INIT,
            );
        } catch (error: unknown) {
            this._abort = true;

            if (this.abortSignal.aborted || isElementCancellation(error)) {
                const cancellation = this.abortSignal.aborted
                    ? this.abortSignal.reason
                    : error;
                this._failInitialization(cancellation as Error);
                throw cancellation;
            }

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

    protected _throwIfInitializationAborted(): void {
        if (!this._abort && this.isConnected) {
            return;
        }

        if (!this.abortSignal.aborted) {
            this._abortController.abort(new ElementDisconnectedError(this.tagName));
        }
        this.abortSignal.throwIfAborted();
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
        if (this.abortSignal.aborted || isElementCancellation(error)) return;
        await this.app.handleErrorOnce(error);
    }

    protected async _runLifecycle(
        stage: Lifecycle,
        signal: AbortSignal = this.abortSignal,
    ): Promise<void> {
        const disconnecting = stage === Lifecycle.AFTER_DISCONNECT;
        if (!disconnecting) signal.throwIfAborted();
        for (const { name, method } of getLifecycleMethods(this, stage)) {
            try {
                if (disconnecting) {
                    await method.call(this);
                } else {
                    signal.throwIfAborted();
                    await awaitWithSignal(
                        Promise.resolve(method.call(this)),
                        signal,
                    );
                    signal.throwIfAborted();
                }
            } catch (error: unknown) {
                if (isElementCancellation(error)) throw error;
                throw new MethodExecutionError(
                    name,
                    this.tagName,
                    { cause: error },
                );
            }
        }
        if (!disconnecting) signal.throwIfAborted();
    }

    protected async _markup(): Promise<string> {
        try {
            if(this.markup == null){
                throw new MissingMarkupMethod(this.tagName);
            }
            return await this.markup.call(this);
        } catch (error: unknown) {
            if (isElementCancellation(error)) throw error;
            if (
                error instanceof
                MissingMarkupMethod
            ) {
                throw error;
            }
            throw new RenderError(this.tagName, { cause: error });
        }
    }

    templateCacheKey(
        request?: FetchHtmlRequest,
    ): string {
        return request
            ? this.app.getServerComponentCacheKey(request)
            : this.app.getTemplateCacheKey(
                  this.tagName,
                  this.args,
              );
    }

    protected _normalizePrerenderedAttributes(element: Element): void {
        for (const attribute of Array.from(element.attributes)) {
            const prefix = attribute.name[0];
            if (prefix !== ":" && prefix !== "@") continue;

            const suffix = attribute.name.substring(1);
            if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(suffix)) {
                throw new Error(
                    `Invalid shorthand attribute '${attribute.name}' ` +
                    `on <${element.localName}>.`,
                );
            }

            const normalizedName = prefix === ":"
                ? `data-jolt-${suffix}`
                : `jolt-${suffix}`;
            if (!element.hasAttribute(normalizedName)) {
                element.setAttribute(normalizedName, attribute.value);
            }
            // removeAttribute(":name") would remove the canonical attribute.
            element.removeAttributeNode(attribute);
        }
    }

    protected _isCustomElementBoundary(element: Element): boolean {
        return element.namespaceURI === "http://www.w3.org/1999/xhtml" &&
            element.localName.includes("-");
    }

    protected _getOwnedElements(roots: readonly Element[]): Element[] {
        const owned: Element[] = [];
        const visited = new Set<Element>();
        const visit = (element: Element): void => {
            if (visited.has(element)) return;
            visited.add(element);
            owned.push(element);
            // Include child hosts, but never their contents, even before upgrade.
            if (this._isCustomElementBoundary(element)) return;
            for (const child of Array.from(element.children)) {
                visit(child);
            }
        };

        for (const root of roots) {
            // Explicit insertion roots may themselves be inside another component.
            let parent = root.parentElement;
            while (parent && parent !== this) {
                if (this._isCustomElementBoundary(parent)) break;
                parent = parent.parentElement;
            }
            if (parent === this) visit(root);
        }
        return owned;
    }

    protected _getPrerenderedOwnedElements(): Element[] {
        const owned = this._getOwnedElements(Array.from(this.children));
        for (const child of owned) {
            if (this._isCustomElementBoundary(child) && !customElements.get(child.localName)) {
                throw new Error(
                    `Cannot initialize <${this.localName}>: ` +
                    `child <${child.localName}> is not registered. ` +
                    `Register it before initialization or declare it ` +
                    `in the host component's dependencies.`,
                );
            }
        }
        return owned;
    }

    protected _initializePrerenderedMarkup(): void {
        this.abortSignal.throwIfAborted();
        const elements = this._getPrerenderedOwnedElements();
        this._lastRender = Date.now();
        const renderTime = this.lastRender.toString();

        for (const element of elements) {
            this.abortSignal.throwIfAborted();
            this._normalizePrerenderedAttributes(element);
            element.setAttribute("data-parent-id", this.hashId);
            element.setAttribute("data-render-time", renderTime);
        }

        this.abortSignal.throwIfAborted();
        this._hydrateElements(elements);
    }

    protected _beginRender(): AbortSignal {
        this.abortSignal.throwIfAborted();
        const previous = this._renderController;
        this._renderController = new AbortController();
        previous?.abort();
        this._abort = false;
        return this._renderController.signal;
    }

    render = async (signal: AbortSignal = this._beginRender()): Promise<void> => {
        try {
            signal.throwIfAborted();

            let renderedHtml: string;

            if (this.useServer) {
                renderedHtml = await awaitWithSignal(this._fetchHTML(signal), signal);
            } else {
                const renderTemplate = async (): Promise<string> => {
                if (!this.markup) {
                    const markup = this.innerHTML.trim();
                    return markup;
                }
                return await this._markup();
                };

                if (this.cache) {
                    const cacheKey =
                        this.templateCacheKey();

                    if (
                        typeof cacheKey !== "string" ||
                        cacheKey.trim().length === 0
                    ) {
                        throw new TypeError(
                            "templateCacheKey must return a non-empty string.",
                        );
                    }

                    const cacheDuration =
                        this.cacheDuration ??
                        this.app.templatesCacheDuration;

                    renderedHtml = cacheDuration > 0
                        ? await awaitWithSignal(
                              this.app.getOrSetCachedTemplate(
                                  cacheKey,
                                  cacheDuration,
                                  renderTemplate,
                              ),
                              signal,
                          )
                        : await awaitWithSignal(
                              renderTemplate(),
                              signal,
                          );
                } else {
                    renderedHtml = await awaitWithSignal(
                        renderTemplate(),
                        signal,
                    );
                }
            }

            signal.throwIfAborted();
            this._templateSettings = {
                ...this._templateSettings,
                dataBinds: new Map(),
            };
            this.innerHTML = renderedHtml;
        } catch (error: unknown) {
            if (this.abortSignal.aborted) throw this.abortSignal.reason;
            if (signal.aborted) return;
            this._abort = true;

            throw error;
        }
    };

    _fetchHTML = async (
        signal: AbortSignal | null = this.abortSignal,
    ): Promise<string> => {
        const request = this._createFetchHTMLRequest();

        return await this.fetchHTML(request, {
            signal,
            cache: this.cache,
            cacheDuration:
                this.cacheDuration ??
                this.app.templatesCacheDuration,
            cacheKey: this.cache
                ? this.templateCacheKey(request)
                : null,
        });
    }

    protected _createFetchHTMLRequest = (): FetchHtmlRequest => {
        return {
            tagName: this.tagName.toLowerCase(),
            groupName: this.groupName == null ? "default" : this.groupName,
            queryParameters: this.app.queryParameters || {},
            routeParameters: this.app.currentRouteParameters,
            attributes: this.args,
        };
    }

    protected _resolveFetchHTMLRequest = (
        request: FetchHtmlRequest,
    ): ResolvedFetchHtmlRequest => {
        const tagName = request.tagName.trim().toLowerCase();

        if (tagName.length === 0) {
            throw new TypeError(
                "Server component tagName must be a non-empty string.",
            );
        }

        return {
            tagName,
            groupName: request.groupName?.trim() || "default",
            queryParameters:
                request.queryParameters ??
                this.app.queryParameters,
            routeParameters:
                request.routeParameters ??
                this.app.currentRouteParameters,
            attributes: request.attributes ?? {},
        };
    }

    fetchHTML = async (
        request: FetchHtmlRequest,
        optionsOrSignal: FetchHtmlOptions | AbortSignal | null = {},
    ): Promise<string> => {
        const options: FetchHtmlOptions =
            optionsOrSignal instanceof AbortSignal
                ? { signal: optionsOrSignal }
                : optionsOrSignal === null
                  ? { signal: null }
                  : optionsOrSignal;
        const signal = options.signal === undefined
            ? this.abortSignal
            : options.signal;
        const resolvedRequest =
            this._resolveFetchHTMLRequest(request);

        signal?.throwIfAborted();

        const cacheDuration =
            options.cacheDuration ??
            this.app.templatesCacheDuration;

        if (
            !Number.isFinite(cacheDuration) ||
            cacheDuration < 0
        ) {
            throw new TypeError(
                "cacheDuration must be a finite, non-negative number.",
            );
        }

        if (!options.cache || cacheDuration === 0) {
            return await this._requestHTML(
                resolvedRequest,
                signal,
            );
        }

        const cacheKey = options.cacheKey ??
            this.app.getServerComponentCacheKey(
                resolvedRequest,
            );

        if (
            typeof cacheKey !== "string" ||
            cacheKey.trim().length === 0
        ) {
            throw new TypeError(
                "Server component cache key must return a non-empty string.",
            );
        }

        const sharedRequest =
            this.app.getOrSetCachedTemplate(
                cacheKey,
                cacheDuration,
                () => this._requestHTML(
                    resolvedRequest,
                    null,
                ),
            );

        return signal
            ? await awaitWithSignal(
                  sharedRequest,
                  signal,
              )
            : await sharedRequest;
    };

    prefetchHTML = async (
        request: FetchHtmlRequest,
        options: PrefetchHtmlOptions = {},
    ): Promise<string> => {
        return await this.fetchHTML(request, {
            signal: null,
            cache: true,
            cacheDuration:
                options.cacheDuration ??
                this.app.templatesCacheDuration,
            cacheKey: options.cacheKey ?? null,
        });
    };

    protected _requestHTML = async (
        request: ResolvedFetchHtmlRequest,
        signal: AbortSignal | null,
    ): Promise<string> => {
        signal?.throwIfAborted();
        if (!this.app.serverComponentsUrl) {
            throw new Error(
                "If using server components you need to provide the " +
                "'serverComponentsUrl' property at application initialization."
            );
        }
        let response: Response;
        try {
            const queryString =
                this.app.createQueryParametersString(
                    request.queryParameters,
                );
            const url = queryString
                ? `${this.app.serverComponentsUrl}?${queryString}`
                : this.app.serverComponentsUrl;
            response = await fetch(url, {
                method: "POST",
                signal,
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                    
                },
                body: JSON.stringify(request)
            });
        } catch {
            signal?.throwIfAborted();
            throw new NetworkError(
                "Failed to fetch requested content. Server unresponsive."
            );
        }
        signal?.throwIfAborted();
        if (!response.ok) {
            return this._checkFetchHTMLError(
                response,
                request,
            );
        }
        try {
            const text = await response.text();
            signal?.throwIfAborted();
            if(text.trim().length === 0){
                throw new MarkupFetchError(
                    "Fetched HTML markup was empty for a 2xx response.",
                    this.tagName
                );
            }
            return text;
        } catch(error: unknown){
            signal?.throwIfAborted();
            if (error instanceof MarkupFetchError) {
                throw error;
            }
            throw new MarkupFetchError(
                "Failed to read fetched html markup for 2xx responses.",
                request.tagName,
            );
        }
    };

    _checkFetchHTMLError = (
        response: Response,
        request: ResolvedFetchHtmlRequest,
    ): never => {
        const requestedPath =
            `${location.pathname}${location.search}`;

        if(response.status >= 500){
            throw new InternalServerError(`Server component fetch failed with status ${response.status}`);
        }
        switch(response.status){
            case 400:
                throw new ServerComponentBadRequestResponse(request.tagName, request.groupName);
            case 401:   
                throw new AuthenticationError(requestedPath);
            case 403:
                throw new AuthorizationError(requestedPath, []);
            case 404:
                throw new ServerComponentNotFound(request.tagName, request.groupName)
            default:
                throw new HttpRequestError("POST", response);
        }
    }

    rerender = async (): Promise<void> => {
        const signal = this._beginRender();
        try {
            await this._runLifecycle(
                Lifecycle.BEFORE_RERENDER,
                signal,
            );
            signal.throwIfAborted();

            await awaitWithSignal(this.render(signal), signal);
            signal.throwIfAborted();

            if (this._abort) {
                return;
            }

            await awaitWithSignal(this._waitForSubelements(), signal);
            signal.throwIfAborted();

            await this._runLifecycle(
                Lifecycle.AFTER_RERENDER,
                signal,
            );
        } catch (error: unknown) {
            if (this.abortSignal.aborted) throw this.abortSignal.reason;
            if (signal.aborted) return;
            this._abort = true;
            await this._handleError(error);
            throw error;
        }
    };

    protected async _waitForSubelements(): Promise<
        void
    > {
        this.abortSignal.throwIfAborted();
        const customElements = Array.from(
            this.querySelectorAll("*"),
        ).filter(
            (
                element,
            ): element is CustomElement =>
                element instanceof CustomElement,
        ).filter(element => {
            // HTML wrappers do not establish a component boundary.
            let parent = element.parentElement;
            while (parent && parent !== this) {
                if (parent instanceof CustomElement) return false;
                parent = parent.parentElement;
            }
            return parent === this;
        });

        await awaitWithSignal(Promise.all(
            customElements.map(
                element => element.initComplete,
            ),
        ), this.abortSignal);
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
        if (this.abortSignal.aborted) return;
        const templates =
            this._templateSettings.dataBinds.get(
                propertyName,
            );

        if (!templates) {
            return;
        }

        this._renderTime = Date.now();

        this.querySelectorAll<HTMLElement>(
            `[data-bind="${propertyName}"]`,
        ).forEach(element => {
            if (this.abortSignal.aborted) return;
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

            if (this.abortSignal.aborted) return;
            element.innerHTML =
                elementTemplate;
        });
    }

    protected _hydrate = (
        roots: readonly Element[] | null = null,
    ): void => {
        const elements = roots
            ? this._getOwnedElements(roots)
            : this._getOwnedElements(Array.from(this.children)).filter(
                  element =>
                      element.getAttribute("data-parent-id") === this.hashId &&
                      element.getAttribute("data-render-time") === String(this.lastRender),
              );

        this._hydrateElements(elements);
    };

    protected _hydrateElements(elements: Iterable<Element>): void {
        const elementsWithEvents =
            this._allElementsWithEvents(
                elements,
            );
        this._setEventListeners(
            elementsWithEvents,
        );
    }

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
            this.abortSignal.throwIfAborted();
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
                await awaitWithSignal(Promise.resolve(boundMethod.call(
                    this,
                    event,
                    args,
                )), this.abortSignal);
            } else {
                await awaitWithSignal(Promise.resolve(boundMethod.call(
                    this,
                    event,
                )), this.abortSignal);
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

        for (const child of this._getOwnedElements(roots)) {
            child.setAttribute(
                "data-parent-id",
                this.hashId,
            );

            child.setAttribute(
                "data-render-time",
                this.lastRender.toString(),
            );
        }
    };

    protected _replaceAtWithJolt(
        template: string,
    ): string {
        return replaceShorthandAttributes(template, "@", "jolt-");
    }

    protected _replaceColonWithData(
        template: string,
    ): string {
        return replaceShorthandAttributes(template, ":", "data-jolt-");
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
