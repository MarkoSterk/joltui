import { CustomElement, component, html } from "joltui";
import type FieldnotesApp from "../app";

export type LoginFormCaller = CustomElement<FieldnotesApp> & {
    login: (event: Event) => Promise<void>;
}
    
@component({ tagName: "login-form" })
export default class LoginForm extends CustomElement<FieldnotesApp> {

    override markup = (): string => {
        return html`
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
        `
    }

    async login(event: Event): Promise<void> {
        await this.caller.login(event);
    }

    get caller(): LoginFormCaller{
        return this.app.querySelector(`[data-hash-id="${this.callerId}"]`) as LoginFormCaller;

    }

    get callerId(): string {
        return this.getAttribute("data-caller-id") as string;
    }

}
