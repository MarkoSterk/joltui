import App from "./app.js";
import { CustomElement } from "./customElement.js";
import { AuthenticationError, AuthorizationError } from "./authenticator.js";
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
        super(`Route '{path}' not found`, options);
        this.route = route;
        this.name = "RouteNotFoundError";
    }
}
export class RouteParametersError extends Error {
    path;
    constructor(path, options) {
        super("Failed to parse route parameters for path " + path, options);
        this.path = path;
        this.name = "RoutePrametersError";
    }
}
export class UnsupportedRouteParameterType extends Error {
    type;
    constructor(type, options) {
        super(`Route parameter of type '${type}' is not supported`, options);
        this.type = type;
        this.name = "UnsupportedRouteParameterType";
    }
}
class Router {
    _app;
    _baseLayout;
    _defaultTarget;
    _indexRoute;
    _baseUrl;
    _routes;
    _routesMap;
    _currentRoute;
    _routeParameters;
    _inTransition;
    constructor({ baseUrl = "", routes, baseLayout, defaultTarget, indexRoute = "/", app, }) {
        if (!app) {
            throw new Error("Missing application object in router constructor");
        }
        if (!routes) {
            throw new Error("Missing routes object for router");
        }
        if (!baseLayout ||
            !(baseLayout instanceof CustomElement)) {
            throw new Error("Missing base layout element for the application");
        }
        this._app = app;
        this._inTransition = false;
        this._baseLayout = baseLayout;
        this._defaultTarget = defaultTarget;
        this._indexRoute = indexRoute;
        this._baseUrl = baseUrl;
        this._routes = this._handleRoutes(routes);
        this._routesMap = this._parseRoutes({
            routes: this._routes,
        });
        this.app.addEventListener("click", this._clickHandler);
        window.addEventListener("popstate", this._popStateHandler);
        this._currentRoute = null;
        this._routeParameters = {};
    }
    _handleRoutes(routes) {
        const parsedRoutes = typeof routes === "function"
            ? routes.call(this)
            : routes;
        if (!Array.isArray(parsedRoutes)) {
            throw new TypeError("Route generator must return an array of routes");
        }
        return parsedRoutes;
    }
    _parseRoutes({ routes, parentPath = "", parentHandlers = {}, layout = this._baseLayout, }) {
        const routeMap = new Map();
        this._registerCustomElement(layout);
        for (const route of routes) {
            if (!route.path) {
                throw new Error("Route path cannot be empty");
            }
            if (!(route.handler instanceof CustomElement)) {
                throw new TypeError(`Invalid route handler for path "${route.path}"`);
            }
            const fullPath = this._joinPaths(parentPath, route.path);
            const routeLayout = route.layout ?? layout;
            const target = route.target ?? this._defaultTarget;
            this._registerCustomElement(routeLayout);
            this._registerCustomElement(route.handler);
            const handlers = {
                ...parentHandlers,
                [target]: route.handler,
            };
            if (route.handlers) {
                for (const [handlerTarget, handler] of Object.entries(route.handlers)) {
                    if (!(handler instanceof CustomElement)) {
                        throw new TypeError(`Invalid handler for target "${handlerTarget}" on route "${fullPath}"`);
                    }
                    this._registerCustomElement(handler);
                    handlers[handlerTarget] = handler;
                }
            }
            const args = route.args !== undefined
                ? {
                    [route.handler.tagName]: route.args,
                }
                : null;
            routeMap.set(fullPath, {
                handlers,
                layout: routeLayout,
                title: route.title ?? null,
                details: route.details ?? null,
                authentication: route.authentication ?? null,
                args,
                roles: route.roles ?? null,
                route: fullPath
            });
            if (route.children?.length) {
                const childRoutes = this._parseRoutes({
                    routes: route.children,
                    parentPath: fullPath,
                    parentHandlers: handlers,
                    layout: routeLayout,
                });
                for (const [path, config] of childRoutes) {
                    if (routeMap.has(path)) {
                        throw new Error(`Duplicate route path "${path}"`);
                    }
                    routeMap.set(path, config);
                }
            }
        }
        return this._sortRoutes(routeMap);
    }
    _registerCustomElement(element) {
        if (!customElements.get(element.tagName)) {
            this._app.registerCustomElements([element]);
        }
    }
    _joinPaths(parentPath, routePath) {
        if (!parentPath) {
            return this._normalizePath(routePath);
        }
        if (routePath === "/") {
            return this._normalizePath(parentPath);
        }
        return this._normalizePath(`${parentPath}/${routePath}`);
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
        if (event.state && event.state.scrollPosition) {
            const { x, y } = event.state.scrollPosition;
            window.scrollTo(x, y);
        }
    };
    _clickHandler = async (event) => {
        if (event.defaultPrevented || event.button !== 0) {
            return;
        }
        if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) {
            return;
        }
        const target = event.target;
        if (!(target instanceof Element)) {
            return;
        }
        const anchor = target.closest("a");
        if (!anchor) {
            return;
        }
        if (anchor.hasAttribute("router-ignore") ||
            anchor.hasAttribute("download") ||
            anchor.target === "_blank" ||
            !anchor.href ||
            anchor.protocol === "mailto:" ||
            anchor.protocol === "tel:") {
            return;
        }
        event.preventDefault();
        if (this._inTransition) {
            return;
        }
        this._inTransition = true;
        try {
            await this._handleLinkPress(anchor.href);
        }
        catch (error) {
            const e = new RouteFailedError();
            await this._app.handleError(e);
        }
        finally {
            this._inTransition = false;
        }
    };
    route = async () => {
        try {
            let path = location.pathname;
            path = path.replace(this.baseUrl, "");
            if (path === "") {
                path = "/";
            }
            const matchedPath = this._matchRoute(path);
            if (matchedPath?.authentication?.authenticationRequired) {
                if (!this.app.authenticator.isAuthenticated()) {
                    throw new AuthenticationError(matchedPath.path);
                }
                if (matchedPath?.authentication?.rolesRequired) {
                    if (!this.app.authenticator.checkUserRoles(matchedPath.authentication?.rolesRequired)) {
                        throw new AuthorizationError(matchedPath.path, matchedPath.authentication?.rolesRequired);
                    }
                }
            }
            await this._loadPath(matchedPath);
        }
        catch (e) {
            return await this.app.handleError(e);
        }
    };
    _loadPath = async (matchedPath) => {
        this._emitRouteEvent(routeEventsEnum.START);
        const renderSequence = [];
        await this._renderLayout(matchedPath.layout);
        const layout = this.app.querySelector(matchedPath.layout.tagName);
        await layout.initComplete;
        const handlersArray = Object.entries(matchedPath.handlers);
        for (const [index, [target, handler]] of handlersArray.entries()) {
            const targetContainer = this.app.querySelector(target);
            if (!targetContainer) {
                throw new Error(`Failed to get target (${target}) container for handler (${handler})`);
            }
            const existingElement = targetContainer.querySelector(handler.tagName);
            if (existingElement && (handlersArray.length != 1 || index < handlersArray.length - 1)) {
                continue;
            }
            const hashId = this.app.generateHash();
            this.app.originalInnerHTML.call(targetContainer, handler.generate(hashId, matchedPath.args?.[handler.tagName]));
            const generatedHandler = this.app.querySelector(`[data-hash-id="${hashId}"]`);
            if (generatedHandler) {
                await generatedHandler.initComplete;
            }
            renderSequence.push([target, hashId, handler]);
        }
        this._setTitle(matchedPath.title);
        this.currentRoute = {
            ...matchedPath,
        };
        this._emitRouteEvent(routeEventsEnum.FINISHED);
    };
    _renderLayout = async (layout) => {
        if (!this.app.querySelector(layout.tagName)) {
            this.app.container.innerHTML = layout.generate();
            const layoutElement = this.app.querySelector(layout.tagName);
            await layoutElement.initComplete;
            this._emitRouteEvent(routeEventsEnum.LAYOUT_CHANGE_FINISHED);
        }
    };
    _setTitle = (title) => {
        let titleElement = document.head.querySelector("title");
        if (!titleElement) {
            titleElement = document.createElement("title");
            document.head.insertAdjacentElement("afterbegin", titleElement);
        }
        if (title == null) {
            titleElement.innerText = this.app.appName;
            return;
        }
        titleElement.innerText = title;
    };
    _emitRouteEvent = (eventType) => {
        const customEvent = new CustomEvent(routeEventsEnum.FINISHED, {
            bubbles: true,
            cancelable: true,
        });
        this.app.container.dispatchEvent(customEvent);
    };
    _matchRoute(path) {
        const normalizedPath = this._normalizePath(path);
        for (const [routePattern, config] of this._routesMap) {
            const parameterNames = [];
            const parameterTypes = [];
            const escapedPattern = routePattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const regexPath = escapedPattern.replace(/<(str|int):([A-Za-z_]\w*)>/g, (_placeholder, type, parameterName) => {
                parameterNames.push(parameterName);
                parameterTypes.push(type);
                switch (type) {
                    case "str": return "([^/]+)";
                    case "int": return "(\\d+)";
                    default: {
                        const unsupportedType = type;
                        throw new UnsupportedRouteParameterType(unsupportedType);
                    }
                }
            });
            const match = normalizedPath.match(new RegExp(`^${regexPath}$`));
            if (!match) {
                continue;
            }
            const parameters = {};
            for (let index = 0; index < parameterNames.length; index++) {
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
    _handleLinkPress = async (href) => {
        const state = this._getCurrentState();
        try {
            await this.route();
            history.pushState(state, "", href);
        }
        catch (e) {
            await this.app.handleError(e);
        }
    };
    _getCurrentState = () => {
        const state = {
            scrollPosition: {
                x: window.scrollX,
                y: window.scrollY
            }
        };
        return state;
    };
    urlIsCurrentPath = (href) => {
        let modifiedHref = href.replace(this.origin, "");
        modifiedHref = href.replace(this._baseUrl, "");
        modifiedHref = href.split("?", 2).length > 0 ? href.split("?", 2)[0] : null;
        return href == this.currentRoute?.route;
    };
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