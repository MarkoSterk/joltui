import { ResponseError, type ResponseErrorOptions } from "./errorResponse.js";
import { RenderError, DotJSEngineError, MissingMarkupMethod, MethodExecutionError, ElementInitializationError, MarkupFetchError } from "./customElement.js";
import { AuthenticationError, AuthorizationError } from "./auth.js";
import { NotImplementedError } from "./utilities.js";
import { RouteFailedError, RouteNotFoundError, RouteParametersError, UnsupportedRouteParameterType } from "./router.js";
import { DependencyLoadError } from "./lazy.js";
declare class NetworkError extends ResponseError {
    constructor(msg: string, options?: ResponseErrorOptions);
}
declare class HttpRequestError extends ResponseError {
    readonly method: string;
    readonly status: number;
    readonly statusText: string;
    readonly url: string;
    constructor(method: string, response: Response, options?: ResponseErrorOptions);
}
declare class JsonResponseError extends ResponseError {
    readonly method: string;
    readonly status: number;
    readonly url: string;
    constructor(method: string, response: Response, options?: ResponseErrorOptions);
}
declare class InternalServerError extends ResponseError {
    constructor(msg: string, options?: ResponseErrorOptions);
}
declare class ServerComponentNotFound extends ResponseError {
    protected readonly tagName: string;
    protected readonly groupName: string;
    constructor(tagName: string, groupName: string, options?: ResponseErrorOptions);
}
declare class ServerComponentBadRequestResponse extends ResponseError {
    protected readonly tagName: string;
    protected readonly groupName: string;
    constructor(tagName: string, groupName: string, options?: ResponseErrorOptions);
}
export { RenderError, DotJSEngineError, MissingMarkupMethod, MethodExecutionError, AuthenticationError, AuthorizationError, NotImplementedError, RouteFailedError, RouteNotFoundError, RouteParametersError, UnsupportedRouteParameterType, NetworkError, HttpRequestError, JsonResponseError, InternalServerError, ServerComponentNotFound, ServerComponentBadRequestResponse, MarkupFetchError, DependencyLoadError, ElementInitializationError, };
//# sourceMappingURL=errors.d.ts.map