import App from "./app.js";
import { CustomElement, type CustomElementClass } from "./customElement.js";
import { type AuthenticationMetadata, type LayoutMetadata, type PageMetadata, type SubLayoutConfig } from "./elementMetadata.js";
export declare const routeEventsEnum: {
    readonly START: "route-change.start";
    readonly FINISHED: "route-change.finished";
    readonly LAYOUT_CHANGE_FINISHED: "route-change.layout-change.finished";
};
export declare class RouteFailedError extends Error {
    constructor(options?: ErrorOptions);
}
export declare class RouteNotFoundError extends Error {
    protected readonly route: string;
    constructor(route: string, options?: ErrorOptions);
}
export declare class RouteParametersError extends Error {
    protected readonly path: string;
    constructor(path: string, options?: ErrorOptions);
}
export declare class UnsupportedRouteParameterType extends Error {
    protected readonly type: string;
    constructor(type: string, options?: ErrorOptions);
}
export type RouteParameters = Record<string, string | number>;
export type Authentication = {
    authenticationRequired: boolean;
    rolesRequired: readonly unknown[];
};
export type RouteAuthenticationRequirement<TApp extends App = App> = Readonly<{
    element: CustomElementClass<TApp>;
    authentication: AuthenticationMetadata;
}>;
export type MaybePromise<T> = T | Promise<T>;
export type HandlerArgs = Record<string, unknown>;
export type RouteExtras = Record<string, unknown>;
export type Route<TApp extends App = App> = {
    path: string;
    handler: CustomElementClass<TApp>;
    target: string;
    layout: CustomElementClass<TApp>;
    subLayouts: readonly SubLayoutConfig<TApp>[];
    title: string | null;
    extras: RouteExtras;
    authentication: Authentication | null;
    authenticationChain: readonly RouteAuthenticationRequirement<TApp>[];
};
export type ParsedRoute<TApp extends App = App> = {
    handler: CustomElementClass<TApp>;
    target: string;
    layout: CustomElementClass<TApp>;
    subLayouts: readonly SubLayoutConfig<TApp>[];
    title: string | null;
    extras: RouteExtras;
    authentication: Authentication | null;
    authenticationChain: readonly RouteAuthenticationRequirement<TApp>[];
    args: HandlerArgs | null;
    route: string;
};
export type MatchedRoute<TApp extends App = App> = ParsedRoute<TApp> & {
    path: string;
    pattern: string;
    parameters: RouteParameters;
};
export type RouterConfig<TApp extends App> = {
    baseUrl?: string;
    baseLayout: CustomElementClass<TApp>;
    defaultTarget: string;
    indexRoute?: string;
    app: TApp;
    pages?: readonly CustomElementClass<TApp>[] | null;
};
export type RedirectOptions = {
    useBaseUrl?: boolean;
    baseParameters?: RouteParameters;
};
export type ErrorPageOptions<TApp extends App = App> = {
    layout?: CustomElementClass<TApp>;
    target?: string;
    title?: string | null;
    args?: HandlerArgs | null;
    error?: Error;
};
type RouteSpecificity = {
    segments: readonly number[];
    literalCount: number;
    parameterCount: number;
    integerParameterCount: number;
};
type ScrollPosition = {
    x: number;
    y: number;
};
type CurrentState = {
    scrollPosition: ScrollPosition;
};
type Navigation = {
    controller: AbortController;
    elements: Set<CustomElement>;
    renderingErrorPage?: boolean;
};
type ActiveSubLayout<TApp extends App = App> = {
    target: string;
    layout: CustomElementClass<TApp>;
    container: Element;
    element: CustomElement<TApp>;
};
declare class Router<TApp extends App> {
    readonly pages: readonly CustomElementClass<TApp>[];
    protected readonly _app: TApp;
    protected readonly _baseLayout: CustomElementClass<TApp>;
    protected readonly _defaultTarget: string;
    protected readonly _indexRoute: string;
    protected readonly _baseUrl: string;
    protected readonly _routes: Route<TApp>[];
    protected readonly _routesMap: Map<string, ParsedRoute<TApp>>;
    protected _currentRoute: MatchedRoute<TApp> | null;
    protected _routeParameters: RouteParameters;
    protected _navigation: Navigation | null;
    protected readonly _errorNavigations: WeakMap<Error, Navigation>;
    protected _activeSubLayouts: ActiveSubLayout<TApp>[];
    constructor({ baseUrl, baseLayout, defaultTarget, indexRoute, app, pages, }: RouterConfig<TApp>);
    isAuthenticated(): MaybePromise<boolean>;
    checkUserRoles(_roles: unknown[]): MaybePromise<boolean>;
    titleGenerator(_tagName: string, _title: string | null): MaybePromise<string>;
    protected _discoverRoutes(): Route<TApp>[];
    protected _createRouteFromMetadata(handler: CustomElementClass<TApp>, metadata: PageMetadata<TApp>): Route<TApp>;
    protected _createAuthenticationChain(handler: CustomElementClass<TApp>, pageMetadata: PageMetadata<TApp>, layout: CustomElementClass<TApp>, layoutMetadata: LayoutMetadata): readonly RouteAuthenticationRequirement<TApp>[];
    protected _parseRoutes(routes: readonly Route<TApp>[]): Map<string, ParsedRoute<TApp>>;
    protected _normalizePath(path: string): string;
    protected _normalizeBaseUrl(baseUrl: string): string;
    protected _joinBaseUrl(path: string): string;
    protected _sortRoutes(routeMap: Map<string, ParsedRoute<TApp>>): Map<string, ParsedRoute<TApp>>;
    protected _getRouteSpecificity(path: string): RouteSpecificity;
    protected _popStateHandler: (event: PopStateEvent) => Promise<void>;
    protected _clickHandler: (event: MouseEvent) => Promise<void>;
    protected _beginNavigation(): Navigation;
    showErrorPage: (handler: CustomElementClass<TApp>, options?: ErrorPageOptions<TApp>) => Promise<void>;
    route: () => Promise<void>;
    protected _authorizeRoute: (matchedPath: MatchedRoute<TApp>, navigation: Navigation) => Promise<void>;
    protected _loadPath: (matchedPath: Pick<ParsedRoute<TApp>, "handler" | "layout" | "target" | "subLayouts" | "title" | "args">, navigation: Navigation, currentRoute: MatchedRoute<TApp> | null) => Promise<void>;
    protected _renderSubLayouts(baseLayout: CustomElement<TApp>, subLayouts: readonly SubLayoutConfig<TApp>[], navigation: Navigation): Promise<CustomElement<TApp>>;
    protected _clearSubLayoutsFrom(index: number): void;
    protected _findLayoutTarget(root: CustomElement<TApp>, selector: string): Element | null;
    protected _renderLayout: (layout: CustomElementClass<TApp>, navigation: Navigation) => Promise<void>;
    protected _setTitle(tagName: string, title: string | null, navigation: Navigation): Promise<void>;
    protected _trackNavigationElement(element: CustomElement, navigation: Navigation): void;
    setTitle(title: string): Promise<void>;
    protected _emitRouteEvent(eventType: string): void;
    protected _matchRoute(path: string): MatchedRoute<TApp>;
    redirect(path: string, options?: RedirectOptions): Promise<void>;
    protected _createBaseUrlDestination(path: string, baseParameters: RouteParameters): string;
    protected _handleLinkPress: (href: string) => Promise<void>;
    protected _getCurrentState(): CurrentState;
    urlIsCurrentPath(href: string): boolean;
    get routeParameters(): RouteParameters;
    set routeParameters(params: RouteParameters);
    get queryParameters(): Record<string, string | number>;
    get app(): TApp;
    get baseLayout(): CustomElementClass<TApp>;
    get defaultTarget(): string;
    get indexRoute(): string;
    get baseUrl(): string;
    get routes(): Route<TApp>[];
    get routesMap(): ReadonlyMap<string, ParsedRoute<TApp>>;
    get currentRoute(): MatchedRoute<TApp> | null;
    set currentRoute(route: MatchedRoute<TApp> | null);
    get origin(): string;
    get hash(): string;
    get port(): string;
    get hostname(): string;
    get host(): string;
    get pathname(): string;
}
export default Router;
//# sourceMappingURL=router.d.ts.map