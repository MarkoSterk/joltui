import {
    CustomElement,
    html,
    page,
    component,
    react,
    select,
    queryParam
} from "joltui";

import type DevApp from "./app.js";

@page("/")
@component({tagName: "home-page"})
export default class HomePage
    extends CustomElement<DevApp> {

    @react(0)
    accessor count!: number;

    @select<HTMLHeadingElement>("h1")
    accessor heading!: HTMLHeadingElement|null;

    @queryParam("page", "1")
    accessor page!: string;

    override markup = () => html`
        <section>
            <h1>JoltUI development</h1>

            <p data-bind="count">
                Count: {{=this.count}}
            </p>

            <button id="increment" data-jolt-something="bla bla" jolt-click="increment" type="button">
                Increment
            </button>
        </section>
    `;

    increment = (e: PointerEvent, args: Record<string, string>): void => {
        console.log(this.heading)
        console.log(e, args)
        this.count++;
    };
}