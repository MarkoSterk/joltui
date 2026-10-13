import type { CustomElementClass } from "./customElement.js";
import {
    setElementAuthenticationMetadata,
} from "./elementMetadata.js";

export function auth(
    roles: readonly unknown[] = [],
) {
    if (!Array.isArray(roles)) {
        throw new TypeError(
            "@auth roles must be an array.",
        );
    }

    const requiredRoles = [...roles];

    return function authDecorator<
        TClass extends CustomElementClass,
    >(
        elementClass: TClass,
        context: ClassDecoratorContext<TClass>,
    ): void {
        if (context.kind !== "class") {
            throw new TypeError(
                "@auth can only decorate classes.",
            );
        }

        setElementAuthenticationMetadata(
            elementClass,
            {
                authenticationRequired: true,
                rolesRequired: requiredRoles,
            },
        );
    };
}

export class AuthenticationError extends Error {
    readonly path: string;

    constructor(
        path: string,
        options?: ErrorOptions,
    ) {
        super("User not authenticated", options);
        this.path = path;
        this.name = "AuthenticationError";
    }
}

export class AuthorizationError extends Error {
    readonly path: string;
    readonly roles: unknown[];

    constructor(
        path: string,
        roles: unknown[],
        options?: ErrorOptions,
    ) {
        super("User is not authorized for this route", options);
        this.path = path;
        this.roles = roles;
        this.name = "AuthorizationError";
    }
}
