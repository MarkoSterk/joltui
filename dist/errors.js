import { RenderError, DotJSEngineError, MissingMarkupMethod, MethodExecutionError } from "./customElement.js";
import { AuthenticationError, AuthorizationError } from "./auth.js";
import { NotImplementedError } from "./utilities.js";
import { RouteFailedError, RouteNotFoundError, RouteParametersError, UnsupportedRouteParameterType } from "./router.js";
class NetworkError extends Error {
    constructor(msg) {
        super(msg);
        this.name = "NetworkError";
    }
}
class InternalServerError extends Error {
    constructor(msg) {
        super(msg);
        this.name = "InternalServerError";
    }
}
export { RenderError, DotJSEngineError, MissingMarkupMethod, MethodExecutionError, AuthenticationError, AuthorizationError, NotImplementedError, RouteFailedError, RouteNotFoundError, RouteParametersError, UnsupportedRouteParameterType, NetworkError, InternalServerError };
//# sourceMappingURL=errors.js.map