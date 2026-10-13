import App from "./app.js";

export type ErrorConstructor<TError extends Error = Error> = abstract new (
    ...args: any[]
) => TError;

export type ErrorHandlerMethod<TError extends Error = Error> = (
    error: TError
) => void | Promise<void>;

const HANDLED_ERRORS = Symbol("handledErrors");

type DecoratedHandler = ErrorHandlerMethod & {
    [HANDLED_ERRORS]?: readonly ErrorConstructor[];
};

export type ErrorHandlerClass<
    TApp extends App = App,
> = new (app: TApp) => ErrorHandler<TApp>;

export function handles(
    ...errorTypes: ErrorConstructor[]
) {
    if (errorTypes.length === 0) {
        throw new Error("@handles requires at least one Error class.");
    }

    return function handlesDecorator<
        TThis,
        TError extends Error,
    >(
        method: (
            this: TThis,
            error: TError,
        ) => void | Promise<void>,
        context: ClassMethodDecoratorContext<
            TThis,
            (
                this: TThis,
                error: TError,
            ) => void | Promise<void>
        >,
    ): void {
        if (context.static) {
            throw new TypeError(
                "@handles cannot decorate static methods.",
            );
        }

        if (context.private) {
            throw new TypeError(
                "@handles cannot decorate private methods.",
            );
        }

        const decoratedMethod =
            method as unknown as DecoratedHandler;

        decoratedMethod[HANDLED_ERRORS] = [
            ...errorTypes,
        ];
    }
}

export default class ErrorHandler<TApp extends App> {
    protected readonly _app: TApp;

    protected readonly _handlerMethods: Map<
        ErrorConstructor,
        ErrorHandlerMethod
    >;

    constructor(app: TApp) {
        this._app = app;
        this._handlerMethods = this._generateHandlerMethodsMapping();
    }

    protected _generateHandlerMethodsMapping(): Map<
        ErrorConstructor,
        ErrorHandlerMethod
    > {
        const handlers = new Map<
            ErrorConstructor,
            ErrorHandlerMethod
        >();

        const seenNames = new Set<string>();
        let prototype: object | null = Object.getPrototypeOf(this);

        while (
            prototype &&
            prototype !== ErrorHandler.prototype &&
            prototype !== Object.prototype
        ) {
            for (const propertyName of Object.getOwnPropertyNames(prototype)) {
                if (propertyName === "constructor" || seenNames.has(propertyName)) {
                    continue;
                }
                seenNames.add(propertyName);

                const descriptor = Object.getOwnPropertyDescriptor(
                    prototype,
                    propertyName
                );

                const method = descriptor?.value as
                    | DecoratedHandler
                    | undefined;

                if (typeof method !== "function") {
                    continue;
                }

                const handledErrors = method[HANDLED_ERRORS];

                if (!handledErrors) {
                    continue;
                }

                const boundHandler = method.bind(this) as ErrorHandlerMethod;

                for (const errorType of handledErrors) {
                    if (handlers.has(errorType)) {
                        throw new Error(
                            `An error handler for "${errorType.name}" is already registered.`
                        );
                    }

                    handlers.set(errorType, boundHandler);
                }
            }

            prototype = Object.getPrototypeOf(prototype);
        }

        return handlers;
    }

    async handle(error: Error): Promise<boolean> {
        let currentError: Error | null = error;

        while (currentError) {
            let errorType: Function | null =
                currentError.constructor;

            while (
                errorType &&
                errorType !== Function.prototype
            ) {
                const handler =
                    this._handlerMethods.get(
                        errorType as ErrorConstructor,
                    );

                if (handler) {
                    await handler(currentError);
                    return true;
                }

                errorType = Object.getPrototypeOf(errorType);
            }

            currentError =
                currentError.cause instanceof Error
                    ? currentError.cause
                    : null;
        }

        return false;
    }

    get app(): TApp{
        return this._app;
    }
}
