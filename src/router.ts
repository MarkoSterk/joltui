import App from "./app.js";
import {
    CustomElement,
    type CustomElementClass,
} from "./customElement.js";
import {
    getElementMetadata,
    requireElementMetadata,
    type PageMetadata,
} from "./elementMetadata.js";
import { NotImplementedError } from "./utilities.js";
import { AuthenticationError, AuthorizationError } from "./auth.js";

export const routeEventsEnum = {
    START: "route-change.start",
    FINISHED: "route-change.finished",
    LAYOUT_CHANGE_FINISHED:
        "route-change.layout-change.finished",
    ERROR_PAGE_START:
        "route-change.error-page.start",
    ERROR_PAGE_FINISHED:
        "route-change.error-page.finished",
} as const;

export class RouteFailedError extends Error {
    constructor(options?: ErrorOptions) {
        super("Routing failed", options);
        this.name = "RouteFailedError";
    }
}

export class RouteNotFoundError extends Error {
    protected readonly route: string;

    constructor(
        route: string,
        options?: ErrorOptions,
    ) {
        super(`Route '${route}' not found`, options);
        this.route = route;
        this.name = "RouteNotFoundError";
    }
}

export class RouteParametersError extends Error {
    protected readonly path: string;

    constructor(
        path: string,
        options?: ErrorOptions,
    ) {
        super(
            `Failed to parse route parameters for path '${path}'`,
            options,
        );
        this.path = path;
        this.name = "RouteParametersError";
    }
}

export class UnsupportedRouteParameterType extends Error {
    protected readonly type: string;

    constructor(
        type: string,
        options?: ErrorOptions,
    ) {
        super(
            `Route parameter type '${type}' is not supported`,
            options,
        );
        this.type = type;
        this.name = "UnsupportedRouteParameterType";
    }
}

export type RouteParameters = Record<
    string,
    string | number
>;

export type Authentication = {
    authenticationRequired: boolean;
    rolesRequired: unknown[];
};

export type HandlerArgs = Record<string, unknown>;

export type RouteExtras = Record<string, unknown>;

export type Route<
    TApp extends App = App,
> = {
    path: string;
    handler: CustomElementClass<TApp>;
    target: string;
    layout: CustomElementClass<TApp>;
    title: string | null;
    extras: RouteExtras;
    authentication: Authentication | null;
    roles: unknown[] | null;
};

export type ParsedRoute<
    TApp extends App = App,
> = {
    handler: CustomElementClass<TApp>;
    target: string;
    layout: CustomElementClass<TApp>;
    title: string | null;
    extras: RouteExtras;
    authentication: Authentication | null;
    args: HandlerArgs | null;
    roles: unknown[] | null;
    route: string;
};

export type MatchedRoute<
    TApp extends App = App,
> = ParsedRoute<TApp> & {
    path: string;
    pattern: string;
    parameters: RouteParameters;
};

export type RouterConfig<
    TApp extends App,
> = {
    baseUrl?: string;
    baseLayout: CustomElementClass<TApp>;
    defaultTarget: string;
    indexRoute?: string;
    app: TApp;
};

export type RedirectOptions = {
    useBaseUrl?: boolean;
    baseParameters?: RouteParameters;
};

type RouteParameterType = "str" | "int";

type ScrollPosition = {
    x: number;
    y: number;
};

type CurrentState = {
    scrollPosition: ScrollPosition;
};

function isCustomElementClass<
    TApp extends App = App,
>(
    value: unknown,
): value is CustomElementClass<TApp> {
    return (
        typeof value === "function" &&
        value.prototype instanceof CustomElement
    );
}

class Router<TApp extends App> {
    protected readonly _app: TApp;
    protected readonly _baseLayout: CustomElementClass<TApp>;
    protected readonly _defaultTarget: string;
    protected readonly _indexRoute: string;
    protected readonly _baseUrl: string;
    protected readonly _routes: Route<TApp>[];
    protected readonly _routesMap: Map<
        string,
        ParsedRoute<TApp>
    >;

    protected _currentRoute: MatchedRoute<TApp> | null = null;
    protected _routeParameters: RouteParameters = {};
    protected _inTransition = false;

    constructor({
        baseUrl = "",
        baseLayout,
        defaultTarget,
        indexRoute = "/",
        app,
    }: RouterConfig<TApp>) {
        if (!app) {
            throw new Error(
                "Missing application object in router constructor",
            );
        }

        if (!isCustomElementClass<TApp>(baseLayout)) {
            throw new TypeError(
                "Invalid base layout element class",
            );
        }

        const layoutMetadata =
            requireElementMetadata(baseLayout);

        if (layoutMetadata.kind !== "layout") {
            throw new TypeError(
                `Base layout '${baseLayout.name}' must use @layout.`,
            );
        }

        if (
            typeof defaultTarget !== "string" ||
            defaultTarget.trim().length === 0
        ) {
            throw new TypeError(
                "Router defaultTarget must be a non-empty selector.",
            );
        }

        this._app = app;
        this._baseLayout = baseLayout;
        this._defaultTarget = defaultTarget;
        this._baseUrl = this._normalizeBaseUrl(baseUrl);
        this._indexRoute = this._joinBaseUrl(
            indexRoute,
        );
        this._routes = this._discoverRoutes();
        this._routesMap = this._parseRoutes(this._routes);

        this.app.addEventListener(
            "click",
            this._clickHandler,
        );

        window.addEventListener(
            "popstate",
            this._popStateHandler,
        );
    }

    isAuthenticated = async (): Promise<boolean> => {
        throw new NotImplementedError(
            "Router.isAuthenticated",
        );
    };

    checkUserRoles = async (
        _roles: unknown[],
    ): Promise<boolean> => {
        throw new NotImplementedError(
            "Router.checkUserRoles",
        );
    };

    protected _discoverRoutes(): Route<TApp>[] {
        const routes: Route<TApp>[] = [];

        for (const elementClass of this.app.elements) {
            if (!isCustomElementClass<TApp>(elementClass)) {
                throw new TypeError(
                    "Application elements must contain CustomElement classes.",
                );
            }

            const metadata =
                getElementMetadata<TApp>(elementClass);

            if (!metadata || metadata.kind !== "page") {
                continue;
            }

            routes.push(
                this._createRouteFromMetadata(
                    elementClass,
                    metadata,
                ),
            );
        }

        if (routes.length === 0) {
            throw new Error(
                "The application does not contain any @page components.",
            );
        }

        return routes;
    }

    protected _createRouteFromMetadata(
        handler: CustomElementClass<TApp>,
        metadata: PageMetadata<TApp>,
    ): Route<TApp> {
        const layout =
            metadata.layout ??
            this._baseLayout;

        if (!isCustomElementClass<TApp>(layout)) {
            throw new TypeError(
                `Invalid layout configured for page '${handler.name}'.`,
            );
        }

        const layoutMetadata =
            requireElementMetadata(layout);

        if (layoutMetadata.kind !== "layout") {
            throw new TypeError(
                `Page layout '${layout.name}' must use @layout.`,
            );
        }

        if (!this.app.elements.includes(layout)) {
            throw new Error(
                `Page layout '${layout.name}' is not registered ` +
                `in app.elements.`,
            );
        }

        return {
            path: this._joinBaseUrl(metadata.path),
            handler,
            target:
                metadata.target ??
                this._defaultTarget,
            layout,
            title: metadata.title,
            extras: metadata.extras,
            authentication:
                metadata.authentication,
            roles: metadata.roles,
        };
    }

    protected _parseRoutes(
        routes: readonly Route<TApp>[],
    ): Map<string, ParsedRoute<TApp>> {
        const routeMap = new Map<
            string,
            ParsedRoute<TApp>
        >();

        for (const route of routes) {
            if (routeMap.has(route.path)) {
                throw new Error(
                    `Duplicate route path '${route.path}'.`,
                );
            }

            routeMap.set(
                route.path,
                {
                    handler: route.handler,
                    target: route.target,
                    layout: route.layout,
                    title: route.title,
                    extras: route.extras,
                    authentication:
                        route.authentication,
                    args: null,
                    roles: route.roles,
                    route: route.path,
                },
            );
        }

        return this._sortRoutes(routeMap);
    }

    protected _normalizePath(path: string): string {
        const normalizedPath = path
            .trim()
            .replace(/\/+/g, "/");

        if (
            normalizedPath === "" ||
            normalizedPath === "/"
        ) {
            return "/";
        }

        const pathWithLeadingSlash =
            normalizedPath.startsWith("/")
                ? normalizedPath
                : `/${normalizedPath}`;

        return pathWithLeadingSlash.replace(
            /\/+$/,
            "",
        );
    }

    protected _normalizeBaseUrl(
        baseUrl: string,
    ): string {
        if (!baseUrl || baseUrl === "/") {
            return "";
        }

        const normalizedBaseUrl =
            this._normalizePath(baseUrl);

        for (
            const match of normalizedBaseUrl.matchAll(
                /<([^:>]+):([A-Za-z_]\w*)>/g,
            )
        ) {
            const type = match[1];

            if (type !== "str" && type !== "int") {
                throw new UnsupportedRouteParameterType(
                    type ?? "",
                );
            }
        }

        const unmatchedSyntax = normalizedBaseUrl
            .replace(
                /<(str|int):([A-Za-z_]\w*)>/g,
                "",
            );

        if (
            unmatchedSyntax.includes("<") ||
            unmatchedSyntax.includes(">")
        ) {
            throw new RouteParametersError(
                normalizedBaseUrl,
                {
                    cause: new SyntaxError(
                        "Invalid base URL parameter syntax.",
                    ),
                },
            );
        }

        return normalizedBaseUrl;
    }

    protected _joinBaseUrl(path: string): string {
        const normalizedPath =
            this._normalizePath(path);

        if (!this._baseUrl) {
            return normalizedPath;
        }

        if (normalizedPath === "/") {
            return this._baseUrl;
        }

        return this._normalizePath(
            `${this._baseUrl}/${normalizedPath}`,
        );
    }

    protected _sortRoutes(
        routeMap: Map<string, ParsedRoute<TApp>>,
    ): Map<string, ParsedRoute<TApp>> {
        const sortedRoutes = Array.from(
            routeMap.entries(),
        ).sort(([firstPath], [secondPath]) => {
            const lengthDifference =
                secondPath.length - firstPath.length;

            if (lengthDifference !== 0) {
                return lengthDifference;
            }

            if (
                firstPath.includes("<str:") &&
                secondPath.includes("<int:")
            ) {
                return -1;
            }

            if (
                firstPath.includes("<int:") &&
                secondPath.includes("<str:")
            ) {
                return 1;
            }

            return 0;
        });

        return new Map(sortedRoutes);
    }

    protected _popStateHandler = async (
        event: PopStateEvent,
    ): Promise<void> => {
        await this.route();

        const state = event.state as
            | CurrentState
            | null;

        if (state?.scrollPosition) {
            window.scrollTo(
                state.scrollPosition.x,
                state.scrollPosition.y,
            );
        }
    };

    protected _clickHandler = async (
        event: MouseEvent,
    ): Promise<void> => {
        if (
            event.defaultPrevented ||
            event.button !== 0 ||
            event.ctrlKey ||
            event.metaKey ||
            event.shiftKey ||
            event.altKey
        ) {
            return;
        }

        if (!(event.target instanceof Element)) {
            return;
        }

        const anchor =
            event.target.closest<HTMLAnchorElement>(
                "a",
            );

        if (
            !anchor ||
            anchor.hasAttribute("router-ignore") ||
            anchor.hasAttribute("download") ||
            anchor.target === "_blank" ||
            !anchor.href ||
            anchor.protocol === "mailto:" ||
            anchor.protocol === "tel:" ||
            anchor.origin !== location.origin
        ) {
            return;
        }

        event.preventDefault();

        if (this._inTransition) {
            return;
        }

        this._inTransition = true;

        try {
            await this.redirect(anchor.href);
        } catch (error: unknown) {
            await this._app.handleError(
                new RouteFailedError({
                    cause: error,
                }),
            );
        } finally {
            this._inTransition = false;
        }
    };

    route = async (): Promise<void> => {
        try {
            let path = location.pathname;

            if (!path) {
                path = this.indexRoute;
            }

            const matchedPath =
                this._matchRoute(path);

            if (
                matchedPath.authentication
                    ?.authenticationRequired
            ) {
                const authenticated =
                    await this.isAuthenticated();

                if (!authenticated) {
                    throw new AuthenticationError(
                        matchedPath.path,
                    );
                }

                const requiredRoles =
                    matchedPath.authentication
                        .rolesRequired;

                if (requiredRoles.length > 0) {
                    const authorized =
                        await this.checkUserRoles(
                            requiredRoles,
                        );

                    if (!authorized) {
                        throw new AuthorizationError(
                            matchedPath.path,
                            requiredRoles,
                        );
                    }
                }
            }

            await this._loadPath(matchedPath);
        } catch (error: unknown) {
            await this.app.handleError(error);
        }
    };

    protected _loadPath = async (
        matchedPath: MatchedRoute<TApp>,
    ): Promise<void> => {
        this._emitRouteEvent(routeEventsEnum.START);

        await this._renderLayout(
            matchedPath.layout,
        );

        const layout = this.app.querySelector(
            matchedPath.layout.tagName,
        ) as CustomElement<TApp> | null;

        if (!layout) {
            throw new Error(
                `Failed to render layout '${matchedPath.layout.tagName}'.`,
            );
        }

        await layout.initComplete;

        const targetContainer =
            this.app.querySelector(
                matchedPath.target,
            );

        if (!targetContainer) {
            throw new Error(
                `Failed to find route target '${matchedPath.target}'.`,
            );
        }

        const hashId = this.app.generateHash();

        this.app.originalInnerHTML.call(
            targetContainer,
            matchedPath.handler.generate(
                hashId,
                matchedPath.args,
            ),
        );

        const generatedHandler =
            this.app.querySelector(
                `[data-hash-id="${hashId}"]`,
            ) as CustomElement<TApp> | null;

        if (generatedHandler) {
            await generatedHandler.initComplete;
        }

        this._setTitle(matchedPath.title);
        this.currentRoute = matchedPath;
        this._emitRouteEvent(
            routeEventsEnum.FINISHED,
        );
    };

    protected _renderLayout = async (
        layout: CustomElementClass<TApp>,
    ): Promise<void> => {
        if (this.app.querySelector(layout.tagName)) {
            return;
        }

        this.app.originalInnerHTML.call(
            this.app.container,
            layout.generate(),
        );

        const layoutElement =
            this.app.querySelector(
                layout.tagName,
            ) as CustomElement<TApp> | null;

        if (!layoutElement) {
            throw new Error(
                `Failed to generate layout '${layout.tagName}'.`,
            );
        }

        await layoutElement.initComplete;
        this._emitRouteEvent(
            routeEventsEnum.LAYOUT_CHANGE_FINISHED,
        );
    };

    protected _setTitle(
        title: string | null,
    ): void {
        let titleElement =
            document.head.querySelector("title");

        if (!titleElement) {
            titleElement =
                document.createElement("title");
            document.head.prepend(titleElement);
        }

        titleElement.innerText =
            title ?? this.app.appName;
    }

    protected _emitRouteEvent(
        eventType: string,
    ): void {
        this.app.container.dispatchEvent(
            new CustomEvent(eventType, {
                bubbles: true,
                cancelable: true,
            }),
        );
    }

    protected _matchRoute(
        path: string,
    ): MatchedRoute<TApp> {
        const normalizedPath =
            this._normalizePath(path);

        for (
            const [routePattern, config]
            of this._routesMap
        ) {
            const parameterNames: string[] = [];
            const parameterTypes:
                RouteParameterType[] = [];

            const escapedPattern =
                routePattern.replace(
                    /[.*+?^${}()|[\]\\]/g,
                    "\\$&",
                );

            const regexPath =
                escapedPattern.replace(
                    /<(str|int):([A-Za-z_]\w*)>/g,
                    (
                        _placeholder: string,
                        type: RouteParameterType,
                        parameterName: string,
                    ): string => {
                        parameterNames.push(
                            parameterName,
                        );
                        parameterTypes.push(type);

                        if (type === "str") {
                            return "([^/]+)";
                        }

                        if (type === "int") {
                            return "(\\d+)";
                        }

                        throw new UnsupportedRouteParameterType(
                            type,
                        );
                    },
                );

            const match = normalizedPath.match(
                new RegExp(`^${regexPath}$`),
            );

            if (!match) {
                continue;
            }

            const parameters: RouteParameters = {};

            for (
                let index = 0;
                index < parameterNames.length;
                index += 1
            ) {
                const parameterName =
                    parameterNames[index];
                const parameterType =
                    parameterTypes[index];
                const capturedValue =
                    match[index + 1];

                if (
                    parameterName === undefined ||
                    parameterType === undefined ||
                    capturedValue === undefined
                ) {
                    throw new RouteParametersError(
                        routePattern,
                    );
                }

                parameters[parameterName] =
                    parameterType === "int"
                        ? Number.parseInt(
                            capturedValue,
                            10,
                        )
                        : decodeURIComponent(
                            capturedValue,
                        );
            }

            this._routeParameters = parameters;

            return {
                ...config,
                path: normalizedPath,
                pattern: routePattern,
                parameters,
            };
        }

        this._routeParameters = {};
        throw new RouteNotFoundError(
            normalizedPath,
        );
    }

    async redirect(
        path: string,
        options: RedirectOptions = {},
    ): Promise<void> {
        if (
            typeof path !== "string" ||
            path.trim().length === 0
        ) {
            throw new TypeError(
                "Redirect path must be a non-empty string.",
            );
        }

        const destination = options.useBaseUrl
            ? this._createBaseUrlDestination(
                path,
                options.baseParameters ?? {},
            )
            : path;

        await this._handleLinkPress(destination);
    }

    protected _createBaseUrlDestination(
        path: string,
        baseParameters: RouteParameters,
    ): string {
        if (!this.baseUrl) {
            return path;
        }

        const parameters = {
            ...this.routeParameters,
            ...baseParameters,
        };
        const expandedBaseUrl =
            this.baseUrl.replace(
                /<(str|int):([A-Za-z_]\w*)>/g,
                (
                    _placeholder: string,
                    type: RouteParameterType,
                    parameterName: string,
                ): string => {
                    const value =
                        parameters[parameterName];

                    if (value === undefined) {
                        throw new RouteParametersError(
                            this.baseUrl,
                            {
                                cause: new Error(
                                    `Missing base URL parameter '${parameterName}'.`,
                                ),
                            },
                        );
                    }

                    if (
                        type === "int" &&
                        !Number.isInteger(Number(value))
                    ) {
                        throw new RouteParametersError(
                            this.baseUrl,
                            {
                                cause: new TypeError(
                                    `Base URL parameter '${parameterName}' must be an integer.`,
                                ),
                            },
                        );
                    }

                    const stringValue = String(value);

                    if (stringValue.length === 0) {
                        throw new RouteParametersError(
                            this.baseUrl,
                            {
                                cause: new TypeError(
                                    `Base URL parameter '${parameterName}' cannot be empty.`,
                                ),
                            },
                        );
                    }

                    return encodeURIComponent(
                        stringValue,
                    );
                },
            );
        const destination = new URL(
            path,
            location.origin,
        );
        const destinationPath =
            this._normalizePath(
                destination.pathname,
            );
        const pathname = destinationPath === "/"
            ? expandedBaseUrl
            : this._normalizePath(
                `${expandedBaseUrl}/${destinationPath}`,
            );

        return (
            `${pathname}` +
            `${destination.search}` +
            `${destination.hash}`
        );
    }

    protected _handleLinkPress = async (
        href: string,
    ): Promise<void> => {
        const destination = new URL(
            href,
            location.href,
        );

        history.pushState(
            this._getCurrentState(),
            "",
            `${destination.pathname}${destination.search}${destination.hash}`,
        );

        await this.route();
    };

    protected _getCurrentState(): CurrentState {
        return {
            scrollPosition: {
                x: window.scrollX,
                y: window.scrollY,
            },
        };
    }

    urlIsCurrentPath(href: string): boolean {
        const url = new URL(href, location.href);
        const path =
            this._normalizePath(url.pathname);

        return path === this.currentRoute?.path;
    }

    get routeParameters(): RouteParameters {
        return this._routeParameters;
    }

    set routeParameters(
        params: RouteParameters,
    ) {
        this._routeParameters = params;
    }

    get queryParameters(): Record<
        string,
        string | number
    > {
        return this.app.queryParameters;
    }

    get app(): TApp {
        return this._app;
    }

    get baseLayout(): CustomElementClass<TApp> {
        return this._baseLayout;
    }

    get defaultTarget(): string {
        return this._defaultTarget;
    }

    get indexRoute(): string {
        return this._indexRoute;
    }

    get baseUrl(): string {
        return this._baseUrl;
    }

    get routes(): Route<TApp>[] {
        return this._routes;
    }

    get routesMap(): ReadonlyMap<
        string,
        ParsedRoute<TApp>
    > {
        return this._routesMap;
    }

    get currentRoute(): MatchedRoute<TApp> | null {
        return this._currentRoute;
    }

    set currentRoute(
        route: MatchedRoute<TApp> | null,
    ) {
        this._currentRoute = route;
    }

    get origin(): string {
        return location.origin;
    }

    get hash(): string {
        return this.app.hash;
    }

    get port(): string {
        return this.app.port;
    }

    get hostname(): string {
        return this.app.hostname;
    }

    get host(): string {
        return location.host;
    }

    get pathname(): string {
        return location.pathname;
    }
}

export default Router;
