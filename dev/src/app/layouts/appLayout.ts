import {
    CustomElement,
    component,
    html,
    layout,
} from "joltui";
import type FieldnotesApp from "../app.js";
import type { DemoUser } from "../types.js";

@layout
@component({ tagName: "app-layout" })
export default class AppLayout extends CustomElement<FieldnotesApp> {
    override markup = () => html`
        <div class="site-shell">
            <header class="site-header sticky-top">
                <nav class="navbar navbar-expand-lg" aria-label="Main navigation">
                    <div class="container-xl">
                        <a class="navbar-brand brand-lockup" href="/" aria-label="Fieldnotes home">
                            <span class="brand-mark">F</span>
                            <span>Fieldnotes</span>
                        </a>

                        <button class="navbar-toggler border-0 shadow-none" type="button" data-bs-toggle="collapse" data-bs-target="#mainNavigation" aria-controls="mainNavigation" aria-expanded="false" aria-label="Toggle navigation">
                            <i class="fa-solid fa-bars"></i>
                        </button>

                        <div class="collapse navbar-collapse" id="mainNavigation">
                            <ul class="navbar-nav mx-auto gap-lg-2">
                                <li class="nav-item"><a class="nav-link" href="/">Stories</a></li>
                                <li class="nav-item"><a class="nav-link" href="/about">About</a></li>
                                <li class="nav-item"><a class="nav-link" href="/drafts">Drafts</a></li>
                                <li class="nav-item"><a class="nav-link" href="/something/specific">Specific</a></li>
                                <li class="nav-item"><a class="nav-link" href="/something/fuu">Fuu</a></li>
                                <li class="nav-item"><a class="nav-link" href="/something/bar">Bar</a></li>
                            </ul>

                            <div class="navbar-actions" data-bind="app.user">
                                {{? this.app.getData("user") }}
                                    <a class="btn btn-ink btn-sm" href="/profile">
                                        <i class="fa-regular fa-user me-2"></i>Profile
                                    </a>
                                {{??}}
                                    <a class="btn btn-outline-ink btn-sm" href="/login">Sign in</a>
                                {{?}}
                            </div>
                        </div>
                    </div>
                </nav>
            </header>

            <main id="page-content"></main>

            <footer class="site-footer">
                <div class="container-xl">
                    <div class="footer-grid">
                        <div>
                            <a class="brand-lockup footer-brand" href="/">
                                <span class="brand-mark">F</span>
                                <span>Fieldnotes</span>
                            </a>
                            <p class="footer-copy">Ideas for thoughtful work, useful technology, and a life paid close attention.</p>
                        </div>
                        <div class="footer-links">
                            <a href="/">Stories</a>
                            <a href="/about">About</a>
                            <a href="/profile">Profile</a>
                        </div>
                        <div class="footer-social" aria-label="Social links">
                            <a href="https://github.com" target="_blank" rel="noreferrer" aria-label="GitHub"><i class="fa-brands fa-github"></i></a>
                            <a href="https://linkedin.com" target="_blank" rel="noreferrer" aria-label="LinkedIn"><i class="fa-brands fa-linkedin-in"></i></a>
                            <a href="mailto:hello@fieldnotes.test" aria-label="Email"><i class="fa-regular fa-envelope"></i></a>
                        </div>
                    </div>
                    <div class="footer-bottom">Built with JoltUI · A client-side demo publication</div>
                </div>
            </footer>
        </div>
    `;

    logout = async (): Promise<void> => {
        this.app.setData("user", null as DemoUser | null);
        await this.app.router.redirect("/");
    };
}
