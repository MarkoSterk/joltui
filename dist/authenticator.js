import App from "./app.js";
import { NotImplementedError } from "./utilities.js";
export class AuthenticationError extends Error {
    path;
    constructor(path, options) {
        super("User not authenticated");
        this.path = path;
        this.name = "AuthenticationError";
    }
}
export class AuthorizationError extends Error {
    path;
    roles;
    constructor(path, roles, options) {
        super();
        this.path = path;
        this.roles = roles;
        this.name = "AuthorizationError";
    }
}
class Authenticator {
    _app;
    constructor(app) {
        this._app = app;
    }
    isAuthenticated = async () => {
        throw new NotImplementedError("Authenticator.isAuthorized");
    };
    checkUserRoles = async (roles) => {
        throw new NotImplementedError("Authenticator.checkUserRoles");
    };
}
export default Authenticator;
//# sourceMappingURL=authenticator.js.map