import {
    CustomElement,
    component,
    html,
    layout,
} from "joltui";
import type FieldnotesApp from "../app.js";

@layout
@component({ tagName: "auth-layout" })
export default class AuthLayout extends CustomElement<FieldnotesApp> {
    override markup = () => html`
        <main class="auth-shell">
            <a class="brand-lockup auth-brand" href="/">
                <span class="brand-mark">F</span>
                <span>Fieldnotes</span>
            </a>
            <div id="page-content"></div>
            <p class="auth-footnote">A JoltUI demo · No real account required</p>
        </main>
    `;
}
