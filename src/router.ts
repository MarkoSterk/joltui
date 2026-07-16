import App from "./app.js";
import { CustomElement, type CustomElementClass } from "./customElement.js";
import { AuthenticationError, AuthorizationError } from "./authenticator.js";

export const routeEventsEnum = {
    START: "route-change.start",
    FINISHED: "route-change.finished",
    LAYOUT_CHANGE_FINISHED: "route-change.layout-change.finished",
    ERROR_PAGE_START: "route-change.error-page.start",
    ERROR_PAGE_FINISHED: "route-change.error-page.finished",
} as const;

export class RouteFailedError extends Error{
  constructor(options?: ErrorOptions){
    super("Routing failed", options);
    this.name = "RouteFailedError";
  }
}

export class RouteNotFoundError extends Error{
  protected readonly route: string;
  constructor(route: string, options?: ErrorOptions){
    super(`Route '{path}' not found`, options);
    this.route = route;
    this.name = "RouteNotFoundError";
  }
}

export class RouteParametersError extends Error{
  protected readonly path: string;
  constructor(path: string, options?: ErrorOptions){
    super("Failed to parse route parameters for path " + path, options);
    this.path = path;
    this.name = "RoutePrametersError";
  }
}

export class UnsupportedRouteParameterType extends Error{
  protected readonly type: string;
  constructor(type: string, options?: ErrorOptions){
    super(`Route parameter of type '${type}' is not supported`, options);
    this.type = type;
    this.name = "UnsupportedRouteParameterType";
  }
}

export type RouteParameters = Record<
    string,
    string | number
>;


type RouteParameterType = "str" | "int";

type Authentication = {
  authenticationRequired: boolean;
  rolesRequired: unknown[];
};


type RouteHandlers = Record<string, CustomElementClass>;

type ScrollPosition = {
  x: Number,
  y: Number
}

type CurrentState = {
  scrollPosition: ScrollPosition
}

type HandlerArgs = Record<string, unknown>;

type RouteHandlerArgs = Record<
    string,
    HandlerArgs
>;

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
    handlers: RouteHandlers,
    authentication: Authentication|null, 
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

function isCustomElementClass(
    value: unknown,
): value is CustomElementClass {
    return (
        typeof value === "function" &&
        value.prototype instanceof CustomElement
    );
}

class Router<TApp extends App> {
  protected readonly _app: TApp;
  protected readonly _baseLayout: CustomElementClass;
  protected readonly _defaultTarget: string;
  protected readonly _indexRoute: string;
  protected readonly _baseUrl: string;
  protected readonly _routes: Route[];
  protected readonly _routesMap: Map<string, ParsedRoute>;
  protected _currentRoute: ParsedRoute|null;
  protected _routeParameters: RouteParameters
  protected _inTransition: boolean

  constructor({
    baseUrl = "",
    routes,
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

    if (!routes) {
      throw new Error("Missing routes object for router");
    }

    if (
      !baseLayout ||
      !isCustomElementClass(baseLayout)
    ) {
      throw new Error(
        "Missing base layout element for the application",
      );
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

  protected _handleRoutes(
    routes: RouteGenerator | Route[],
  ): Route[] {
    const parsedRoutes =
      typeof routes === "function"
        ? routes.call(this)
        : routes;

    if (!Array.isArray(parsedRoutes)) {
      throw new TypeError(
        "Route generator must return an array of routes",
      );
    }

    return parsedRoutes;
  }

  protected _parseRoutes({
    routes,
    parentPath = "",
    parentHandlers = {},
    layout = this._baseLayout,
  }: ParseRoutesConfig): Map<string, ParsedRoute> {
    const routeMap = new Map<string, ParsedRoute>();

    this._registerCustomElement(layout);

    for (const route of routes) {
      if (!route.path) {
        throw new Error("Route path cannot be empty");
      }

      if (!(route.handler instanceof CustomElement)) {
        throw new TypeError(
          `Invalid route handler for path "${route.path}"`,
        );
      }

      const fullPath = this._joinPaths(
        parentPath,
        route.path,
      );

      const routeLayout = route.layout ?? layout;
      const target =
        route.target ?? this._defaultTarget;

      this._registerCustomElement(routeLayout);
      this._registerCustomElement(route.handler);

      const handlers: RouteHandlers = {
        ...parentHandlers,
        [target]: route.handler,
      };

      if (route.handlers) {
        for (const [handlerTarget, handler] of Object.entries(
          route.handlers,
        )) {
          if (!(handler instanceof CustomElement)) {
            throw new TypeError(
              `Invalid handler for target "${handlerTarget}" on route "${fullPath}"`,
            );
          }

          this._registerCustomElement(handler);
          handlers[handlerTarget] = handler;
        }
      }

      const args =
        route.args !== undefined
          ? {
              [route.handler.tagName]: route.args,
            }
          : null;

      routeMap.set(fullPath, {
        handlers,
        layout: routeLayout,
        title: route.title ?? null,
        details: route.details ?? null,
        authentication:
          route.authentication ?? null,
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
            throw new Error(
              `Duplicate route path "${path}"`,
            );
          }

          routeMap.set(path, config);
        }
      }
    }

    return this._sortRoutes(routeMap);
  }

  protected _registerCustomElement(
    element: CustomElementClass,
  ): void {
    if (!customElements.get(element.tagName)) {
      this._app.registerCustomElements([element]);
    }
  }

  protected _joinPaths(
    parentPath: string,
    routePath: string,
  ): string {
    if (!parentPath) {
      return this._normalizePath(routePath);
    }

    if (routePath === "/") {
      return this._normalizePath(parentPath);
    }

    return this._normalizePath(
      `${parentPath}/${routePath}`,
    );
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

    return pathWithLeadingSlash.replace(/\/+$/, "");
  }

  protected _sortRoutes(
    routeMap: Map<string, ParsedRoute>,
  ): Map<string, ParsedRoute> {
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

  protected _popStateHandler = async (event: PopStateEvent) => {
    await this.route();
    if (event.state && event.state.scrollPosition) {
        const { x, y } = event.state.scrollPosition;
        window.scrollTo(x, y);
    }
  }

  protected _clickHandler = async (event: MouseEvent): Promise<void> => {
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

    const anchor = target.closest<HTMLAnchorElement>("a");

    if (!anchor) {
        return;
    }

    if (
      anchor.hasAttribute("router-ignore") ||
      anchor.hasAttribute("download") ||
      anchor.target === "_blank" ||
      !anchor.href ||
      anchor.protocol === "mailto:" ||
      anchor.protocol === "tel:"
  ) {
      return;
  }

    event.preventDefault();

    if (this._inTransition) {
        return;
    }

    this._inTransition = true;

    try {
        await this._handleLinkPress(anchor.href);
    } catch (error: unknown) {
        const e = new RouteFailedError()
        await this._app.handleError(e)
    } finally {
        this._inTransition = false;
    }
  };

  route = async () => {
    try{
      let path = location.pathname;
      path = path.replace(this.baseUrl, "");
      if(path === ""){
          path = "/";
      }
      const matchedPath: MatchedRoute = this._matchRoute(path);

      if(matchedPath?.authentication?.authenticationRequired){
        if(!this.app.authenticator.isAuthenticated()){
          throw new AuthenticationError(matchedPath.path);
        }
        if(matchedPath?.authentication?.rolesRequired){
          if(!this.app.authenticator.checkUserRoles(matchedPath.authentication?.rolesRequired)){
            throw new AuthorizationError(matchedPath.path, matchedPath.authentication?.rolesRequired)
          }
        }
      }
      await this._loadPath(matchedPath);
    }catch(e){
      return await this.app.handleError(e);
    }
  }

  protected _loadPath = async (matchedPath: MatchedRoute) => {
    this._emitRouteEvent(routeEventsEnum.START);
    const renderSequence = [];
    await this._renderLayout(matchedPath.layout);
    const layout: CustomElement = this.app.querySelector(matchedPath.layout.tagName) as CustomElement;
    await layout.initComplete;
    const handlersArray = Object.entries(matchedPath.handlers);
    for(const [index, [target, handler]] of handlersArray.entries()){
        const targetContainer = this.app.querySelector(target);
        if(!targetContainer){
            throw new Error(`Failed to get target (${target}) container for handler (${handler})`);
        }
        const existingElement = targetContainer.querySelector(handler.tagName);
        if(existingElement && (handlersArray.length != 1 || index < handlersArray.length - 1)){
            continue;
        }
        const hashId = this.app.generateHash()
        this.app.originalInnerHTML.call(targetContainer, handler.generate(hashId, matchedPath.args?.[handler.tagName]))
        const generatedHandler = this.app.querySelector(`[data-hash-id="${hashId}"]`) as CustomElement;
        if(generatedHandler){
            await generatedHandler.initComplete;
        }
        renderSequence.push([target, hashId, handler])
    }
    this._setTitle(matchedPath.title);
    this.currentRoute = {
        ...matchedPath,
    };
    this._emitRouteEvent(routeEventsEnum.FINISHED);
  }

  protected _renderLayout = async (layout: CustomElementClass) => {
    if(!this.app.querySelector(layout.tagName)){
        this.app.container.innerHTML = layout.generate();
        const layoutElement = this.app.querySelector(layout.tagName) as CustomElement;
        await layoutElement.initComplete;
        this._emitRouteEvent(routeEventsEnum.LAYOUT_CHANGE_FINISHED);
    }
  }

  protected _setTitle = (title: string|null) => {
    let titleElement = document.head.querySelector("title");
    if(!titleElement){
        titleElement = document.createElement("title");
        document.head.insertAdjacentElement("afterbegin", titleElement);
    }
    if(title == null){
      titleElement.innerText = this.app.appName;
      return;
    }
    titleElement.innerText = title;
  }
  
  protected _emitRouteEvent = (eventType: string) => {
    const customEvent = new CustomEvent(routeEventsEnum.FINISHED, {
        bubbles: true,
        cancelable: true,
    })
    this.app.container.dispatchEvent(customEvent);
  }

  protected _matchRoute(
        path: string,
    ): MatchedRoute {
      const normalizedPath = this._normalizePath(path);

      for (const [routePattern,config] of this._routesMap) {
        const parameterNames: string[] =
            [];

        const parameterTypes: RouteParameterType[] =
            [];

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
                    switch (type) {
                        case "str": return "([^/]+)";
                        case "int": return "(\\d+)";
                        default: {
                            const unsupportedType: never =
                                type;

                            throw new UnsupportedRouteParameterType(unsupportedType);
                        }
                    }
                },
            );
        const match =
            normalizedPath.match(
                new RegExp(
                    `^${regexPath}$`,
                ),
            );
        if (!match) {
            continue;
        }
        const parameters: RouteParameters = {};
        for (let index = 0; index < parameterNames.length;index++) {
          const parameterName = parameterNames[index];
          const parameterType = parameterTypes[index];
          const capturedValue = match[index + 1];
          if (parameterName ===undefined ||
              parameterType ===undefined ||
              capturedValue === undefined
          ) {
              throw new RouteParametersError(routePattern);
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


  protected _handleLinkPress = async (href: string) => {
      const state = this._getCurrentState();
      try{
        await this.route();
        history.pushState(state, "", href);
      }catch(e: unknown){
        await this.app.handleError(e);
      }
  }

  protected _getCurrentState = ():CurrentState => {
    const state = {
        scrollPosition: {
            x: window.scrollX,
            y: window.scrollY
        }
    }

    return state;
  }

  urlIsCurrentPath = (href: string): boolean => {
      let modifiedHref: string|any = href.replace(this.origin, "");
      modifiedHref = href.replace(this._baseUrl, "");
      modifiedHref = href.split("?", 2).length > 0 ? href.split("?", 2)[0] : null;
      return href == this.currentRoute?.route;
  }

  get routeParameters(): RouteParameters{
    return this._routeParameters;
  }

  set routeParameters(params: RouteParameters){
    this._routeParameters = params;
  }

  get queryParameters(): Record<string, string|number>{
    return this.app.queryParameters;
  }

  get app(): TApp {
    return this._app;
  }

  get baseLayout(): CustomElementClass {
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

  get routes(): Route[] {
    return this._routes;
  }

  get routesMap(): ReadonlyMap<string, ParsedRoute> {
    return this._routesMap;
  }

  get currentRoute(): ParsedRoute|null{
    return this._currentRoute;
  }

  set currentRoute(route: ParsedRoute|null){
    this._currentRoute = route;
  }

  get origin(){
    return location.origin;
  }

  get hash(){
    return this.app.hash;
  }

  get port(){
    return this.app.port;
  }

  get hostname(){
    return this.app.hostname;
  }

  get host(){
    return location.host;
  }

  get pathname(){
    return location.pathname;
  }
}

export default Router;