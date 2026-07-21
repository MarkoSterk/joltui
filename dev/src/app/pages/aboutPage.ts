import { CustomElement, component, html, page } from "joltui";
import type FieldnotesApp from "../app.js";

@page({ path: "/about", title: "About — Fieldnotes" })
@component({ tagName: "about-page", cache: true, cacheDuration: 300 })
export default class AboutPage extends CustomElement<FieldnotesApp> {
    override markup = () => html`
        <section class="about-hero">
            <div class="container-xl">
                <div class="about-grid">
                    <div>
                        <span class="eyebrow">Why we publish</span>
                        <h1>Make room for ideas that take their time.</h1>
                    </div>
                    <div class="about-intro">
                        <p>Fieldnotes is an independent journal for people building thoughtful things and paying attention along the way.</p>
                        <p>We publish essays about technology, design, work, craft, and the ordinary details that quietly shape a good life.</p>
                    </div>
                </div>
            </div>
        </section>

        <section class="values-section">
            <div class="container-xl">
                <div class="values-grid">
                    <article><span>01</span><i class="fa-regular fa-eye"></i><h2>Notice deeply</h2><p>Interesting work begins with attention. We look closely before reaching for conclusions.</p></article>
                    <article><span>02</span><i class="fa-solid fa-hand-sparkles"></i><h2>Make with care</h2><p>Clear thinking deserves clear expression, generous editing, and respect for the reader's time.</p></article>
                    <article><span>03</span><i class="fa-solid fa-bridge"></i><h2>Stay useful</h2><p>We want every story to leave behind a question, practice, or perspective worth carrying.</p></article>
                </div>
            </div>
        </section>

        <section class="manifesto-section">
            <div class="container article-container text-center">
                <span class="display-icon"><i class="fa-solid fa-feather-pointed"></i></span>
                <h2>Independent by design</h2>
                <p>This is a fictional publication created to demonstrate JoltUI. There are no trackers, paywalls, or growth funnels—just a small client-side application with enough detail to feel real.</p>
                <a class="text-link" href="/">Read the journal <i class="fa-solid fa-arrow-right-long"></i></a>
            </div>
        </section>
    `;
}
