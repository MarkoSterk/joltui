import { ResponseError } from "./errorResponse.js";
import { setElementAuthenticationMetadata, } from "./elementMetadata.js";
export function auth(roles = []) {
    if (!Array.isArray(roles)) {
        throw new TypeError("@auth roles must be an array.");
    }
    const requiredRoles = [...roles];
    return function authDecorator(elementClass, context) {
        if (context.kind !== "class") {
            throw new TypeError("@auth can only decorate classes.");
        }
        setElementAuthenticationMetadata(elementClass, {
            authenticationRequired: true,
            rolesRequired: requiredRoles,
        });
    };
}
export class AuthenticationError extends ResponseError {
    path;
    constructor(path, options) {
        super("User not authenticated", options);
        this.path = path;
        this.name = "AuthenticationError";
    }
}
export class AuthorizationError extends ResponseError {
    path;
    roles;
    constructor(path, roles, options) {
        super("User is not authorized for this route", options);
        this.path = path;
        this.roles = roles;
        this.name = "AuthorizationError";
    }
}
//# sourceMappingURL=auth.js.map