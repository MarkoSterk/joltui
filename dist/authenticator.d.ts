import App from "./app.js";
export declare class AuthenticationError extends Error {
    protected readonly path: string;
    constructor(path: string, options?: ErrorOptions);
}
export declare class AuthorizationError extends Error {
    protected readonly path: string;
    protected readonly roles: any[];
    constructor(path: string, roles: any[], options?: ErrorOptions);
}
declare class Authenticator<TApp extends App> {
    protected readonly _app: TApp;
    constructor(app: TApp);
    isAuthenticated: () => Promise<never>;
    checkUserRoles: (roles: any[]) => Promise<never>;
}
export default Authenticator;
//# sourceMappingURL=authenticator.d.ts.map