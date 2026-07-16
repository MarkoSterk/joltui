import App from "./app.js";
const HANDLED_ERRORS = Symbol("handledErrors");
export function handles(...errorTypes) {
    if (errorTypes.length === 0) {
        throw new Error("@handles requires at least one Error class.");
    }
    return (_target, _propertyKey, descriptor) => {
        const method = descriptor.value;
        if (typeof method !== "function") {
            throw new TypeError("@handles can only decorate methods.");
        }
        method[HANDLED_ERRORS] = errorTypes;
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
        const handlers = {};
        let prototype = Object.getPrototypeOf(this);
        while (prototype &&
            prototype !== ErrorHandler.prototype &&
            prototype !== Object.prototype) {
            for (const propertyName of Object.getOwnPropertyNames(prototype)) {
                if (propertyName === "constructor") {
                    continue;
                }
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
                    if (handlers[errorType.name]) {
                        throw new Error(`An error handler for "${errorType.name}" is already registered.`);
                    }
                    handlers[errorType.name] = boundHandler;
                }
            }
            prototype = Object.getPrototypeOf(prototype);
        }
        return handlers;
    }
    async handle(error) {
        let errorType = error.constructor;
        while (errorType && errorType !== Object) {
            const handler = this._handlerMethods[errorType.name];
            if (handler) {
                await handler(error);
                return true;
            }
            errorType = Object.getPrototypeOf(errorType);
        }
        return false;
    }
}
//# sourceMappingURL=errorHandler.js.map