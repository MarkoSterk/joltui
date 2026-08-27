import {
    App,
    lifecycle,
    Lifecycle,
    type AppConfig,
    type ErrorHandlerClass,
} from "joltui";
import BlogErrorHandler from "./errorHandler.js";
import AppLayout from "./layouts/appLayout.js";
import Pages from "./pages.js";
import BlogRouter from "./router.js";

export default class FieldnotesApp extends App<FieldnotesApp> {
    override readonly errorHandlers:
        readonly ErrorHandlerClass<FieldnotesApp>[] = [
            BlogErrorHandler,
        ];

    constructor(config: AppConfig<FieldnotesApp>) {
        super(config);
    }

    protected override routerGenerator(): BlogRouter {
        return new BlogRouter({
            app: this,
            pages: Pages,
            baseLayout: AppLayout,
            defaultTarget: "#page-content",
        });
    }

    @lifecycle(Lifecycle.BEFORE_INIT)
    async setupFuntion(){
        console.log("Before init")
        //fetch request
    }
    @lifecycle(Lifecycle.EXTENSION_INIT)
    async extensions(){

    }
}
