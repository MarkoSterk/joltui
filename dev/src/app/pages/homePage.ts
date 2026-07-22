import {
    CustomElement,
    component,
    html,
    page,
} from "joltui";
import type FieldnotesApp from "../app.js";
import type { BlogPost } from "../types.js";

@page({ path: "/", title: "ecris.frontend.pages.stories" })
@component({ tagName: "home-page" })
export default class HomePage extends CustomElement<FieldnotesApp> {
    get posts(): readonly BlogPost[] {
        return this.app.getData<readonly BlogPost[]>("posts");
    }

    get filteredPosts(): readonly BlogPost[] {
        const category = this.app.queryParameters.category;
        const search = this.app.queryParameters.search?.toLowerCase().trim();

        return this.posts.filter(post => {
            const categoryMatches = !category || category === "All" || post.category === category;
            const searchMatches = !search || `${post.title} ${post.excerpt} ${post.category}`.toLowerCase().includes(search);
            return categoryMatches && searchMatches;
        });
    }

    override markup = () => html`
        <section class="hero-section">
            <div class="container-xl">
                <div class="hero-grid">
                    <div class="hero-copy">
                        <span class="eyebrow"><i class="fa-solid fa-sparkles me-2"></i>Independent ideas, carefully made</span>
                        <h1>Stories for people who notice the details.</h1>
                        <p>Fieldnotes is a journal about thoughtful technology, meaningful work, and the small practices that make everyday life richer.</p>
                        <a class="text-link" href="#latest">Explore the latest <i class="fa-solid fa-arrow-down-long"></i></a>
                    </div>
                    <div class="hero-art" aria-hidden="true">
                        <div class="hero-orbit orbit-one"></div>
                        <div class="hero-orbit orbit-two"></div>
                        <div class="hero-card-note">
                            <i class="fa-solid fa-quote-left"></i>
                            <span>Attention is the beginning of care.</span>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <section class="featured-section">
            <div class="container-xl">
                {{ const featured = this.posts.find(post => post.featured); }}
                <a class="featured-story" href="/posts/{{= featured.id }}">
                    <div class="post-cover {{= featured.coverClass }} featured-cover">
                        <i class="fa-solid {{= featured.icon }}"></i>
                        <span class="cover-number">01</span>
                    </div>
                    <div class="featured-copy">
                        <span class="story-kicker">Featured story · {{= featured.category }}</span>
                        <h2>{{= featured.title }}</h2>
                        <p>{{= featured.excerpt }}</p>
                        <div class="story-meta">
                            <span class="avatar">{{= featured.authorInitials }}</span>
                            <span><strong>{{= featured.author }}</strong><small>{{= featured.publishedAt }} · {{= featured.readTime }}</small></span>
                        </div>
                    </div>
                </a>
            </div>
        </section>

        <section class="stories-section" id="latest">
            <div class="container-xl">
                <div class="section-heading">
                    <div>
                        <span class="eyebrow">From the journal</span>
                        <h2>Latest stories</h2>
                    </div>
                    <form class="story-search" @submit="searchStories">
                        <label class="visually-hidden" for="storySearch">Search stories</label>
                        <i class="fa-solid fa-magnifying-glass"></i>
                        <input id="storySearch" name="search" type="search" placeholder="Search the journal" value="{{= this.app.queryParameters.search ?? '' }}">
                    </form>
                </div>

                <div class="category-bar" aria-label="Filter by category">
                    {{~ ["All", "Work", "Technology", "Design", "Craft", "Life"] :category }}
                        <button class="category-pill {{= (this.app.queryParameters.category ?? 'All') === category ? 'active' : '' }}" type="button" data-category="{{= category }}" @click="filterCategory">{{= category }}</button>
                    {{~}}
                </div>

                <div data-bind="query.category">
                    <div data-bind="query.search">
                        {{? this.filteredPosts.length }}
                            <div class="post-grid">
                                {{~ this.filteredPosts :post:index }}
                                    <article class="post-card">
                                        <a class="post-cover {{= post.coverClass }}" href="/posts/{{= post.id }}" aria-label="Read {{= post.title }}">
                                            <i class="fa-solid {{= post.icon }}"></i>
                                            <span class="cover-number">0{{= index + 1 }}</span>
                                        </a>
                                        <div class="post-card-body">
                                            <span class="story-kicker">{{= post.category }}</span>
                                            <h3><a href="/posts/{{= post.id }}">{{= post.title }}</a></h3>
                                            <p>{{= post.excerpt }}</p>
                                            <div class="post-card-meta">
                                                <span>{{= post.publishedAt }}</span>
                                                <span>{{= post.readTime }}</span>
                                            </div>
                                        </div>
                                    </article>
                                {{~}}
                            </div>
                        {{??}}
                            <div class="empty-state">
                                <i class="fa-regular fa-compass"></i>
                                <h3>No stories found</h3>
                                <p>Try a different category or search phrase.</p>
                                <button type="button" class="btn btn-ink" @click="clearFilters">Clear filters</button>
                            </div>
                        {{?}}
                    </div>
                </div>
            </div>
        </section>

        <section class="newsletter-section">
            <div class="container-xl">
                <div class="newsletter-card">
                    <div>
                        <span class="eyebrow">A considered inbox</span>
                        <h2>One thoughtful note, every Sunday.</h2>
                        <p>No noise, no growth hacks. Just our best story and a few things worth noticing.</p>
                    </div>
                    <form class="newsletter-form" @submit="subscribe">
                        <label class="visually-hidden" for="newsletterEmail">Email address</label>
                        <input id="newsletterEmail" type="email" required placeholder="you@example.com">
                        <button type="submit" class="btn btn-light">Join the list</button>
                    </form>
                </div>
            </div>
        </section>
    `;

    filterCategory = (
        event: Event,
    ): void => {
        const button = event.currentTarget as HTMLButtonElement;
        this.app.updateQueryParameters({
            category: button.dataset.category === "All" ? null : button.dataset.category ?? null,
        });
        void this.rerender();
    };

    searchStories = (event: Event): void => {
        event.preventDefault();
        const form = event.currentTarget as HTMLFormElement;
        const data = new FormData(form);
        const search = String(data.get("search") ?? "").trim();
        this.app.updateQueryParameters({ search: search || null });
        void this.rerender();
    };

    clearFilters = (): void => {
        this.app.updateQueryParameters({ category: null, search: null });
        void this.rerender();
    };

    subscribe = (event: Event): void => {
        event.preventDefault();
        const form = event.currentTarget as HTMLFormElement;
        const button = form.querySelector("button");
        if (button) {
            button.textContent = "You're on the list!";
            button.setAttribute("disabled", "");
        }
    };
}
