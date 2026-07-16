import App from "./app.js";
import { type CustomElementClass } from "./customElement.js";
export declare const routeEventsEnum: {
    readonly START: "route-change.start";
    readonly FINISHED: "route-change.finished";
    readonly LAYOUT_CHANGE_FINISHED: "route-change.layout-change.finished";
    readonly ERROR_PAGE_START: "route-change.error-page.start";
    readonly ERROR_PAGE_FINISHED: "route-change.error-page.finished";
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
type Authentication = {
    authenticationRequired: boolean;
    rolesRequired: unknown[];
};
type RouteHandlers = Record<string, CustomElementClass>;
type ScrollPosition = {
    x: Number;
    y: Number;
};
type CurrentState = {
    scrollPosition: ScrollPosition;
};
type HandlerArgs = Record<string, unknown>;
type RouteHandlerArgs = Record<string, HandlerArgs>;
type Route = {
    path: string;
    handler: CustomElementClass;
    target: string | null;
    details: Record<string, unknown> | null;
    authentication: Authentication | null;
    handlers?: RouteHandlers;
    layout?: CustomElementClass;
    title?: string | null;
    args?: HandlerArgs;
    children?: Route[];
    roles?: any[] | null;
};
export type MatchedRoute = ParsedRoute & {
    path: string;
    pattern: string;
    parameters: RouteParameters;
    handlers: RouteHandlers;
    authentication: Authentication | null;
};
type ParsedRoute = {
    handlers: RouteHandlers;
    layout: CustomElementClass;
    title: string | null;
    details: Record<string, unknown> | null;
    authentication: Authentication | null;
    args: RouteHandlerArgs | null;
    roles: any[] | null;
    route: string;
};
type RouteGenerator = () => Route[];
type RouterConfig<TApp extends App> = {
    baseUrl?: string;
    routes: RouteGenerator | Route[];
    baseLayout: CustomElementClass;
    defaultTarget: string;
    indexRoute?: string;
    app: TApp;
};
type ParseRoutesConfig = {
    routes: Route[];
    parentPath?: string;
    parentHandlers?: RouteHandlers;
    layout?: CustomElementClass;
};
declare class Router<TApp extends App> {
    protected readonly _app: TApp;
    protected readonly _baseLayout: CustomElementClass;
    protected readonly _defaultTarget: string;
    protected readonly _indexRoute: string;
    protected readonly _baseUrl: string;
    protected readonly _routes: Route[];
    protected readonly _routesMap: Map<string, ParsedRoute>;
    protected _currentRoute: ParsedRoute | null;
    protected _routeParameters: RouteParameters;
    protected _inTransition: boolean;
    constructor({ baseUrl, routes, baseLayout, defaultTarget, indexRoute, app, }: RouterConfig<TApp>);
    protected _handleRoutes(routes: RouteGenerator | Route[]): Route[];
    protected _parseRoutes({ routes, parentPath, parentHandlers, layout, }: ParseRoutesConfig): Map<string, ParsedRoute>;
    protected _registerCustomElement(element: CustomElementClass): void;
    protected _joinPaths(parentPath: string, routePath: string): string;
    protected _normalizePath(path: string): string;
    protected _sortRoutes(routeMap: Map<string, ParsedRoute>): Map<string, ParsedRoute>;
    protected _popStateHandler: (event: PopStateEvent) => Promise<void>;
    protected _clickHandler: (event: MouseEvent) => Promise<void>;
    route: () => Promise<any>;
    protected _loadPath: (matchedPath: MatchedRoute) => Promise<void>;
    protected _renderLayout: (layout: CustomElementClass) => Promise<void>;
    protected _setTitle: (title: string | null) => void;
    protected _emitRouteEvent: (eventType: string) => void;
    protected _matchRoute(path: string): MatchedRoute;
    protected _handleLinkPress: (href: string) => Promise<void>;
    protected _getCurrentState: () => CurrentState;
    urlIsCurrentPath: (href: string) => boolean;
    get routeParameters(): RouteParameters;
    set routeParameters(params: RouteParameters);
    get queryParameters(): Record<string, string | number>;
    get app(): TApp;
    get baseLayout(): CustomElementClass;
    get defaultTarget(): string;
    get indexRoute(): string;
    get baseUrl(): string;
    get routes(): Route[];
    get routesMap(): ReadonlyMap<string, ParsedRoute>;
    get currentRoute(): ParsedRoute | null;
    set currentRoute(route: ParsedRoute | null);
    get origin(): string;
    get hash(): string;
    get port(): string;
    get hostname(): string;
    get host(): string;
    get pathname(): string;
}
export default Router;
//# sourceMappingURL=router.d.ts.map