import {
    CustomElement,
    html,
    page,
    component,
    lifecycle,
    Lifecycle
} from "joltui";

import type DevApp from "./app.js";

@page("/second/<int:counterNumber>")
@component({tagName: "second-page"})
export default class SecondPage
    extends CustomElement<DevApp> {

    override markup = () => html`
        <section>
            <h1>Second page</h1>
            <p>{{= this.app.router.routeParameters.counterNumber || 0 }}</p>
        </section>
    `;

    @lifecycle(Lifecycle.BEFORE_INIT)
    async beforeSetup(){
        console.log("Hello, from SecondPage before init.")
    }

    @lifecycle(Lifecycle.AFTER_INIT)
    async afterSetup(){
        console.log("Hello, from SecondPage after init.")
    }
}