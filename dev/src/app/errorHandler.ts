import { ErrorHandler,
    handles,
    AuthenticationError,
    AuthorizationError } from "joltui";

import DevApp from "./app.js";

export default class DevErrorHandler extends ErrorHandler<DevApp>{

    @handles(AuthenticationError)
    async unauthorizedError(error: AuthenticationError): Promise<void>{
        await this.app.router.redirect("/login")
    }

    @handles(AuthorizationError)
    async authorizationError(error: AuthorizationError): Promise<void>{
        //await this.app.router.redirect("/403-forbidden")
        const container: HTMLDivElement = this.app.container.querySelector("#page") as HTMLDivElement;
        if(!container){
            return await this.app.router.redirect("/403-forbidden");
        }
        container.innerHTML = "<forbidden-error-page></forbidden-error-page>";
    }
}

