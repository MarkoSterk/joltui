import App from "./app.js";
import type { CustomElementClass } from "./customElement.js";
import {
    setPageAuthenticationMetadata,
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

        setPageAuthenticationMetadata(
            elementClass,
            {
                authenticationRequired: true,
                rolesRequired: requiredRoles,
            },
        );
    };
}

export class AuthenticationError extends Error {}
export class AuthorizationError extends Error {}
