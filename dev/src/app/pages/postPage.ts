import {
    CustomElement,
    component,
    html,
    page,
} from "joltui";
import type FieldnotesApp from "../app.js";
import type { BlogPost } from "../types.js";

@page({ path: "/posts/<int:postId>", title: "Story — Fieldnotes" })
@component({ tagName: "post-page", cache: true, cacheDuration: 120 })
export default class PostPage extends CustomElement<FieldnotesApp> {
    get post(): BlogPost | undefined {
        const id = Number(this.app.router.routeParameters.postId);
        return this.app.getData<readonly BlogPost[]>("posts").find(post => post.id === id);
    }

    override markup = () => html`
        {{? this.post }}
            <article class="article-page">
                <header class="article-header">
                    <div class="container article-container text-center">
                        <a class="back-link" href="/"><i class="fa-solid fa-arrow-left-long"></i> All stories</a>
                        <span class="story-kicker">{{= this.post.category }}</span>
                        <h1>{{= this.post.title }}</h1>
                        <p class="article-deck">{{= this.post.excerpt }}</p>
                        <div class="story-meta justify-content-center">
                            <span class="avatar">{{= this.post.authorInitials }}</span>
                            <span class="text-start"><strong>{{= this.post.author }}</strong><small>{{= this.post.publishedAt }} · {{= this.post.readTime }}</small></span>
                        </div>
                    </div>
                </header>

                <div class="container-xl">
                    <div class="post-cover {{= this.post.coverClass }} article-cover">
                        <i class="fa-solid {{= this.post.icon }}"></i>
                        <span class="cover-number">FIELD / {{= String(this.post.id).padStart(2, '0') }}</span>
                    </div>
                </div>

                <div class="container article-container article-body">
                    <p class="article-lede">{{= this.post.content[0] }}</p>
                    <p>{{= this.post.content[1] }}</p>
                    <blockquote>“The shape of our attention becomes the shape of our days.”</blockquote>
                    <p>{{= this.post.content[2] }}</p>

                    <div class="article-divider"><span>✦</span></div>

                    <div class="author-box">
                        <span class="avatar avatar-large">{{= this.post.authorInitials }}</span>
                        <div>
                            <span class="story-kicker">Written by</span>
                            <h3>{{= this.post.author }}</h3>
                            <p>Writer, observer, and contributor to Fieldnotes.</p>
                        </div>
                    </div>
                </div>
            </article>
        {{??}}
            <section class="simple-page text-center">
                <div class="container article-container">
                    <span class="display-icon"><i class="fa-regular fa-file-lines"></i></span>
                    <h1>Story not found</h1>
                    <p>This fieldnote may have moved or never existed.</p>
                    <a class="btn btn-ink" href="/">Return home</a>
                </div>
            </section>
        {{?}}
    `;
}
