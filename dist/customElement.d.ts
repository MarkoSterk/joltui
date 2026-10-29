import { type ErrorResponse } from "./errorResponse.js";
import App from "./app.js";
import { type DoTDataBindTemplates, type DoTSanitizeFunction, type DoTTemplateSettings } from "./dotjs/dot.js";
import { Lifecycle } from "./lifecycle.js";
import { type ElementMetadata } from "./elementMetadata.js";
import type { LazyDependency } from "./lazy.js";
export declare class RenderError extends Error {
    protected readonly elementName: string;
    constructor(elementName: string, options?: ErrorOptions);
}
export declare class MissingMarkupMethod extends Error {
    protected readonly elementName: string;
    constructor(elementName: string);
}
export declare class DotJSEngineError extends Error {
    protected readonly elementName: string;
    constructor(elementName: string, options?: ErrorOptions);
}
export declare class MethodExecutionError extends Error {
    protected readonly methodName: string;
    protected readonly elementName: string;
    constructor(methodName: string, elementName: string, options?: ErrorOptions);
}
export type InitializationState = "pending" | "fulfilled" | "rejected";
export declare class ElementInitializationError extends Error {
    readonly element: CustomElement;
    readonly elementName: string;
    constructor(element: CustomElement, options?: ErrorOptions);
}
export declare class MarkupFetchError extends Error {
    protected elementName: string;
    constructor(msg: string, tagName: string);
}
export type FetchHtmlRequest = {
    tagName: string;
    groupName?: string | null;
    routeParameters?: Record<string, string | number> | null;
    queryParameters?: Record<string, string> | null;
    attributes?: Record<string, unknown> | null;
};
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
export type PrefetchHtmlOptions = Omit<FetchHtmlOptions, "signal" | "cache">;
type MaybePromise<T> = T | Promise<T>;
export type ComponentMethod = (this: CustomElement, ...args: any[]) => MaybePromise<unknown>;
export type MarkupMethod = (this: CustomElement) => MaybePromise<string>;
export type TemplateFunction = (this: CustomElement, ...args: unknown[]) => unknown;
export type CustomElementClass<TApp extends App = App, TElement extends CustomElement<TApp> = CustomElement<TApp>> = CustomElementConstructor & {
    new (): TElement;
    readonly tagName: string;
    readonly dependencies: readonly LazyDependency[];
    generate(hashId?: string | null, args?: Record<string, unknown> | null): string;
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
export declare function randomId(max?: number, min?: number): number;
export declare const html: (strings: TemplateStringsArray, ...values: unknown[]) => string;
export declare abstract class CustomElement<TApp extends App = App> extends HTMLElement {
    static readonly tagName: string;
    static readonly dependencies: readonly LazyDependency[];
    protected _app: TApp | null;
    protected _resolveInitialization: (() => void) | null;
    protected _rejectInitialization: ((reason: Error) => void) | null;
    protected _initializationState: InitializationState;
    protected _initializationError: Error | null;
    protected _initializationTask: Promise<void> | null;
    protected _templateSettings: TemplateSettings;
    protected _parent: CustomElement | null;
    protected _renderTime: number;
    protected _lastRender: number;
    protected _abort: boolean;
    protected readonly _abortController: AbortController;
    protected _renderController: AbortController | null;
    get abortSignal(): AbortSignal;
    readonly initComplete: Promise<void>;
    rndId: number;
    hashId: string;
    markup: MarkupMethod | null;
    constructor();
    connectedCallback(): Promise<void>;
    disconnectedCallback(): void;
    initElement: () => Promise<void>;
    protected _initializeElement: () => Promise<void>;
    protected _completeInitialization(): void;
    protected _failInitialization(error: Error): void;
    protected _throwIfInitializationAborted(): void;
    protected _loadDependencies(): Promise<void>;
    protected _handleError(error: unknown): Promise<void>;
    protected _runLifecycle(stage: Lifecycle, signal?: AbortSignal): Promise<void>;
    protected _markup(): Promise<string>;
    templateCacheKey(request?: FetchHtmlRequest): string;
    protected _normalizePrerenderedAttributes(element: Element): void;
    protected _isCustomElementBoundary(element: Element): boolean;
    protected _getOwnedElements(roots: readonly Element[]): Element[];
    protected _getPrerenderedOwnedElements(): Element[];
    protected _initializePrerenderedMarkup(): void;
    protected _beginRender(): AbortSignal;
    render: (signal?: AbortSignal) => Promise<void>;
    _fetchHTML: (signal?: AbortSignal | null) => Promise<string>;
    protected _createFetchHTMLRequest: () => FetchHtmlRequest;
    protected _resolveFetchHTMLRequest: (request: FetchHtmlRequest) => ResolvedFetchHtmlRequest;
    fetchHTML: (request: FetchHtmlRequest, optionsOrSignal?: FetchHtmlOptions | AbortSignal | null) => Promise<string>;
    prefetchHTML: (request: FetchHtmlRequest, options?: PrefetchHtmlOptions) => Promise<string>;
    protected _requestHTML: (request: ResolvedFetchHtmlRequest, signal: AbortSignal | null) => Promise<string>;
    _checkFetchHTMLError: (response: Response, request: ResolvedFetchHtmlRequest, details?: ErrorResponse) => never;
    rerender: () => Promise<void>;
    protected _waitForSubelements(): Promise<void>;
    generateHash(length?: number): string;
    protected _updateBoundAppDataParts: EventListener;
    protected _updateBoundQueryParamParts: EventListener;
    invalidate(bindingName: string): void;
    _refreshBoundElements(propertyName: string): void;
    protected _hydrate: (roots?: readonly Element[] | null) => void;
    protected _hydrateElements(elements: Iterable<Element>): void;
    protected _setEventListeners(elementsWithEvents: ElementEventConfig[]): void;
    protected _createEventListenerMethod(element: Element, methodName: string): EventListener;
    protected _executeElementMethod(element: Element, methodName: string, event: Event): Promise<void>;
    _getAllArgs(element: Element | HTMLElement | CustomElement): Record<string, unknown>;
    protected _allElementsWithEvents(allElements: Iterable<Element>): ElementEventConfig[];
    protected _elementWithEvent(element: Element): ElementEventConfig[];
    protected _dotJSengine: (template: string) => string;
    protected _parseStringTemplate(template: string): string;
    protected _tagInsertedElements: (roots: readonly Element[]) => void;
    protected _replaceAtWithJolt(template: string): string;
    protected _replaceColonWithData(template: string): string;
    getData(field: string): unknown;
    setData(field: string, data: unknown): void;
    get data(): ReadonlyMap<string, unknown>;
    get lastRender(): number;
    get initializationState(): InitializationState;
    get initializationError(): Error | null;
    get app(): TApp;
    get metadata(): ElementMetadata<TApp>;
    get dataField(): string | null;
    get groupName(): string | null;
    get useServer(): boolean | null;
    get cache(): boolean;
    get cacheDuration(): number | null;
    get parent(): CustomElement | null;
    get args(): Record<string, unknown>;
    get dotJSengine(): (template: string) => string;
    get tagInsertedElements(): (roots: readonly Element[]) => void;
    get hydrate(): (roots?: readonly Element[] | null) => void;
    static generate(hashId?: string | null, args?: Record<string, unknown> | null): string;
}
export declare function escapeHtmlAttribute(value: string): string;
export default CustomElement;
//# sourceMappingURL=customElement.d.ts.map