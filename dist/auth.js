import App from "./app.js";
import { setPageAuthenticationMetadata, } from "./elementMetadata.js";
export function auth(roles = []) {
    if (!Array.isArray(roles)) {
        throw new TypeError("@auth roles must be an array.");
    }
    const requiredRoles = [...roles];
    return function authDecorator(elementClass, context) {
        if (context.kind !== "class") {
            throw new TypeError("@auth can only decorate classes.");
        }
        setPageAuthenticationMetadata(elementClass, {
            authenticationRequired: true,
            rolesRequired: requiredRoles,
        });
    };
}
export class AuthenticationError extends Error {
}
export class AuthorizationError extends Error {
}
//# sourceMappingURL=auth.js.map