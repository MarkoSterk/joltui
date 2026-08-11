import { RenderError, DotJSEngineError, MissingMarkupMethod, MethodExecutionError } from "./customElement.js";
import { AuthenticationError, AuthorizationError } from "./auth.js";
import { NotImplementedError } from "./utilities.js";
import { RouteFailedError, RouteNotFoundError, RouteParametersError, UnsupportedRouteParameterType } from "./router.js";
class NetworkError extends Error {
    constructor(msg, options) {
        super(msg, options);
        this.name = "NetworkError";
    }
}
class HttpRequestError extends Error {
    method;
    status;
    statusText;
    url;
    constructor(method, response, options) {
        super(`${method} request to '${response.url}' failed ` +
            `with status ${response.status} ${response.statusText}.`, options);
        this.name = "HttpRequestError";
        this.method = method;
        this.status = response.status;
        this.statusText = response.statusText;
        this.url = response.url;
    }
}
class JsonResponseError extends Error {
    method;
    status;
    url;
    constructor(method, response, options) {
        super(`Failed to parse JSON response from ${method} ` +
            `request to '${response.url}'.`, options);
        this.name = "JsonResponseError";
        this.method = method;
        this.status = response.status;
        this.url = response.url;
    }
}
class InternalServerError extends Error {
    constructor(msg) {
        super(msg);
        this.name = "InternalServerError";
    }
}
class ServerComponentNotFound extends Error {
    tagName;
    groupName;
    constructor(tagName, groupName) {
        super(`Server component with tagName '${tagName}' in group '${groupName}' not found.`);
        this.tagName = tagName;
        this.groupName = groupName;
        this.name = "ServerComponentNotFound";
    }
}
class ServerComponentBadRequestResponse extends Error {
    tagName;
    groupName;
    constructor(tagName, groupName) {
        super(`Server component with tagName '${tagName}' in group '${groupName}' returned a bad request response.`);
        this.tagName = tagName;
        this.groupName = groupName;
        this.name = "ServerComponentBadRequestResponse";
    }
}
export { RenderError, DotJSEngineError, MissingMarkupMethod, MethodExecutionError, AuthenticationError, AuthorizationError, NotImplementedError, RouteFailedError, RouteNotFoundError, RouteParametersError, UnsupportedRouteParameterType, NetworkError, HttpRequestError, JsonResponseError, InternalServerError, ServerComponentNotFound, ServerComponentBadRequestResponse };
//# sourceMappingURL=errors.js.map