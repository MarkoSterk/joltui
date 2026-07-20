import { CustomElement, component, html, react } from "joltui";

import type DevApp from "../app.js";

@component({tagName: "counter-button"})
export default class CounterButton extends CustomElement<DevApp>{

    @react(0)
    accessor currentCount!: number;

    markup = (): string => {
        return html`
            <div>
                <p data-bind="currentCount">Count: {{= this.currentCount }}</p>
                <button type="button" class="btn btn-primary m-1 p-2" jolt-click="count">Click to count</button>
            </div>
        `
    }

    async count(){
        this.currentCount++;
    }

}