import { CustomElement, component, html, page, queryParam } from "joltui";
import type FieldnotesApp from "../app.js";
import AuthLayout from "../layouts/authLayout.js";
import type { DemoUser } from "../types.js";

@page({ path: "/login", title: "Sign in — Fieldnotes", layout: AuthLayout })
@component({ tagName: "login-page" })
export default class LoginPage extends CustomElement<FieldnotesApp> {

    // @queryParam("target", "/profile")
    // accessor target!: string;

    target: string = "/profile"

    override markup = () => html`
        <section class="login-panel">
            <div class="login-copy">
                <span class="eyebrow">Reader account</span>
                <h1>Welcome back.</h1>
                <p>Sign in to view your profile and continue your saved drafts.</p>
            </div>

            <form class="login-form" @submit="login">
                <div>
                    <label class="form-label" for="email">Email address</label>
                    <input class="form-control" id="email" name="email" type="email" value="reader@fieldnotes.test" required autocomplete="email">
                </div>
                <div>
                    <div class="d-flex justify-content-between">
                        <label class="form-label" for="password">Password</label>
                        <span class="field-hint">Any password works</span>
                    </div>
                    <input class="form-control" id="password" name="password" type="password" value="fieldnotes" required autocomplete="current-password">
                </div>
                <div class="form-check">
                    <input class="form-check-input" id="remember" type="checkbox" checked>
                    <label class="form-check-label" for="remember">Keep me signed in</label>
                </div>
                <button class="btn btn-ink btn-lg w-100" type="submit">Sign in <i class="fa-solid fa-arrow-right-long ms-2"></i></button>
            </form>

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
