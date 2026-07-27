import { component, CustomElement, page } from "joltui";
import type FieldnotesApp from "../app";

@page("/something/specific")
@component({tagName: "more-specific-page"})
export default class MoreSpecificPage extends CustomElement<FieldnotesApp>{
    override markup = () => {
        return `
            <h2>Specific</h2>
        `
    }
}
