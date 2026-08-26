import { RenderError, DotJSEngineError, MissingMarkupMethod, MethodExecutionError, ElementInitializationError } from "./customElement.js";
import { AuthenticationError, AuthorizationError } from "./auth.js";
import { NotImplementedError } from "./utilities.js";
import {RouteFailedError, RouteNotFoundError, RouteParametersError, UnsupportedRouteParameterType} from "./router.js";
import { DependencyLoadError } from "./lazy.js";

class NetworkError extends Error{
    constructor(msg: string, options?: ErrorOptions){
        super(msg, options);
        this.name = "NetworkError";
    }
}

class HttpRequestError extends Error {
    readonly method: string;
    readonly status: number;
    readonly statusText: string;
    readonly url: string;

    constructor(
        method: string,
        response: Response,
        options?: ErrorOptions,
    ) {
        super(
            `${method} request to '${response.url}' failed ` +
            `with status ${response.status} ${response.statusText}.`,
            options,
        );
        this.name = "HttpRequestError";
        this.method = method;
        this.status = response.status;
        this.statusText = response.statusText;
        this.url = response.url;
    }
}

class JsonResponseError extends Error {
    readonly method: string;
    readonly status: number;
    readonly url: string;

    constructor(
        method: string,
        response: Response,
        options?: ErrorOptions,
    ) {
        super(
            `Failed to parse JSON response from ${method} ` +
            `request to '${response.url}'.`,
            options,
        );
        this.name = "JsonResponseError";
        this.method = method;
        this.status = response.status;
        this.url = response.url;
    }
}

class InternalServerError extends Error{
    constructor(msg: string){
        super(msg);
        this.name = "InternalServerError";
    }
}

class ServerComponentNotFound extends Error{
    protected readonly tagName: string;
    protected readonly groupName: string;
    constructor(tagName: string, groupName: string){
        super(`Server component with tagName '${tagName}' in group '${groupName}' not found.`);
        this.tagName = tagName;
        this.groupName = groupName;
        this.name = "ServerComponentNotFound";
    }
}

class ServerComponentBadRequestResponse extends Error{
    protected readonly tagName: string;
    protected readonly groupName: string;
    constructor(tagName: string, groupName: string){
        super(`Server component with tagName '${tagName}' in group '${groupName}' returned a bad request response.`);
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
    DependencyLoadError,
    ElementInitializationError,
}
