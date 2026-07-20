import {
    CustomElement,
    html,
    layout,
    component
} from "joltui";

import type DevApp from "../app.js";

@layout
@component({tagName: "dev-layout"})
export default class DevLayout
    extends CustomElement<DevApp> {

    override markup = () => html`
        <header>
            <nav>
                <a href="/">Home</a>
                <a href="/second/34">Second page></a>
                <a role="button" jolt-click="logoutMethod">Logout></a>
            </nav>
        </header>

        <main id="page"></main>
    `;

    async logoutMethod(){
        //perform logout logic
        this.app.setData("user", null);
        await this.app.router.redirect("/login");
    }
}