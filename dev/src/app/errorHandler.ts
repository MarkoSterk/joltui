import {
    AuthenticationError,
    ErrorHandler,
    RouteNotFoundError,
    handles,
} from "joltui";
import type FieldnotesApp from "./app.js";

export default class BlogErrorHandler extends ErrorHandler<FieldnotesApp> {
    @handles(AuthenticationError)
    async authenticationError(): Promise<void> {
        await this.app.router.redirect("/login");
    }

    @handles(RouteNotFoundError)
    async routeNotFound(): Promise<void> {
        await this.app.router.redirect("/404");
    }
}
