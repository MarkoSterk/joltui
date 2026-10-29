import { ResponseError, createErrorResponse, type ResponseErrorOptions } from "./errorResponse.js";
import { RenderError, DotJSEngineError, MissingMarkupMethod, MethodExecutionError, ElementInitializationError, MarkupFetchError } from "./customElement.js";
import { AuthenticationError, AuthorizationError } from "./auth.js";
import { NotImplementedError } from "./utilities.js";
import {RouteFailedError, RouteNotFoundError, RouteParametersError, UnsupportedRouteParameterType} from "./router.js";
import { DependencyLoadError } from "./lazy.js";

class NetworkError extends ResponseError{
    constructor(msg: string, options?: ResponseErrorOptions){
        super(msg, options);
        this.name = "NetworkError";
    }
}

class HttpRequestError extends ResponseError {
    readonly method: string;
    readonly status: number;
    readonly statusText: string;
    readonly url: string;

    constructor(
        method: string,
        response: Response,
        options?: ResponseErrorOptions,
    ) {
        super(
            `${method} request to '${response.url}' failed ` +
            `with status ${response.status} ${response.statusText}.`,
            { ...options, response: options?.response ?? createErrorResponse({ method }, response) },
        );
        this.name = "HttpRequestError";
        this.method = method;
        this.status = response.status;
        this.statusText = response.statusText;
        this.url = response.url;
    }
}

class JsonResponseError extends ResponseError {
    readonly method: string;
    readonly status: number;
    readonly url: string;

    constructor(
        method: string,
        response: Response,
        options?: ResponseErrorOptions,
    ) {
        super(
            `Failed to parse JSON response from ${method} ` +
            `request to '${response.url}'.`,
            { ...options, response: options?.response ?? createErrorResponse({ method }, response) },
        );
        this.name = "JsonResponseError";
        this.method = method;
        this.status = response.status;
        this.url = response.url;
    }
}

class InternalServerError extends ResponseError{
    constructor(msg: string, options?: ResponseErrorOptions){
        super(msg, options);
        this.name = "InternalServerError";
    }
}

class ServerComponentNotFound extends ResponseError{
    protected readonly tagName: string;
    protected readonly groupName: string;
    constructor(tagName: string, groupName: string, options?: ResponseErrorOptions){
        super(`Server component with tagName '${tagName}' in group '${groupName}' not found.`, options);
        this.tagName = tagName;
        this.groupName = groupName;
        this.name = "ServerComponentNotFound";
    }
}

class ServerComponentBadRequestResponse extends ResponseError{
    protected readonly tagName: string;
    protected readonly groupName: string;
    constructor(tagName: string, groupName: string, options?: ResponseErrorOptions){
        super(`Server component with tagName '${tagName}' in group '${groupName}' returned a bad request response.`, options);
        this.tagName = tagName;
        this.groupName = groupName;
        this.name = "ServerComponentBadRequestResponse";
    }
}

export {
    RenderError,
    DotJSEngineError,
    MissingMarkupMethod,
    MethodExecutionError,
    AuthenticationError,
    AuthorizationError,
    NotImplementedError,
    RouteFailedError,
    RouteNotFoundError,
    RouteParametersError,
    UnsupportedRouteParameterType,
    NetworkError,
    HttpRequestError,
    JsonResponseError,
    InternalServerError,
    ServerComponentNotFound,
    ServerComponentBadRequestResponse,
    MarkupFetchError,
    DependencyLoadError,
    ElementInitializationError,
}
