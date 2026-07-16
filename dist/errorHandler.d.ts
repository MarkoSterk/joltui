import App from "./app.js";
export type ErrorConstructor<TError extends Error = Error> = abstract new (...args: any[]) => TError;
export type ErrorHandlerMethod<TError extends Error = Error> = (error: TError) => void | Promise<void>;
export declare function handles(...errorTypes: ErrorConstructor[]): MethodDecorator;
export default class ErrorHandler<TApp extends App> {
    protected readonly _app: TApp;
    protected readonly _handlerMethods: Record<string, ErrorHandlerMethod>;
    constructor(app: TApp);
    protected _generateHandlerMethodsMapping(): Record<string, ErrorHandlerMethod>;
    handle(error: Error): Promise<boolean>;
}
//# sourceMappingURL=errorHandler.d.ts.map