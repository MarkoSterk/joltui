import { ResponseError, type ResponseErrorOptions } from "./errorResponse.js";
import type { CustomElementClass } from "./customElement.js";
export declare function auth(roles?: readonly unknown[]): <TClass extends CustomElementClass>(elementClass: TClass, context: ClassDecoratorContext<TClass>) => void;
export declare class AuthenticationError extends ResponseError {
    readonly path: string;
    constructor(path: string, options?: ResponseErrorOptions);
}
export declare class AuthorizationError extends ResponseError {
    readonly path: string;
    readonly roles: unknown[];
    constructor(path: string, roles: unknown[], options?: ResponseErrorOptions);
}
//# sourceMappingURL=auth.d.ts.map