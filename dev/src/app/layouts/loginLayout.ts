import {
    CustomElement,
    html,
    layout,
    component
} from "joltui";

import type DevApp from "../app.js";

@layout
@component({tagName: "login-layout"})
export default class LoginLayout
    extends CustomElement<DevApp> {

    override markup = () => html`
        <main id="page"></main>
    `;
}