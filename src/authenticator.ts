import App from "./app.js";
import { NotImplementedError } from "./utilities.js";

export class AuthenticationError extends Error{
    protected readonly path: string;
    constructor(path: string, options?: ErrorOptions){
        super("User not authenticated");
        this.path = path;
        this.name = "AuthenticationError";
    }
}
export class AuthorizationError extends Error{
    protected readonly path: string;
    protected readonly roles: any[];
    constructor(path: string, roles: any[], options?: ErrorOptions){
        super();
        this.path = path;
        this.roles = roles;
        this.name = "AuthorizationError";
    }
}

class Authenticator<TApp extends App>{
    protected readonly _app: TApp;
    constructor(app: TApp){
        this._app = app;
    }

    isAuthenticated = async () => {
        throw new NotImplementedError("Authenticator.isAuthorized");
    }

    checkUserRoles = async (roles: any[]) => {
        throw new NotImplementedError("Authenticator.checkUserRoles");
    }

}

export default Authenticator;