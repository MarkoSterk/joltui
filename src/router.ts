import App from "./app.js";
import {
    CustomElement,
    type CustomElementClass,
} from "./customElement.js";
import {
    requireElementMetadata,
    type AuthenticationMetadata,
    type LayoutMetadata,
    type PageMetadata,
    type SubLayoutConfig,
} from "./elementMetadata.js";
import { NotImplementedError } from "./utilities.js";
import { AuthenticationError, AuthorizationError } from "./auth.js";
import { getGeneratedPages } from "./generatedPages.js";

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
    rolesRequired: readonly unknown[];
};

export type RouteAuthenticationRequirement<
    TApp extends App = App,
> = Readonly<{
    element: CustomElementClass<TApp>;
    authentication: AuthenticationMetadata;
}>;

export type MaybePromise<T> = T | Promise<T>;

export type HandlerArgs = Record<string, unknown>;

export type RouteExtras = Record<string, unknown>;

export type Route<
    TApp extends App = App,
> = {
    path: string;
    handler: CustomElementClass<TApp>;
    target: string;
    layout: CustomElementClass<TApp>;
    subLayouts:
        readonly SubLayoutConfig<TApp>[];
    title: string | null;
    extras: RouteExtras;
    authentication: Authentication | null;
    authenticationChain:
        readonly RouteAuthenticationRequirement<TApp>[];
    roles: unknown[] | null;
};

export type ParsedRoute<
    TApp extends App = App,
> = {
    handler: CustomElementClass<TApp>;
    target: string;
    layout: CustomElementClass<TApp>;
    subLayouts:
        readonly SubLayoutConfig<TApp>[];
    title: string | null;
    extras: RouteExtras;
    authentication: Authentication | null;
    authenticationChain:
        readonly RouteAuthenticationRequirement<TApp>[];
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
    pages?: readonly CustomElementClass<TApp>[] | null;
};

export type RedirectOptions = {
    useBaseUrl?: boolean;
    baseParameters?: RouteParameters;
};

type RouteParameterType = "str" | "int";

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

type ActiveSubLayout<
    TApp extends App = App,
> = {
    target: string;
    layout: CustomElementClass<TApp>;
    container: Element;
    element: CustomElement<TApp>;
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
    readonly pages:
        readonly CustomElementClass<TApp>[];

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
    protected _activeSubLayouts:
        ActiveSubLayout<TApp>[] = [];

    constructor({
        baseUrl = "",
        baseLayout,
        defaultTarget,
        indexRoute = "/",
        app,
        pages,
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

        const resolvedPages = pages ?? getGeneratedPages<TApp>();

        if (!resolvedPages) {
            throw new Error(
                "Router pages were not provided and no generated page " +
                "registry was found. Configure pages manually or install " +
                "the JoltUI Vite plugin.",
            );
        }

        if (!Array.isArray(resolvedPages)) {
            throw new TypeError("Router pages must be an array.");
        }

        if (resolvedPages.length === 0) {
            throw new Error(
                "No JoltUI pages were provided or discovered.",
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
        this.pages = Object.freeze([
            ...resolvedPages,
        ]);
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

    isAuthenticated(): MaybePromise<boolean> {
        throw new NotImplementedError(
            "Router.isAuthenticated",
        );
    }

    checkUserRoles(
        _roles: unknown[],
    ): MaybePromise<boolean> {
        throw new NotImplementedError(
            "Router.checkUserRoles",
        );
    }

    titleGenerator(tagName: string, title: string|null): MaybePromise<string>{
        return null as unknown as MaybePromise<string>;
    }

    protected _discoverRoutes(): Route<TApp>[] {
        const routes: Route<TApp>[] = [];

        for (const pageClass of this.pages) {
            if (!isCustomElementClass<TApp>(pageClass)) {
                throw new TypeError(
                    "Router pages must contain CustomElement classes.",
                );
            }

            const metadata =
                requireElementMetadata<TApp>(
                    pageClass,
                );

            if (metadata.kind !== "page") {
                throw new TypeError(
                    `Router page '${pageClass.name}' ` +
                    "must use @page.",
                );
            }

            routes.push(
                this._createRouteFromMetadata(
                    pageClass,
                    metadata,
                ),
            );
        }

        if (routes.length === 0) {
            throw new Error("Router does not contain any pages.");
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

        if (
            customElements.get(
                layoutMetadata.tagName,
            ) !== layout
        ) {
            throw new Error(
                `Page layout '${layout.name}' is not ` +
                "registered with its decorated constructor.",
            );
        }

        for (
            const [index, subLayout]
            of metadata.subLayouts.entries()
        ) {
            if (!isCustomElementClass<TApp>(subLayout.layout)) {
                throw new TypeError(
                    `Invalid sublayout at index ${index} ` +
                    `configured for page '${handler.name}'.`,
                );
            }

            const subLayoutMetadata =
                requireElementMetadata(
                    subLayout.layout,
                );

            if (subLayoutMetadata.kind !== "layout") {
                throw new TypeError(
                    `Page sublayout '${subLayout.layout.name}' ` +
                    "must use @layout.",
                );
            }

            if (
                customElements.get(
                    subLayoutMetadata.tagName,
                ) !== subLayout.layout
            ) {
                throw new Error(
                    `Page sublayout '${subLayout.layout.name}' ` +
                    "is not registered with its decorated constructor.",
                );
            }
        }

        const authenticationChain =
            this._createAuthenticationChain(
                handler,
                metadata,
                layout,
                layoutMetadata,
            );

        return {
            path: this._joinBaseUrl(metadata.path),
            handler,
            target:
                metadata.target ??
                this._defaultTarget,
            layout,
            subLayouts: metadata.subLayouts,
            title: metadata.title,
            extras: metadata.extras,
            authentication:
                metadata.authentication,
            authenticationChain,
            roles: metadata.roles,
        };
    }

    protected _createAuthenticationChain(
        handler: CustomElementClass<TApp>,
        pageMetadata: PageMetadata<TApp>,
        layout: CustomElementClass<TApp>,
        layoutMetadata: LayoutMetadata,
    ): readonly RouteAuthenticationRequirement<TApp>[] {
        const requirements:
            RouteAuthenticationRequirement<TApp>[] = [];

        const addRequirement = (
            element: CustomElementClass<TApp>,
            authentication: AuthenticationMetadata | null,
        ): void => {
            if (!authentication) {
                return;
            }

            requirements.push(Object.freeze({
                element,
                authentication,
            }));
        };

        addRequirement(
            layout,
            layoutMetadata.authentication,
        );

        for (const subLayout of pageMetadata.subLayouts) {
            const metadata = requireElementMetadata(
                subLayout.layout,
            );

            if (metadata.kind !== "layout") {
                throw new TypeError(
                    `Page sublayout '${subLayout.layout.name}' ` +
                    "must use @layout.",
                );
            }

            addRequirement(
                subLayout.layout,
                metadata.authentication,
            );
        }

        addRequirement(
            handler,
            pageMetadata.authentication,
        );

        return Object.freeze(requirements);
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
                    subLayouts:
                        route.subLayouts,
                    title: route.title,
                    extras: route.extras,
                    authentication:
                        route.authentication,
                    authenticationChain:
                        route.authenticationChain,
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
        )
            .map((entry, index) => ({
                entry,
                index,
                specificity:
                    this._getRouteSpecificity(
                        entry[0],
                    ),
            }))
            .sort((first, second) => {
                const literalDifference =
                    second.specificity.literalCount -
                    first.specificity.literalCount;

                if (literalDifference !== 0) {
                    return literalDifference;
                }

                const parameterDifference =
                    first.specificity.parameterCount -
                    second.specificity.parameterCount;

                if (parameterDifference !== 0) {
                    return parameterDifference;
                }

                const integerParameterDifference =
                    second.specificity
                        .integerParameterCount -
                    first.specificity
                        .integerParameterCount;

                if (integerParameterDifference !== 0) {
                    return integerParameterDifference;
                }

                const sharedSegmentCount = Math.min(
                    first.specificity.segments.length,
                    second.specificity.segments.length,
                );

                for (
                    let index = 0;
                    index < sharedSegmentCount;
                    index += 1
                ) {
                    const segmentDifference =
                        (second.specificity
                            .segments[index] ?? 0) -
                        (first.specificity
                            .segments[index] ?? 0);

                    if (segmentDifference !== 0) {
                        return segmentDifference;
                    }
                }

                const segmentCountDifference =
                    second.specificity.segments.length -
                    first.specificity.segments.length;

                if (segmentCountDifference !== 0) {
                    return segmentCountDifference;
                }

                return first.index - second.index;
            })
            .map(({ entry }) => entry);

        return new Map(sortedRoutes);
    }

    protected _getRouteSpecificity(
        path: string,
    ): RouteSpecificity {
        const routeParameterPattern =
            /^<(str|int):([A-Za-z_]\w*)>$/;
        const segments = this._normalizePath(path)
            .split("/")
            .filter(Boolean);
        let literalCount = 0;
        let parameterCount = 0;
        let integerParameterCount = 0;

        const segmentSpecificity =
            segments.map(segment => {
                const parameterMatch =
                    routeParameterPattern.exec(
                        segment,
                    );

                if (!parameterMatch) {
                    literalCount += 1;
                    return 3;
                }

                parameterCount += 1;

                if (parameterMatch[1] === "int") {
                    integerParameterCount += 1;
                    return 2;
                }

                return 1;
            });

        return {
            segments: segmentSpecificity,
            literalCount,
            parameterCount,
            integerParameterCount,
        };
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
            await this._app.handleErrorOnce(
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

            await this._authorizeRoute(matchedPath);

            await this._loadPath(matchedPath);
        } catch (error: unknown) {
            await this.app.handleErrorOnce(error);
        }
    };

    protected _authorizeRoute = async (
        matchedPath: MatchedRoute<TApp>,
    ): Promise<void> => {
        const requirements =
            matchedPath.authenticationChain.filter(
                requirement =>
                    requirement.authentication
                        .authenticationRequired,
            );

        if (requirements.length === 0) {
            return;
        }

        if (!(await this.isAuthenticated())) {
            throw new AuthenticationError(
                matchedPath.path,
            );
        }

        for (const requirement of requirements) {
            const requiredRoles =
                requirement.authentication
                    .rolesRequired;

            if (requiredRoles.length === 0) {
                continue;
            }

            const authorized =
                await this.checkUserRoles([
                    ...requiredRoles,
                ]);

            if (!authorized) {
                throw new AuthorizationError(
                    matchedPath.path,
                    [...requiredRoles],
                );
            }
        }
    };

    protected _loadPath = async (
        matchedPath: MatchedRoute<TApp>,
    ): Promise<void> => {
        this._emitRouteEvent(routeEventsEnum.START);

        await this._renderLayout(
            matchedPath.layout,
        );

        const layout = Array.from(
            this.app.container.children,
        ).find(
            element =>
                element instanceof
                matchedPath.layout,
        ) as CustomElement<TApp> | undefined;

        if (!layout) {
            throw new Error(
                `Failed to render layout '${matchedPath.layout.tagName}'.`,
            );
        }

        await layout.initComplete;

        const pageRoot =
            await this._renderSubLayouts(
                layout,
                matchedPath.subLayouts,
            );

        const targetContainer =
            this._findLayoutTarget(
                pageRoot,
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

        await this._setTitle(matchedPath.handler.tagName.toLowerCase(), matchedPath.title);
        this.currentRoute = matchedPath;
        this._emitRouteEvent(
            routeEventsEnum.FINISHED,
        );
    };

    protected async _renderSubLayouts(
        baseLayout: CustomElement<TApp>,
        subLayouts:
            readonly SubLayoutConfig<TApp>[],
    ): Promise<CustomElement<TApp>> {
        let renderRoot = baseLayout;

        for (
            const [index, subLayout]
            of subLayouts.entries()
        ) {
            const targetContainer =
                this._findLayoutTarget(
                    renderRoot,
                    subLayout.target,
                );

            if (!targetContainer) {
                throw new Error(
                    `Failed to find sublayout target ` +
                    `'${subLayout.target}' for ` +
                    `'${subLayout.layout.tagName}'.`,
                );
            }

            const activeSubLayout =
                this._activeSubLayouts[index];
            const canReuse =
                activeSubLayout !== undefined &&
                activeSubLayout.target ===
                    subLayout.target &&
                activeSubLayout.layout ===
                    subLayout.layout &&
                activeSubLayout.container ===
                    targetContainer &&
                activeSubLayout.element.isConnected &&
                activeSubLayout.element.parentElement ===
                    targetContainer;

            if (canReuse) {
                await activeSubLayout.element
                    .initComplete;
                renderRoot =
                    activeSubLayout.element;
                continue;
            }

            this._clearSubLayoutsFrom(index);

            const hashId = this.app.generateHash();

            this.app.originalInnerHTML.call(
                targetContainer,
                subLayout.layout.generate(hashId),
            );

            const subLayoutElement =
                targetContainer.querySelector(
                    `[data-hash-id="${hashId}"]`,
                ) as CustomElement<TApp> | null;

            if (!subLayoutElement) {
                throw new Error(
                    `Failed to render sublayout ` +
                    `'${subLayout.layout.tagName}' in ` +
                    `'${subLayout.target}'.`,
                );
            }

            subLayoutElement.setAttribute(
                "data-jolt-router-layout",
                "",
            );
            subLayoutElement.setAttribute(
                "data-jolt-layout-depth",
                String(index),
            );

            await subLayoutElement.initComplete;

            this._activeSubLayouts.push({
                target: subLayout.target,
                layout: subLayout.layout,
                container: targetContainer,
                element: subLayoutElement,
            });
            renderRoot = subLayoutElement;
        }

        if (
            this._activeSubLayouts.length >
            subLayouts.length
        ) {
            this._clearSubLayoutsFrom(
                subLayouts.length,
            );
        }

        return renderRoot;
    }

    protected _clearSubLayoutsFrom(
        index: number,
    ): void {
        const firstRemovedLayout =
            this._activeSubLayouts[index];

        if (firstRemovedLayout) {
            this.app.originalInnerHTML.call(
                firstRemovedLayout.container,
                "",
            );
        }

        this._activeSubLayouts.splice(index);
    }

    protected _findLayoutTarget(
        root: CustomElement<TApp>,
        selector: string,
    ): Element | null {
        if (root.matches(selector)) {
            return root;
        }

        return root.querySelector(selector);
    }

    protected _renderLayout = async (
        layout: CustomElementClass<TApp>,
    ): Promise<void> => {
        const existingLayout = Array.from(
            this.app.container.children,
        ).find(
            element =>
                element instanceof layout,
        ) as CustomElement<TApp> | undefined;

        if (existingLayout) {
            await existingLayout.initComplete;
            return;
        }

        this.app.originalInnerHTML.call(
            this.app.container,
            layout.generate(),
        );
        this._activeSubLayouts = [];

        const layoutElement = Array.from(
            this.app.container.children,
        ).find(
            element =>
                element instanceof layout,
        ) as CustomElement<TApp> | undefined;

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

    protected async _setTitle(
        tagName: string,
        title: string | null,
    ): Promise<void> {
        
        const titleCandidate: string|null = await this.titleGenerator(tagName, title) || title;
        if(titleCandidate){
            this.setTitle(titleCandidate);
        }
    }

    async setTitle(title: string){
        let titleElement =
            document.head.querySelector("title");

        if (!titleElement) {
            titleElement =
                document.createElement("title");
            document.head.prepend(titleElement);
        }
        titleElement.innerText = title == "_default" ? this.app.appName : title;
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
