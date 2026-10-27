# Component communication

JoltUI's preferred way for components to cooperate is the most explicit one: **one component
obtains a reference to another and calls its method.** The call is visible at the call site,
typed, and easy to follow with "go to definition", the same style a Java developer uses when one
object collaborates with another, rather than broadcasting events and hoping someone listens.

## Child to parent

Every component knows the component that rendered it: `this.parent`. Wrap it in a typed getter
and call the parent's methods directly:

```typescript
@component({ tagName: "post-card" })
export default class PostCard extends CustomElement<MyApp> {
    override markup = () => html`
        <article>
            <h3>{{! this.args.title }}</h3>
            <button @click="choose">Read</button>
        </article>
    `;

    private get list(): PostList {
        return this.parent as PostList;
    }

    choose(): void {
        this.list.openPost(this.args.id as number);
    }
}
```

```typescript
@component({ tagName: "post-list" })
export default class PostList extends CustomElement<MyApp> {
    override markup = () => html`
        <div class="grid">
            {{~ this.posts :post }}
                <post-card :id="{{= post.id }}" :title="{{! post.title }}"></post-card>
            {{~}}
        </div>
    `;

    openPost(id: number): void {
        void this.app.router.redirect(`/posts/${id}`);
    }
}
```

`parent` is the nearest enclosing JoltUI component, even when plain HTML elements sit in
between, and it is set for lazily loaded children too.

## Parent to child

For configuration, pass **arguments** on the child's tag. To make a child *do* something later,
select it and call its method:

```typescript
@select<SearchBox>("search-box", { required: true })
accessor searchBox!: SearchBox;

clearAll(): void {
    this.searchBox.reset();
}
```

## Siblings and unrelated components

Components that do not contain each other find one another through the application.
`app.querySelector()` searches the whole app container:

```typescript
// in product-tile
async addToCart(): Promise<void> {
    const cart = this.app.querySelector<CartSummary>("cart-summary");
    await cart?.initComplete;          // make sure it has finished initializing
    cart?.addItem(this.args.sku as string);
}
```

When the caller must reach a *specific* instance, for example a reusable form calling back into
whichever page embedded it, pass the target's `hashId` as an argument:

```typescript
// in LoginPage.markup
html`<login-form data-caller-id="${this.hashId}"></login-form>`;

// in LoginForm
get caller(): LoginPage {
    const id = this.getAttribute("data-caller-id");
    return this.app.querySelector(`[data-hash-id="${id}"]`) as LoginPage;
}

async login(event: Event): Promise<void> {
    await this.caller.login(event);
}
```

Give the methods meant for other components clear names and keep them public; together they form
the component's API.

## Shared state

Direct calls are for *commands*: "open this post", "add this item". When several components
merely need to *display* the same state, keep it in application data and let
[bindings](reactivity.md) refresh each of them. No component then needs to know about the others.

## DOM events

DOM events still work and are useful in one situation: a generic, reusable component that must
not know who uses it. An `@event` attribute on a child's tag binds to the parent's method:

```typescript
// child: dispatch
this.dispatchEvent(new CustomEvent("post-selected", {
    bubbles: true,
    detail: { id: this.args.id },
}));
```

```html
<!-- parent template -->
<post-card :id="7" @post-selected="openPost"></post-card>
```

Within an application, prefer the explicit call: it shows at a glance which component depends on
which.
