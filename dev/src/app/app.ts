import {
    App,
    Lifecycle,
    lifecycle,
    type CustomElementClass,
    type ErrorHandlerClass,
} from "joltui";

import DevErrorHandler from "./errorHandler.js";
import Elements from "./elements.js"
import DevRouter from "./router.js";
import DevLayout from "./layouts/layout.js";

export default class DevApp extends App {
    override readonly elements: readonly CustomElementClass<DevApp>[] = Elements;
    
    override readonly errorHandlers: readonly ErrorHandlerClass<DevApp>[] = [
        DevErrorHandler
    ]

    protected override routerGenerator() {
        return new DevRouter({app: this, baseLayout: DevLayout, defaultTarget: "#page"});
    }

    @lifecycle(Lifecycle.BEFORE_INIT)
    protected beforeInitialization(): void {
        console.log("Dev application initialization started.");
        console.log("Fetching user...")
        console.log("User not authenticated...")
        // this.setData("user", {
        //     email: "marko.sterk@izum.si",
        //     roles: ["ADMIN", "SUPERUSER"]
        // })
    }

    @lifecycle(Lifecycle.AFTER_INIT)
    protected afterInitialization(): void {
        console.log("Dev application initialized.");
    }

    @lifecycle(Lifecycle.AFTER_INIT)
    protected afterInitializationTwo(): void {
        console.log("Second after init...");
    }
}
