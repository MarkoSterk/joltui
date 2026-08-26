import { RenderError, DotJSEngineError, MissingMarkupMethod, MethodExecutionError } from "./customElement.js";
import { AuthenticationError, AuthorizationError } from "./auth.js";
import { NotImplementedError } from "./utilities.js";
import { RouteFailedError, RouteNotFoundError, RouteParametersError, UnsupportedRouteParameterType } from "./router.js";
import { DependencyLoadError } from "./lazy.js";
declare class NetworkError extends Error {
    constructor(msg: string, options?: ErrorOptions);
}
declare class HttpRequestError extends Error {
    readonly method: string;
    readonly status: number;
    readonly statusText: string;
    readonly url: string;
    constructor(method: string, response: Response, options?: ErrorOptions);
}
declare class JsonResponseError extends Error {
    readonly method: string;
    readonly status: number;
    readonly url: string;
    constructor(method: string, response: Response, options?: ErrorOptions);
}
declare class InternalServerError extends Error {
    constructor(msg: string);
}
declare class ServerComponentNotFound extends Error {
    protected readonly tagName: string;
    protected readonly groupName: string;
    constructor(tagName: string, groupName: string);
}
declare class ServerComponentBadRequestResponse extends Error {
    protected readonly tagName: string;
    protected readonly groupName: string;
    constructor(tagName: string, groupName: string);
}
export { RenderError, DotJSEngineError, MissingMarkupMethod, MethodExecutionError, AuthenticationError, AuthorizationError, NotImplementedError, RouteFailedError, RouteNotFoundError, RouteParametersError, UnsupportedRouteParameterType, NetworkError, HttpRequestError, JsonResponseError, InternalServerError, ServerComponentNotFound, ServerComponentBadRequestResponse, DependencyLoadError, };
//# sourceMappingURL=errors.d.ts.map