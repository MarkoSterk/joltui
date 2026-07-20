import {
    CustomElement,
    auth,
    component,
    html,
    page,
} from "joltui";

import type DevApp from "../app.js";

@auth()
@page({
    path: "/403-forbidden",
    title: "Access forbidden"
})
@component({ tagName: "forbidden-error-page" })
export default class ForbiddenErrorPage
    extends CustomElement<DevApp> {

    override markup = () => html`
        <section
            class="container-fluid d-flex align-items-center justify-content-center min-vh-100 py-4"
        >
            <div class="row justify-content-center w-100">
                <div class="col-12 col-sm-10 col-md-8 col-lg-6 col-xl-5">
                    <div class="card border-0 shadow-sm text-center">
                        <div class="card-body p-4 p-md-5">
                            <div
                                class="d-inline-flex align-items-center justify-content-center rounded-circle bg-danger-subtle text-danger mb-4"
                                style="width: 4rem; height: 4rem;"
                                aria-hidden="true"
                            >
                                <span class="fs-2 fw-bold">!</span>
                            </div>

                            <p class="text-danger fw-semibold mb-2">
                                Error 403
                            </p>
                            <h1 class="h2 mb-3">Access forbidden</h1>
                            <p class="text-body-secondary mb-4">
                                You are signed in, but you do not have permission
                                to access this page.
                            </p>

                            <div class="d-grid gap-2 d-sm-flex justify-content-sm-center">
                                <a class="btn btn-primary" href="/">
                                    Return home
                                </a>
                                <button
                                    class="btn btn-outline-secondary"
                                    type="button"
                                    jolt-click="goBack"
                                >
                                    Go back
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    `;

    goBack(): void {
        history.back();
    }
}
