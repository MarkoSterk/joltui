import App from "./app.js";
const HANDLED_ERRORS = Symbol("handledErrors");
export function handles(...errorTypes) {
    if (errorTypes.length === 0) {
        throw new Error("@handles requires at least one Error class.");
    }
    return function handlesDecorator(method, context) {
        if (context.static) {
            throw new TypeError("@handles cannot decorate static methods.");
        }
        if (context.private) {
            throw new TypeError("@handles cannot decorate private methods.");
        }
        const decoratedMethod = method;
        decoratedMethod[HANDLED_ERRORS] = [
            ...errorTypes,
        ];
    };
}
export default class ErrorHandler {
    _app;
    _handlerMethods;
    constructor(app) {
        this._app = app;
        this._handlerMethods = this._generateHandlerMethodsMapping();
    }
    _generateHandlerMethodsMapping() {
        const handlers = new Map();
        const seenNames = new Set();
        let prototype = Object.getPrototypeOf(this);
        while (prototype &&
            prototype !== ErrorHandler.prototype &&
            prototype !== Object.prototype) {
            for (const propertyName of Object.getOwnPropertyNames(prototype)) {
                if (propertyName === "constructor" || seenNames.has(propertyName)) {
                    continue;
                }
                seenNames.add(propertyName);
                const descriptor = Object.getOwnPropertyDescriptor(prototype, propertyName);
                const method = descriptor?.value;
                if (typeof method !== "function") {
                    continue;
                }
                const handledErrors = method[HANDLED_ERRORS];
                if (!handledErrors) {
                    continue;
                }
                const boundHandler = method.bind(this);
                for (const errorType of handledErrors) {
                    if (handlers.has(errorType)) {
                        throw new Error(`An error handler for "${errorType.name}" is already registered.`);
                    }
                    handlers.set(errorType, boundHandler);
                }
            }
            prototype = Object.getPrototypeOf(prototype);
        }
        return handlers;
    }
    async handle(error) {
        let currentError = error;
        while (currentError) {
            let errorType = currentError.constructor;
            while (errorType &&
                errorType !== Function.prototype) {
                const handler = this._handlerMethods.get(errorType);
                if (handler) {
                    await handler(currentError);
                    return true;
                }
                errorType = Object.getPrototypeOf(errorType);
            }
            for (const [handledType, handler] of this._handlerMethods) {
                if (currentError instanceof handledType) {
                    await handler(currentError);
                    return true;
                }
            }
            currentError =
                currentError.cause instanceof Error
                    ? currentError.cause
                    : null;
        }
        return false;
    }
    get app() {
        return this._app;
    }
}
//# sourceMappingURL=errorHandler.js.map