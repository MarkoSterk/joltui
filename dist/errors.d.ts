import { RenderError, DotJSEngineError, MissingMarkupMethod, MethodExecutionError } from "./customElement.js";
import { AuthenticationError, AuthorizationError } from "./auth.js";
import { NotImplementedError } from "./utilities.js";
import { RouteFailedError, RouteNotFoundError, RouteParametersError, UnsupportedRouteParameterType } from "./router.js";
declare class NetworkError extends Error {
    constructor(msg: string);
}
declare class InternalServerError extends Error {
    constructor(msg: string);
}
export { RenderError, DotJSEngineError, MissingMarkupMethod, MethodExecutionError, AuthenticationError, AuthorizationError, NotImplementedError, RouteFailedError, RouteNotFoundError, RouteParametersError, UnsupportedRouteParameterType, NetworkError, InternalServerError };
//# sourceMappingURL=errors.d.ts.map