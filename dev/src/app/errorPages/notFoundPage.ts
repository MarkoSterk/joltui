import {
    CustomElement,
    component,
    html,
    page,
} from "joltui";
import type FieldnotesApp from "../app.js";

@page({
    path: "/404",
    title: "ecris.frontend.pages.notFound",
})
@component({ tagName: "not-found-page" })
export default class NotFoundPage
    extends CustomElement<FieldnotesApp> {

    override markup = () => html`
        <section class="not-found-page">
            <div class="container-xl">
                <div class="not-found-grid">
                    <div class="not-found-copy">
                        <span class="eyebrow">Error 404</span>
                        <h1>This path ends at the edge of the page.</h1>
                        <p>
                            The fieldnote you were looking for may have moved,
                            or the address may have taken a wrong turn.
                        </p>
                        <div class="not-found-actions">
                            <a class="btn btn-ink" href="/">
                                <i class="fa-solid fa-arrow-left-long me-2"></i>
                                Return to the journal
                            </a>
                            <a class="text-link" href="/about">
                                About Fieldnotes
                                <i class="fa-solid fa-arrow-right-long"></i>
                            </a>
                        </div>
                    </div>

                    <div class="not-found-art" aria-hidden="true">
                        <span class="not-found-number">404</span>
                        <div class="lost-note">
                            <i class="fa-regular fa-map"></i>
                            <span>Nothing was found here.</span>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    `;
}
