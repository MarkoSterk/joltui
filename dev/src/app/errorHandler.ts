import {
    AuthenticationError,
    AuthorizationError,
    ErrorHandler,
    RouteNotFoundError,
    handles,
} from "joltui";
import type FieldnotesApp from "./app.js";

export default class BlogErrorHandler extends ErrorHandler<FieldnotesApp> {
    @handles(AuthenticationError)
    async authenticationError(error: AuthenticationError): Promise<void> {
        console.log("Authentication error. Redirecting to /login")
        //await this.app.router.redirect("/login");
        await this.app.router.redirect(`/login?target=${error.path}`);
    }

    @handles(RouteNotFoundError)
    async routeNotFound(): Promise<void> {
        await this.app.router.redirect("/404");
    }
}
