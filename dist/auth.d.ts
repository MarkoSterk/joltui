import type { CustomElementClass } from "./customElement.js";
export declare function auth(roles?: readonly unknown[]): <TClass extends CustomElementClass>(elementClass: TClass, context: ClassDecoratorContext<TClass>) => void;
export declare class AuthenticationError extends Error {
}
export declare class AuthorizationError extends Error {
}
//# sourceMappingURL=auth.d.ts.map