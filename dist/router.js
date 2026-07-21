import App from "./app.js";
import { CustomElement, } from "./customElement.js";
import { getElementMetadata, requireElementMetadata, } from "./elementMetadata.js";
import { NotImplementedError } from "./utilities.js";
export const routeEventsEnum = {
    START: "route-change.start",
    FINISHED: "route-change.finished",
    LAYOUT_CHANGE_FINISHED: "route-change.layout-change.finished",
    ERROR_PAGE_START: "route-change.error-page.start",
    ERROR_PAGE_FINISHED: "route-change.error-page.finished",
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
export class AuthenticationError extends Error {
    path;
    constructor(path, options) {
        super("User not authenticated", options);
        this.path = path;
        this.name = "AuthenticationError";
    }
}
export class AuthorizationError extends Error {
    path;
    roles;
    constructor(path, roles, options) {
        super("User is not authorized for this route", options);
        this.path = path;
        this.roles = roles;
        this.name = "AuthorizationError";
    }
}
function isCustomElementClass(value) {
    return (typeof value === "function" &&
        value.prototype instanceof CustomElement);
}
class Router {
    _app;
    _baseLayout;
    _defaultTarget;
    _indexRoute;
    _baseUrl;
    _routes;
    _routesMap;
    _currentRoute = null;
    _routeParameters = {};
    _inTransition = false;
    constructor({ baseUrl = "", baseLayout, defaultTarget, indexRoute = "/", app, }) {
        if (!app) {
            throw new Error("Missing application object in router constructor");
        }
        if (!isCustomElementClass(baseLayout)) {
            throw new TypeError("Invalid base layout element class");
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
        this._defaultTarget = defaultTarget;
        this._indexRoute = this._normalizePath(indexRoute);
        this._baseUrl = this._normalizeBaseUrl(baseUrl);
        this._routes = this._discoverRoutes();
        this._routesMap = this._parseRoutes(this._routes);
        this.app.addEventListener("click", this._clickHandler);
        window.addEventListener("popstate", this._popStateHandler);
    }
    isAuthenticated = async () => {
        throw new NotImplementedError("Router.isAuthenticated");
    };
    checkUserRoles = async (_roles) => {
        throw new NotImplementedError("Router.checkUserRoles");
    };
    _discoverRoutes() {
        const routes = [];
        for (const elementClass of this.app.elements) {
            if (!isCustomElementClass(elementClass)) {
                throw new TypeError("Application elements must contain CustomElement classes.");
            }
            const metadata = getElementMetadata(elementClass);
            if (!metadata || metadata.kind !== "page") {
                continue;
            }
            routes.push(this._createRouteFromMetadata(elementClass, metadata));
        }
        if (routes.length === 0) {
            throw new Error("The application does not contain any @page components.");
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
        if (!this.app.elements.includes(layout)) {
            throw new Error(`Page layout '${layout.name}' is not registered ` +
                `in app.elements.`);
        }
        return {
            path: this._normalizePath(metadata.path),
            handler,
            target: metadata.target ??
                this._defaultTarget,
            layout,
            title: metadata.title,
            extras: metadata.extras,
            authentication: metadata.authentication,
            roles: metadata.roles,
        };
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
                title: route.title,
                extras: route.extras,
                authentication: route.authentication,
                args: null,
                roles: route.roles,
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
        return this._normalizePath(baseUrl);
    }
    _sortRoutes(routeMap) {
        const sortedRoutes = Array.from(routeMap.entries()).sort(([firstPath], [secondPath]) => {
            const lengthDifference = secondPath.length - firstPath.length;
            if (lengthDifference !== 0) {
                return lengthDifference;
            }
            if (firstPath.includes("<str:") &&
                secondPath.includes("<int:")) {
                return -1;
            }
            if (firstPath.includes("<int:") &&
                secondPath.includes("<str:")) {
                return 1;
            }
            return 0;
        });
        return new Map(sortedRoutes);
    }
    _popStateHandler = async (event) => {
        await this.route();
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
        if (this._inTransition) {
            return;
        }
        this._inTransition = true;
        try {
            await this.redirect(anchor.href);
        }
        catch (error) {
            await this._app.handleError(new RouteFailedError({
                cause: error,
            }));
        }
        finally {
            this._inTransition = false;
        }
    };
    route = async () => {
        try {
            let path = location.pathname;
            if (this.baseUrl &&
                path.startsWith(this.baseUrl)) {
                path = path.slice(this.baseUrl.length);
            }
            if (!path) {
                path = this.indexRoute;
            }
            const matchedPath = this._matchRoute(path);
            if (matchedPath.authentication
                ?.authenticationRequired) {
                const authenticated = await this.isAuthenticated();
                if (!authenticated) {
                    throw new AuthenticationError(matchedPath.path);
                }
                const requiredRoles = matchedPath.authentication
                    .rolesRequired;
                if (requiredRoles.length > 0) {
                    const authorized = await this.checkUserRoles(requiredRoles);
                    if (!authorized) {
                        throw new AuthorizationError(matchedPath.path, requiredRoles);
                    }
                }
            }
            await this._loadPath(matchedPath);
        }
        catch (error) {
            await this.app.handleError(error);
        }
    };
    _loadPath = async (matchedPath) => {
        this._emitRouteEvent(routeEventsEnum.START);
        await this._renderLayout(matchedPath.layout);
        const layout = this.app.querySelector(matchedPath.layout.tagName);
        if (!layout) {
            throw new Error(`Failed to render layout '${matchedPath.layout.tagName}'.`);
        }
        await layout.initComplete;
        const targetContainer = this.app.querySelector(matchedPath.target);
        if (!targetContainer) {
            throw new Error(`Failed to find route target '${matchedPath.target}'.`);
        }
        const hashId = this.app.generateHash();
        this.app.originalInnerHTML.call(targetContainer, matchedPath.handler.generate(hashId, matchedPath.args));
        const generatedHandler = this.app.querySelector(`[data-hash-id="${hashId}"]`);
        if (generatedHandler) {
            await generatedHandler.initComplete;
        }
        this._setTitle(matchedPath.title);
        this.currentRoute = matchedPath;
        this._emitRouteEvent(routeEventsEnum.FINISHED);
    };
    _renderLayout = async (layout) => {
        if (this.app.querySelector(layout.tagName)) {
            return;
        }
        this.app.originalInnerHTML.call(this.app.container, layout.generate());
        const layoutElement = this.app.querySelector(layout.tagName);
        if (!layoutElement) {
            throw new Error(`Failed to generate layout '${layout.tagName}'.`);
        }
        await layoutElement.initComplete;
        this._emitRouteEvent(routeEventsEnum.LAYOUT_CHANGE_FINISHED);
    };
    _setTitle(title) {
        let titleElement = document.head.querySelector("title");
        if (!titleElement) {
            titleElement =
                document.createElement("title");
            document.head.prepend(titleElement);
        }
        titleElement.innerText =
            title ?? this.app.appName;
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
                if (type === "int") {
                    return "(\\d+)";
                }
                throw new UnsupportedRouteParameterType(type);
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
            this._routeParameters = parameters;
            return {
                ...config,
                path: normalizedPath,
                pattern: routePattern,
                parameters,
            };
        }
        this._routeParameters = {};
        throw new RouteNotFoundError(normalizedPath);
    }
    async redirect(path) {
        if (typeof path !== "string" ||
            path.trim().length === 0) {
            throw new TypeError("Redirect path must be a non-empty string.");
        }
        await this._handleLinkPress(path);
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
        const path = this._normalizePath(url.pathname.replace(this.baseUrl, ""));
        return path === this.currentRoute?.route;
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