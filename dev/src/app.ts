import {
    App,
    Lifecycle,
    lifecycle,
    type CustomElementClass,
} from "joltui";

import DevLayout from "./layout.js";
import HomePage from "./homePage.js";
import DevRouter from "./router.js";
import SecondPage from "./secondPage.js";

export default class DevApp extends App {
    override readonly elements:
        readonly CustomElementClass<DevApp>[] = [
            DevLayout,
            HomePage,
            SecondPage
        ];

    protected override routerGenerator() {
        return new DevRouter({app: this, baseLayout: DevLayout, defaultTarget: "#page"});
    }

    @lifecycle(Lifecycle.BEFORE_INIT)
    protected beforeInitialization(): void {
        console.log("Dev application initialization started.");
    }

    @lifecycle(Lifecycle.AFTER_INIT)
    protected afterInitialization(): void {
        console.log("Dev application initialized.");
    }
}