import { RenderError, DotJSEngineError, MissingMarkupMethod, MethodExecutionError } from "./customElement.js";
import { AuthenticationError, AuthorizationError } from "./auth.js";
import { NotImplementedError } from "./utilities.js";
import { ExtensionNotRegistered } from "./app.js";
import {RouteFailedError, RouteNotFoundError, RouteParametersError, UnsupportedRouteParameterType} from "./router.js";


export {
    RenderError,
    DotJSEngineError,
    MissingMarkupMethod,
    MethodExecutionError,
    AuthenticationError,
    AuthorizationError,
    NotImplementedError,
    ExtensionNotRegistered,
    RouteFailedError,
    RouteNotFoundError,
    RouteParametersError,
    UnsupportedRouteParameterType,
}