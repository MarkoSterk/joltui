import { CustomElement, component, html, page, queryParam, lazy } from "joltui";
import type FieldnotesApp from "../app.js";
import AuthLayout from "../layouts/authLayout.js";
import type { DemoUser } from "../types.js";

@page({ path: "/login", title: "Sign in — Fieldnotes", layout: AuthLayout })
@component({ tagName: "login-page" })
export default class LoginPage extends CustomElement<FieldnotesApp> {

    @queryParam("target", "/profile")
    accessor target!: string;

    static override readonly dependencies = [lazy(() => import("../components/loginForm.js"))] as const;

    override markup = () => html`
        <section class="login-panel">
            <div class="login-copy">
                <span class="eyebrow">Reader account</span>
                <h1>Welcome back.</h1>
                <p>Sign in to view your profile and continue your saved drafts.</p>
            </div>

            <login-form class="login-form" data-caller-id="${this.hashId}"></login-form>

            <p class="login-note"><i class="fa-solid fa-circle-info"></i> This is a demo login. No credentials are sent or stored.</p>
        </section>
    `;

    login = async (event: Event): Promise<void> => {
        event.preventDefault();
        const form = event.currentTarget as HTMLFormElement;
        const data = new FormData(form);
        const email = String(data.get("email") ?? "reader@fieldnotes.test");
        const user: DemoUser = {
            name: "Andrej Novak",
            email,
            role: "READER",
            initials: "AN",
        };
        this.app.setData("user", user);
        await this.app.router.redirect(this.target);
    };
}
