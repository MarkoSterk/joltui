import { component, CustomElement, page } from "joltui";
import type FieldnotesApp from "../app";

@page("/<str:pageName>")
@component({tagName: "less-specific-page"})
export default class LessSpecificPage extends CustomElement<FieldnotesApp>{
    override markup = () => {
        return `
            <h2>{{=this.app.router.routeParameters.pageName}}</h2>
        `
    }
}
