import { CustomElement, auth, component, html, page } from "joltui";
import type FieldnotesApp from "../app.js";
import type { DemoUser } from "../types.js";

@auth()
@page({ path: "/profile", title: "Your profile — Fieldnotes" })
@component({ tagName: "profile-page" })
export default class ProfilePage extends CustomElement<FieldnotesApp> {
    get user(): DemoUser {
        return this.app.getData<DemoUser>("user");
    }

    override markup = () => html`
        <section class="profile-page">
            <div class="container-xl">
                <div class="profile-header">
                    <div class="profile-avatar">{{= this.user.initials }}</div>
                    <div>
                        <span class="eyebrow">Reader profile</span>
                        <h1>{{= this.user.name }}</h1>
                        <p>{{= this.user.email }}</p>
                    </div>
                    <button class="btn btn-outline-ink ms-lg-auto" type="button" @click="logout"><i class="fa-solid fa-arrow-right-from-bracket me-2"></i>Sign out</button>
                </div>

                <div class="profile-grid">
                    <article class="profile-card profile-card-wide">
                        <span class="story-kicker">Reading rhythm</span>
                        <h2>Your week in Fieldnotes</h2>
                        <div class="reading-stats">
                            <div><strong>4</strong><span>Stories read</span></div>
                            <div><strong>28m</strong><span>Time reading</span></div>
                            <div><strong>3</strong><span>Notes saved</span></div>
                        </div>
                    </article>
                    <article class="profile-card">
                        <i class="fa-regular fa-bookmark card-icon"></i>
                        <span class="story-kicker">Saved for later</span>
                        <h2>Small tools, durable habits</h2>
                        <a class="text-link" href="/posts/2">Continue reading <i class="fa-solid fa-arrow-right-long"></i></a>
                    </article>
                    <article class="profile-card profile-accent">
                        <i class="fa-regular fa-pen-to-square card-icon"></i>
                        <span class="story-kicker">Your writing</span>
                        <h2>Two ideas are waiting.</h2>
                        <a class="text-link" href="/drafts">Open drafts <i class="fa-solid fa-arrow-right-long"></i></a>
                    </article>
                </div>
            </div>
        </section>
    `;

    logout = async (): Promise<void> => {
        this.app.setData("user", null);
        await this.app.router.redirect("/");
    };
}
