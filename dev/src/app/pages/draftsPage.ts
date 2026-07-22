import { CustomElement, auth, component, html, page } from "joltui";
import type FieldnotesApp from "../app.js";

@auth(["Admin"])
@page({ path: "/drafts", title: "Your drafts — Fieldnotes" })
@component({ tagName: "drafts-page" })
export default class DraftsPage extends CustomElement<FieldnotesApp> {
    override markup = () => html`
        <section class="drafts-page">
            <div class="container-xl">
                <div class="page-heading-row">
                    <div><span class="eyebrow">Private workspace</span><h1>Your drafts</h1><p>A quiet place for unfinished thinking.</p></div>
                    <button class="btn btn-ink" type="button" @click="newDraft"><i class="fa-solid fa-plus me-2"></i>New draft</button>
                </div>

                <div class="draft-list" id="draftList">
                    <article class="draft-row"><span class="draft-icon"><i class="fa-regular fa-file-lines"></i></span><div><span class="story-kicker">Essay · Edited yesterday</span><h2>The case for a slower inbox</h2><p>Opening note and three fragments</p></div><span class="draft-status">In progress</span></article>
                    <article class="draft-row"><span class="draft-icon"><i class="fa-regular fa-file-lines"></i></span><div><span class="story-kicker">Field note · Edited July 12</span><h2>Things learned from repairing a chair</h2><p>Six observations, rough ending</p></div><span class="draft-status">In progress</span></article>
                </div>
            </div>
        </section>
    `;

    newDraft = (): void => {
        const list = this.querySelector("#draftList");
        list?.insertAdjacentHTML("afterbegin", html`
            <article class="draft-row new-draft">
                <span class="draft-icon"><i class="fa-regular fa-file-lines"></i></span>
                <div><span class="story-kicker">New draft · Just now</span><h2>Untitled fieldnote</h2><p>Start writing when the thought is ready.</p></div>
                <span class="draft-status">New</span>
            </article>
        `);
    };
}
