import {
    CustomElement,
    html,
    page,
    component,
    react,
    select,
    queryParam,
    auth
} from "joltui";

import type DevApp from "../app.js";

@auth()
@page("/")
@component({tagName: "home-page"})
export default class HomePage
    extends CustomElement<DevApp> {

    override markup = () => html`
        <section>
            <h1>JoltUI development</h1>

            <p data-bind="app.appCount">
                Count: {{=this.app.data.get("appCount")}}
            </p>

            <button id="increment" data-jolt-something="bla bla" jolt-click="increment" type="button">
                Increment
            </button>
        </section>
    `;

    increment = (e: PointerEvent, args: Record<string, string>): void => {
        const currentCount = this.app.getData<number>("appCount");
        console.log("Current count: ", currentCount)
        this.app.setData("appCount", currentCount + 1);
    };
}