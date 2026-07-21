import {
    App,
    type AppConfig,
    type CustomElementClass,
    type ErrorHandlerClass,
} from "joltui";
import Elements from "./elements.js";
import BlogErrorHandler from "./errorHandler.js";
import AppLayout from "./layouts/appLayout.js";
import BlogRouter from "./router.js";

export default class FieldnotesApp extends App<FieldnotesApp> {
    override readonly elements:
        readonly CustomElementClass<FieldnotesApp>[] = Elements;

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
            baseLayout: AppLayout,
            defaultTarget: "#page-content",
        });
    }
}
