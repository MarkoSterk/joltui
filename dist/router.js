import App from "./app.js";
import { CustomElement, } from "./customElement.js";
import { requireElementMetadata, } from "./elementMetadata.js";
import { NotImplementedError } from "./utilities.js";
import { AuthenticationError, AuthorizationError } from "./auth.js";
import { getGeneratedPages } from "./generatedPages.js";
import { awaitWithSignal } from "./cancellation.js";
export const routeEventsEnum = {
    START: "route-change.start",
    FINISHED: "route-change.finished",
    LAYOUT_CHANGE_FINISHED: "route-change.layout-change.finished",
};
export class RouteFailedError extends Error {
    constructor(options) {
        super("Routing failed", options);
        this.name = "RouteFailedError";
    }
}
export class RouteNotFoundError extends Error {
    route;
    constructor(route, options) {
        super(`Route '${route}' not found`, options);
        this.route = route;
        this.name = "RouteNotFoundError";
    }
}
export class RouteParametersError extends Error {
    path;
    constructor(path, options) {
        super(`Failed to parse route parameters for path '${path}'`, options);
        this.path = path;
        this.name = "RouteParametersError";
    }
}
export class UnsupportedRouteParameterType extends Error {
    type;
    constructor(type, options) {
        super(`Route parameter type '${type}' is not supported`, options);
        this.type = type;
        this.name = "UnsupportedRouteParameterType";
    }
}
function isCustomElementClass(value) {
    return (typeof value === "function" &&
        value.prototype instanceof CustomElement);
}
class Router {
    pages;
    _app;
    _baseLayout;
    _defaultTarget;
    _indexRoute;
    _baseUrl;
    _routes;
    _routesMap;
    _currentRoute = null;
    _routeParameters = {};
    _navigation = null;
    _errorNavigations = new WeakMap();
    _activeSubLayouts = [];
    constructor({ baseUrl = "", baseLayout, defaultTarget, indexRoute = "/", app, pages, }) {
        if (!app) {
            throw new Error("Missing application object in router constructor");
        }
        if (!isCustomElementClass(baseLayout)) {
            throw new TypeError("Invalid base layout element class");
        }
        const resolvedPages = pages ?? getGeneratedPages();
        if (!resolvedPages) {
            throw new Error("Router pages were not provided and no generated page " +
                "registry was found. Configure pages manually or install " +
                "the JoltUI Vite plugin.");
        }
        if (!Array.isArray(resolvedPages)) {
            throw new TypeError("Router pages must be an array.");
        }
        if (resolvedPages.length === 0) {
            throw new Error("No JoltUI pages were provided or discovered.");
        }
        const layoutMetadata = requireElementMetadata(baseLayout);
        if (layoutMetadata.kind !== "layout") {
            throw new TypeError(`Base layout '${baseLayout.name}' must use @layout.`);
        }
        if (typeof defaultTarget !== "string" ||
            defaultTarget.trim().length === 0) {
            throw new TypeError("Router defaultTarget must be a non-empty selector.");
        }
        this._app = app;
        this._baseLayout = baseLayout;
        this.pages = Object.freeze([
            ...resolvedPages,
        ]);
        this._defaultTarget = defaultTarget;
        this._baseUrl = this._normalizeBaseUrl(baseUrl);
        this._indexRoute = this._joinBaseUrl(indexRoute);
        this._routes = this._discoverRoutes();
        this._routesMap = this._parseRoutes(this._routes);
        this.app.addEventListener("click", this._clickHandler);
        window.addEventListener("popstate", this._popStateHandler);
    }
    isAuthenticated() {
        throw new NotImplementedError("Router.isAuthenticated");
    }
    checkUserRoles(_roles) {
        throw new NotImplementedError("Router.checkUserRoles");
    }
    titleGenerator(_tagName, _title) {
        return null;
    }
    _discoverRoutes() {
        const routes = [];
        for (const pageClass of this.pages) {
            if (!isCustomElementClass(pageClass)) {
                throw new TypeError("Router pages must contain CustomElement classes.");
            }
            const metadata = requireElementMetadata(pageClass);
            if (metadata.kind !== "page") {
                throw new TypeError(`Router page '${pageClass.name}' ` +
                    "must use @page.");
            }
            routes.push(this._createRouteFromMetadata(pageClass, metadata));
        }
        if (routes.length === 0) {
            throw new Error("Router does not contain any pages.");
        }
        return routes;
    }
    _createRouteFromMetadata(handler, metadata) {
        const layout = metadata.layout ??
            this._baseLayout;
        if (!isCustomElementClass(layout)) {
            throw new TypeError(`Invalid layout configured for page '${handler.name}'.`);
        }
        const layoutMetadata = requireElementMetadata(layout);
        if (layoutMetadata.kind !== "layout") {
            throw new TypeError(`Page layout '${layout.name}' must use @layout.`);
        }
        if (customElements.get(layoutMetadata.tagName) !== layout) {
            throw new Error(`Page layout '${layout.name}' is not ` +
                "registered with its decorated constructor.");
        }
        for (const [index, subLayout] of metadata.subLayouts.entries()) {
            if (!isCustomElementClass(subLayout.layout)) {
                throw new TypeError(`Invalid sublayout at index ${index} ` +
                    `configured for page '${handler.name}'.`);
            }
            const subLayoutMetadata = requireElementMetadata(subLayout.layout);
            if (subLayoutMetadata.kind !== "layout") {
                throw new TypeError(`Page sublayout '${subLayout.layout.name}' ` +
                    "must use @layout.");
            }
            if (customElements.get(subLayoutMetadata.tagName) !== subLayout.layout) {
                throw new Error(`Page sublayout '${subLayout.layout.name}' ` +
                    "is not registered with its decorated constructor.");
            }
        }
        const authenticationChain = this._createAuthenticationChain(handler, metadata, layout, layoutMetadata);
        return {
            path: this._joinBaseUrl(metadata.path),
            handler,
            target: metadata.target ??
                this._defaultTarget,
            layout,
            subLayouts: metadata.subLayouts,
            title: metadata.title,
            extras: metadata.extras,
            authentication: metadata.authentication,
            authenticationChain,
        };
    }
    _createAuthenticationChain(handler, pageMetadata, layout, layoutMetadata) {
        const requirements = [];
        const addRequirement = (element, authentication) => {
            if (!authentication) {
                return;
            }
            requirements.push(Object.freeze({
                element,
                authentication,
            }));
        };
        addRequirement(layout, layoutMetadata.authentication);
        for (const subLayout of pageMetadata.subLayouts) {
            const metadata = requireElementMetadata(subLayout.layout);
            if (metadata.kind !== "layout") {
                throw new TypeError(`Page sublayout '${subLayout.layout.name}' ` +
                    "must use @layout.");
            }
            addRequirement(subLayout.layout, metadata.authentication);
        }
        addRequirement(handler, pageMetadata.authentication);
        return Object.freeze(requirements);
    }
    _parseRoutes(routes) {
        const routeMap = new Map();
        for (const route of routes) {
            if (routeMap.has(route.path)) {
                throw new Error(`Duplicate route path '${route.path}'.`);
            }
            routeMap.set(route.path, {
                handler: route.handler,
                target: route.target,
                layout: route.layout,
                subLayouts: route.subLayouts,
                title: route.title,
                extras: route.extras,
                authentication: route.authentication,
                authenticationChain: route.authenticationChain,
                args: null,
                route: route.path,
            });
        }
        return this._sortRoutes(routeMap);
    }
    _normalizePath(path) {
        const normalizedPath = path
            .trim()
            .replace(/\/+/g, "/");
        if (normalizedPath === "" ||
            normalizedPath === "/") {
            return "/";
        }
        const pathWithLeadingSlash = normalizedPath.startsWith("/")
            ? normalizedPath
            : `/${normalizedPath}`;
        return pathWithLeadingSlash.replace(/\/+$/, "");
    }
    _normalizeBaseUrl(baseUrl) {
        if (!baseUrl || baseUrl === "/") {
            return "";
        }
        const normalizedBaseUrl = this._normalizePath(baseUrl);
        for (const match of normalizedBaseUrl.matchAll(/<([^:>]+):([A-Za-z_]\w*)>/g)) {
            const type = match[1];
            if (type !== "str" && type !== "int") {
                throw new UnsupportedRouteParameterType(type ?? "");
            }
        }
        const unmatchedSyntax = normalizedBaseUrl
            .replace(/<(str|int):([A-Za-z_]\w*)>/g, "");
        if (unmatchedSyntax.includes("<") ||
            unmatchedSyntax.includes(">")) {
            throw new RouteParametersError(normalizedBaseUrl, {
                cause: new SyntaxError("Invalid base URL parameter syntax."),
            });
        }
        return normalizedBaseUrl;
    }
    _joinBaseUrl(path) {
        const normalizedPath = this._normalizePath(path);
        if (!this._baseUrl) {
            return normalizedPath;
        }
        if (normalizedPath === "/") {
            return this._baseUrl;
        }
        return this._normalizePath(`${this._baseUrl}/${normalizedPath}`);
    }
    _sortRoutes(routeMap) {
        const sortedRoutes = Array.from(routeMap.entries())
            .map((entry, index) => ({
            entry,
            index,
            specificity: this._getRouteSpecificity(entry[0]),
        }))
            .sort((first, second) => {
            const literalDifference = second.specificity.literalCount -
                first.specificity.literalCount;
            if (literalDifference !== 0) {
                return literalDifference;
            }
            const parameterDifference = first.specificity.parameterCount -
                second.specificity.parameterCount;
            if (parameterDifference !== 0) {
                return parameterDifference;
            }
            const integerParameterDifference = second.specificity
                .integerParameterCount -
                first.specificity
                    .integerParameterCount;
            if (integerParameterDifference !== 0) {
                return integerParameterDifference;
            }
            const sharedSegmentCount = Math.min(first.specificity.segments.length, second.specificity.segments.length);
            for (let index = 0; index < sharedSegmentCount; index += 1) {
                const segmentDifference = (second.specificity
                    .segments[index] ?? 0) -
                    (first.specificity
                        .segments[index] ?? 0);
                if (segmentDifference !== 0) {
                    return segmentDifference;
                }
            }
            const segmentCountDifference = second.specificity.segments.length -
                first.specificity.segments.length;
            if (segmentCountDifference !== 0) {
                return segmentCountDifference;
            }
            return first.index - second.index;
        })
            .map(({ entry }) => entry);
        return new Map(sortedRoutes);
    }
    _getRouteSpecificity(path) {
        const routeParameterPattern = /^<(str|int):([A-Za-z_]\w*)>$/;
        const segments = this._normalizePath(path)
            .split("/")
            .filter(Boolean);
        let literalCount = 0;
        let parameterCount = 0;
        let integerParameterCount = 0;
        const segmentSpecificity = segments.map(segment => {
            const parameterMatch = routeParameterPattern.exec(segment);
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
    _popStateHandler = async (event) => {
        const routing = this.route();
        const navigation = this._navigation;
        await routing;
        if (navigation !== this._navigation)
            return;
        const state = event.state;
        if (state?.scrollPosition) {
            window.scrollTo(state.scrollPosition.x, state.scrollPosition.y);
        }
    };
    _clickHandler = async (event) => {
        if (event.defaultPrevented ||
            event.button !== 0 ||
            event.ctrlKey ||
            event.metaKey ||
            event.shiftKey ||
            event.altKey) {
            return;
        }
        if (!(event.target instanceof Element)) {
            return;
        }
        const anchor = event.target.closest("a");
        if (!anchor ||
            anchor.hasAttribute("router-ignore") ||
            anchor.hasAttribute("download") ||
            anchor.target === "_blank" ||
            !anchor.href ||
            anchor.protocol === "mailto:" ||
            anchor.protocol === "tel:" ||
            anchor.origin !== location.origin) {
            return;
        }
        event.preventDefault();
        try {
            await this.redirect(anchor.href);
        }
        catch (error) {
            await this._app.handleErrorOnce(new RouteFailedError({
                cause: error,
            }));
        }
    };
    _beginNavigation() {
        const previous = this._navigation;
        const navigation = {
            controller: new AbortController(),
            elements: new Set(),
        };
        this._navigation = navigation;
        previous?.controller.abort();
        for (const element of previous?.elements ?? []) {
            element.remove();
        }
        return navigation;
    }
    showErrorPage = async (handler, options = {}) => {
        const origin = options.error ? this._errorNavigations.get(options.error) : undefined;
        if (origin?.controller.signal.aborted)
            return;
        if (this._navigation?.renderingErrorPage) {
            throw new Error("Cannot render an error page while another error page is initializing.", {
                cause: options.error,
            });
        }
        const layout = options.layout ?? this._baseLayout;
        for (const element of [handler, layout]) {
            if (!isCustomElementClass(element)) {
                throw new TypeError("Error pages require CustomElement classes.");
            }
            const metadata = requireElementMetadata(element);
            if (customElements.get(metadata.tagName) !== element) {
                throw new Error(`Element '${metadata.tagName}' is not registered.`);
            }
        }
        if (requireElementMetadata(layout).kind !== "layout") {
            throw new TypeError("Error page layouts must use @layout.");
        }
        const navigation = this._beginNavigation();
        navigation.renderingErrorPage = true;
        this._currentRoute = null;
        this._routeParameters = {};
        try {
            await awaitWithSignal(this._loadPath({
                handler,
                layout,
                target: options.target ?? this._defaultTarget,
                subLayouts: [],
                title: options.title ?? null,
                args: options.args ?? null,
            }, navigation, null), navigation.controller.signal);
        }
        catch (error) {
            if (!navigation.controller.signal.aborted)
                throw error;
        }
        finally {
            navigation.renderingErrorPage = false;
            navigation.elements.clear();
        }
    };
    route = async () => {
        const navigation = this._beginNavigation();
        try {
            navigation.controller.signal.throwIfAborted();
            let path = location.pathname;
            if (!path) {
                path = this.indexRoute;
            }
            const matchedPath = this._matchRoute(path);
            await awaitWithSignal(this._authorizeRoute(matchedPath, navigation), navigation.controller.signal);
            navigation.controller.signal.throwIfAborted();
            this._routeParameters = matchedPath.parameters;
            await awaitWithSignal(this._loadPath(matchedPath, navigation, matchedPath), navigation.controller.signal);
        }
        catch (error) {
            if (navigation.controller.signal.aborted)
                return;
            if (error instanceof Error)
                this._errorNavigations.set(error, navigation);
            await this.app.handleErrorOnce(error);
        }
        finally {
            navigation.elements.clear();
        }
    };
    _authorizeRoute = async (matchedPath, navigation) => {
        const requirements = matchedPath.authenticationChain.filter(requirement => requirement.authentication
            .authenticationRequired);
        if (requirements.length === 0) {
            return;
        }
        const authenticated = await awaitWithSignal(Promise.resolve(this.isAuthenticated()), navigation.controller.signal);
        navigation.controller.signal.throwIfAborted();
        if (!authenticated) {
            throw new AuthenticationError(matchedPath.path);
        }
        for (const requirement of requirements) {
            const requiredRoles = requirement.authentication
                .rolesRequired;
            if (requiredRoles.length === 0) {
                continue;
            }
            const authorized = await awaitWithSignal(Promise.resolve(this.checkUserRoles([...requiredRoles])), navigation.controller.signal);
            navigation.controller.signal.throwIfAborted();
            if (!authorized) {
                throw new AuthorizationError(matchedPath.path, [...requiredRoles]);
            }
        }
    };
    _loadPath = async (matchedPath, navigation, currentRoute) => {
        const signal = navigation.controller.signal;
        signal.throwIfAborted();
        this._emitRouteEvent(routeEventsEnum.START);
        signal.throwIfAborted();
        await this._renderLayout(matchedPath.layout, navigation);
        signal.throwIfAborted();
        const layout = Array.from(this.app.container.children).find(element => element instanceof
            matchedPath.layout);
        if (!layout) {
            throw new Error(`Failed to render layout '${matchedPath.layout.tagName}'.`);
        }
        await awaitWithSignal(layout.initComplete, signal);
        signal.throwIfAborted();
        const pageRoot = await this._renderSubLayouts(layout, matchedPath.subLayouts, navigation);
        signal.throwIfAborted();
        const targetContainer = this._findLayoutTarget(pageRoot, matchedPath.target);
        if (!targetContainer) {
            throw new Error(`Failed to find route target '${matchedPath.target}'.`);
        }
        const hashId = this.app.generateHash();
        this.app.originalInnerHTML.call(targetContainer, matchedPath.handler.generate(hashId, matchedPath.args));
        const generatedHandler = this.app.querySelector(`[data-hash-id="${hashId}"]`);
        if (generatedHandler) {
            this._trackNavigationElement(generatedHandler, navigation);
            await awaitWithSignal(generatedHandler.initComplete, signal);
        }
        signal.throwIfAborted();
        await this._setTitle(matchedPath.handler.tagName.toLowerCase(), matchedPath.title, navigation);
        signal.throwIfAborted();
        this.currentRoute = currentRoute;
        navigation.elements.clear();
        navigation.renderingErrorPage = false;
        this._emitRouteEvent(routeEventsEnum.FINISHED);
    };
    async _renderSubLayouts(baseLayout, subLayouts, navigation) {
        const signal = navigation.controller.signal;
        signal.throwIfAborted();
        let renderRoot = baseLayout;
        for (const [index, subLayout] of subLayouts.entries()) {
            const targetContainer = this._findLayoutTarget(renderRoot, subLayout.target);
            if (!targetContainer) {
                throw new Error(`Failed to find sublayout target ` +
                    `'${subLayout.target}' for ` +
                    `'${subLayout.layout.tagName}'.`);
            }
            const activeSubLayout = this._activeSubLayouts[index];
            const canReuse = activeSubLayout !== undefined &&
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
                await awaitWithSignal(activeSubLayout.element.initComplete, signal);
                signal.throwIfAborted();
                renderRoot =
                    activeSubLayout.element;
                continue;
            }
            this._clearSubLayoutsFrom(index);
            const hashId = this.app.generateHash();
            this.app.originalInnerHTML.call(targetContainer, subLayout.layout.generate(hashId));
            const subLayoutElement = targetContainer.querySelector(`[data-hash-id="${hashId}"]`);
            if (!subLayoutElement) {
                throw new Error(`Failed to render sublayout ` +
                    `'${subLayout.layout.tagName}' in ` +
                    `'${subLayout.target}'.`);
            }
            this._trackNavigationElement(subLayoutElement, navigation);
            subLayoutElement.setAttribute("data-jolt-router-layout", "");
            subLayoutElement.setAttribute("data-jolt-layout-depth", String(index));
            await awaitWithSignal(subLayoutElement.initComplete, signal);
            signal.throwIfAborted();
            this._activeSubLayouts.push({
                target: subLayout.target,
                layout: subLayout.layout,
                container: targetContainer,
                element: subLayoutElement,
            });
            renderRoot = subLayoutElement;
        }
        if (this._activeSubLayouts.length >
            subLayouts.length) {
            this._clearSubLayoutsFrom(subLayouts.length);
        }
        return renderRoot;
    }
    _clearSubLayoutsFrom(index) {
        const firstRemovedLayout = this._activeSubLayouts[index];
        if (firstRemovedLayout) {
            this.app.originalInnerHTML.call(firstRemovedLayout.container, "");
        }
        this._activeSubLayouts.splice(index);
    }
    _findLayoutTarget(root, selector) {
        if (root.matches(selector)) {
            return root;
        }
        return root.querySelector(selector);
    }
    _renderLayout = async (layout, navigation) => {
        const signal = navigation.controller.signal;
        signal.throwIfAborted();
        const existingLayout = Array.from(this.app.container.children).find(element => element instanceof layout);
        if (existingLayout) {
            await awaitWithSignal(existingLayout.initComplete, signal);
            signal.throwIfAborted();
            return;
        }
        this.app.originalInnerHTML.call(this.app.container, layout.generate());
        this._activeSubLayouts = [];
        const layoutElement = Array.from(this.app.container.children).find(element => element instanceof layout);
        if (!layoutElement) {
            throw new Error(`Failed to generate layout '${layout.tagName}'.`);
        }
        this._trackNavigationElement(layoutElement, navigation);
        await awaitWithSignal(layoutElement.initComplete, signal);
        signal.throwIfAborted();
        this._emitRouteEvent(routeEventsEnum.LAYOUT_CHANGE_FINISHED);
    };
    async _setTitle(tagName, title, navigation) {
        const signal = navigation.controller.signal;
        signal.throwIfAborted();
        const titleCandidate = await awaitWithSignal(Promise.resolve(this.titleGenerator(tagName, title)), signal) || title;
        signal.throwIfAborted();
        if (titleCandidate) {
            await this.setTitle(titleCandidate);
        }
    }
    _trackNavigationElement(element, navigation) {
        if (navigation.controller.signal.aborted) {
            element.remove();
            navigation.controller.signal.throwIfAborted();
        }
        navigation.elements.add(element);
    }
    async setTitle(title) {
        let titleElement = document.head.querySelector("title");
        if (!titleElement) {
            titleElement =
                document.createElement("title");
            document.head.prepend(titleElement);
        }
        titleElement.innerText = title == "_default" ? this.app.appName : title;
    }
    _emitRouteEvent(eventType) {
        this.app.container.dispatchEvent(new CustomEvent(eventType, {
            bubbles: true,
            cancelable: true,
        }));
    }
    _matchRoute(path) {
        const normalizedPath = this._normalizePath(path);
        for (const [routePattern, config] of this._routesMap) {
            const parameterNames = [];
            const parameterTypes = [];
            const escapedPattern = routePattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const regexPath = escapedPattern.replace(/<(str|int):([A-Za-z_]\w*)>/g, (_placeholder, type, parameterName) => {
                parameterNames.push(parameterName);
                parameterTypes.push(type);
                if (type === "str") {
                    return "([^/]+)";
                }
                return "(\\d+)";
            });
            const match = normalizedPath.match(new RegExp(`^${regexPath}$`));
            if (!match) {
                continue;
            }
            const parameters = {};
            for (let index = 0; index < parameterNames.length; index += 1) {
                const parameterName = parameterNames[index];
                const parameterType = parameterTypes[index];
                const capturedValue = match[index + 1];
                if (parameterName === undefined ||
                    parameterType === undefined ||
                    capturedValue === undefined) {
                    throw new RouteParametersError(routePattern);
                }
                parameters[parameterName] =
                    parameterType === "int"
                        ? Number.parseInt(capturedValue, 10)
                        : decodeURIComponent(capturedValue);
            }
            return {
                ...config,
                path: normalizedPath,
                pattern: routePattern,
                parameters,
            };
        }
        throw new RouteNotFoundError(normalizedPath);
    }
    async redirect(path, options = {}) {
        if (typeof path !== "string" ||
            path.trim().length === 0) {
            throw new TypeError("Redirect path must be a non-empty string.");
        }
        const destination = options.useBaseUrl
            ? this._createBaseUrlDestination(path, options.baseParameters ?? {})
            : path;
        await this._handleLinkPress(destination);
    }
    _createBaseUrlDestination(path, baseParameters) {
        if (!this.baseUrl) {
            return path;
        }
        const parameters = {
            ...this.routeParameters,
            ...baseParameters,
        };
        const expandedBaseUrl = this.baseUrl.replace(/<(str|int):([A-Za-z_]\w*)>/g, (_placeholder, type, parameterName) => {
            const value = parameters[parameterName];
            if (value === undefined) {
                throw new RouteParametersError(this.baseUrl, {
                    cause: new Error(`Missing base URL parameter '${parameterName}'.`),
                });
            }
            if (type === "int" &&
                !Number.isInteger(Number(value))) {
                throw new RouteParametersError(this.baseUrl, {
                    cause: new TypeError(`Base URL parameter '${parameterName}' must be an integer.`),
                });
            }
            const stringValue = String(value);
            if (stringValue.length === 0) {
                throw new RouteParametersError(this.baseUrl, {
                    cause: new TypeError(`Base URL parameter '${parameterName}' cannot be empty.`),
                });
            }
            return encodeURIComponent(stringValue);
        });
        const destination = new URL(path, location.origin);
        const destinationPath = this._normalizePath(destination.pathname);
        const pathname = destinationPath === "/"
            ? expandedBaseUrl
            : this._normalizePath(`${expandedBaseUrl}/${destinationPath}`);
        return (`${pathname}` +
            `${destination.search}` +
            `${destination.hash}`);
    }
    _handleLinkPress = async (href) => {
        const destination = new URL(href, location.href);
        history.pushState(this._getCurrentState(), "", `${destination.pathname}${destination.search}${destination.hash}`);
        await this.route();
    };
    _getCurrentState() {
        return {
            scrollPosition: {
                x: window.scrollX,
                y: window.scrollY,
            },
        };
    }
    urlIsCurrentPath(href) {
        const url = new URL(href, location.href);
        const path = this._normalizePath(url.pathname);
        return path === this.currentRoute?.path;
    }
    get routeParameters() {
        return this._routeParameters;
    }
    set routeParameters(params) {
        this._routeParameters = params;
    }
    get queryParameters() {
        return this.app.queryParameters;
    }
    get app() {
        return this._app;
    }
    get baseLayout() {
        return this._baseLayout;
    }
    get defaultTarget() {
        return this._defaultTarget;
    }
    get indexRoute() {
        return this._indexRoute;
    }
    get baseUrl() {
        return this._baseUrl;
    }
    get routes() {
        return this._routes;
    }
    get routesMap() {
        return this._routesMap;
    }
    get currentRoute() {
        return this._currentRoute;
    }
    set currentRoute(route) {
        this._currentRoute = route;
    }
    get origin() {
        return location.origin;
    }
    get hash() {
        return this.app.hash;
    }
    get port() {
        return this.app.port;
    }
    get hostname() {
        return this.app.hostname;
    }
    get host() {
        return location.host;
    }
    get pathname() {
        return location.pathname;
    }
}
export default Router;
//# sourceMappingURL=router.js.map