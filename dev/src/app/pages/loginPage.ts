import {
    CustomElement,
    component,
    html,
    page,
} from "joltui";

import LoginLayout from "../layouts/loginLayout.js";
import type DevApp from "../app.js";

@page({
    path: "/login",
    title: "Sign in",
    layout: LoginLayout
})
@component({ tagName: "login-page", useServer: true })
export default class LoginPage
    extends CustomElement<DevApp> {

    override markup = () => html`
        <section
            class="container-fluid d-flex align-items-center justify-content-center py-4 py-md-5"
            style="min-height: calc(100vh - 8rem);"
        >
            <div class="row justify-content-center w-100">
                <div class="col-12 col-sm-10 col-md-8 col-lg-6 col-xl-5">
                    <div class="card border-0 shadow-sm">
                        <div class="card-body p-4 p-md-5">
                            <div class="text-center mb-4">
                                <h1 class="h3 mb-2">Welcome back</h1>
                                <p class="text-body-secondary mb-0">
                                    Sign in to continue to JoltUI.
                                </p>
                            </div>

                            <form>
                                <div class="mb-3">
                                    <label
                                        class="form-label"
                                        for="email"
                                    >
                                        Email address
                                    </label>
                                    <input
                                        class="form-control"
                                        id="email"
                                        name="email"
                                        type="email"
                                        autocomplete="email"
                                        placeholder="name@example.com"
                                        required
                                    >
                                </div>

                                <div class="mb-3">
                                    <div class="d-flex justify-content-between align-items-center">
                                        <label
                                            class="form-label"
                                            for="password"
                                        >
                                            Password
                                        </label>
                                        <a
                                            class="small text-decoration-none"
                                            href="/forgot-password"
                                        >
                                            Forgot password?
                                        </a>
                                    </div>
                                    <input
                                        class="form-control"
                                        id="password"
                                        name="password"
                                        type="password"
                                        autocomplete="current-password"
                                        required
                                    >
                                </div>

                                <div class="form-check mb-4">
                                    <input
                                        class="form-check-input"
                                        id="remember-me"
                                        name="rememberMe"
                                        type="checkbox"
                                    >
                                    <label
                                        class="form-check-label"
                                        for="remember-me"
                                    >
                                        Remember me
                                    </label>
                                </div>

                                <button
                                    class="btn btn-primary w-100"
                                    type="button"
                                    jolt-click="loginMethod"
                                >
                                    Sign in
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    `;

    async loginMethod(){
        //check login credentials
        //login logic
        //gets returned user is valid credentials
        this.setData("user", {
            email: "marko.sterk@izum.si",
            roles: ["ADMIN", "SUPERUSER"]
        })
        this.app.router.redirect("/")
    }
}
