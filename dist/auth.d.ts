import type { CustomElementClass } from "./customElement.js";
export declare function auth(roles?: readonly unknown[]): <TClass extends CustomElementClass>(elementClass: TClass, context: ClassDecoratorContext<TClass>) => void;
export declare class AuthenticationError extends Error {
    protected readonly path: string;
    constructor(path: string, options?: ErrorOptions);
}
export declare class AuthorizationError extends Error {
    protected readonly path: string;
    protected readonly roles: unknown[];
    constructor(path: string, roles: unknown[], options?: ErrorOptions);
}
//# sourceMappingURL=auth.d.ts.map