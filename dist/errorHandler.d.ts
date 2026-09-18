import App from "./app.js";
export type ErrorConstructor<TError extends Error = Error> = abstract new (...args: any[]) => TError;
export type ErrorHandlerMethod<TError extends Error = Error> = (error: TError) => void | Promise<void>;
export type ErrorHandlerClass<TApp extends App = App> = new (app: TApp) => ErrorHandler<TApp>;
export declare function handles(...errorTypes: ErrorConstructor[]): <TThis, TError extends Error>(method: (this: TThis, error: TError) => void | Promise<void>, context: ClassMethodDecoratorContext<TThis, (this: TThis, error: TError) => void | Promise<void>>) => void;
export default class ErrorHandler<TApp extends App> {
    protected readonly _app: TApp;
    protected readonly _handlerMethods: Map<ErrorConstructor, ErrorHandlerMethod>;
    constructor(app: TApp);
    protected _generateHandlerMethodsMapping(): Map<ErrorConstructor, ErrorHandlerMethod>;
    handle(error: Error): Promise<boolean>;
    get app(): TApp;
}
//# sourceMappingURL=errorHandler.d.ts.map