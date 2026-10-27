# Templates

JoltUI templates are HTML strings evaluated by an extended version of the
[doT](https://olado.github.io/doT/) template engine. doT compiles a template into a JavaScript
function; JoltUI calls that function with the component as `this`. Anything reachable from the
component (its properties, getters, `this.app`, `this.args`) can be used in an expression.

## Syntax at a glance

| Syntax | Meaning |
| --- | --- |
| `{{= expr }}` | Insert the value of `expr` as-is. |
| `{{! expr }}` | Insert the value of `expr`, HTML-encoded. |
| `{{ code }}` | Run JavaScript statements (declare variables, call functions). |
| `{{? cond }} … {{?}}` | Conditional block. |
| `{{?? cond }}` | *else if* inside a conditional. |
| `{{??}}` | *else* inside a conditional. |
| `{{~ list :item }} … {{~}}` | Loop over an array. |
| `{{~ list :item :i }} … {{~}}` | Loop with an index variable. |
| `{{## def.name: … #}}`, `{{# def.name }}` | Compile-time partials (define, then use). |

## Interpolation

```typescript
override markup = () => html`
    <h1>{{= this.post.title }}</h1>
    <p class="meta">By {{= this.post.author }} · {{= this.post.readTime }}</p>
    <img src="{{= this.post.cover }}" alt="">
`;
```

Expressions can be arbitrary JavaScript: method calls, ternaries, `padStart`, `toLocaleString`
and so on. An expression that evaluates to `undefined` prints the text `undefined`, so supply
defaults where needed:

```html
<input name="search" value="{{! this.app.queryParameters.search ?? '' }}">
```

## Escaping and security

`{{= }}` inserts values **without escaping**. That is right for trusted values and for HTML you
build deliberately, but not for text that a user or an external system controls. For those, use
`{{! }}`, which encodes `&`, `<`, `>`, `"`, `'` and `/`:

```html
<!-- comment text comes from other users: encode it -->
<p class="comment">{{! comment.text }}</p>

<!-- the post title comes from our own CMS: raw output is fine -->
<h2>{{= post.title }}</h2>
```

!!! danger "Rule of thumb"

    Anything that originated outside your code (form input, query parameters, API data from
    other users) goes through `{{! }}`. Using `{{= }}` on such values opens the door to
    cross-site scripting.

## Conditionals

```html
{{? this.user }}
    <a href="/profile">Hello, {{! this.user.name }}</a>
{{?? this.loading }}
    <span class="spinner"></span>
{{??}}
    <a href="/login">Sign in</a>
{{?}}
```

## Loops

```html
<ul class="post-list">
    {{~ this.posts :post :index }}
        <li class="{{= index % 2 ? 'odd' : 'even' }}">
            <a href="/posts/{{= post.id }}">{{! post.title }}</a>
        </li>
    {{~}}
</ul>
```

The array expression is evaluated once; `post` and `index` are local variables inside the loop
body.

## Code blocks

`{{ ... }}` runs statements. Variables declared there are visible for the rest of the template:

```html
{{ const featured = this.posts.find(post => post.featured); }}
{{? featured }}
    <a class="featured" href="/posts/{{= featured.id }}">{{! featured.title }}</a>
{{?}}
```

## Whitespace and comments

To keep output compact, doT removes line breaks and tabs from the template before compiling it:

- **Do not use `//` comments inside `{{ }}` code.** Once line breaks are gone, a line comment
  swallows the rest of the template. Use `/* ... */`; block comments are removed entirely.
- **Line breaks in the template disappear**, including inside `<pre>` elements. Generate
  preformatted content through an expression (`{{! this.source }}`) so that the line breaks come
  from data rather than from the template text.

## Event and argument shorthands

After evaluation, JoltUI rewrites two attribute shorthands inside every opening tag:

| You write | JoltUI produces | Purpose |
| --- | --- | --- |
| `@click="save"` | `jolt-click="save"` | Event binding |
| `:post-id="7"` | `data-jolt-post-id="7"` | Argument |

The rewrite is aware of HTML structure. It ignores comments, CDATA sections and the contents of
`<script>`, `<style>`, `<textarea>`, `<title>` and similar raw-text elements, and touches only
attribute names, never attribute values or text. `user@example.com` or a CSS rule such as
`a:hover` is left alone. Names must be lowercase and may contain hyphens.

## Templates outside `markup`

Thanks to the [patched DOM](architecture.md#the-patched-dom), the template engine is available
wherever HTML is inserted into a component:

```typescript
addDraft(): void {
    this.querySelector("#drafts")?.insertAdjacentHTML("afterbegin", html`
        <article class="draft">
            <h2>{{! this.newTitle }}</h2>
            <button @click="removeDraft">Remove</button>
        </article>
    `);
}
```

The inserted HTML is evaluated with the component as `this`, its shorthands are expanded and its
event handlers are attached. The same holds for assigning `innerHTML` or `outerHTML` of any
element owned by the component.

## Partials with `def`

doT's compile-time definitions repeat a fragment within one template. Define it once with
`{{## def.name: … #}}` and insert it with `{{# def.name }}`:

```html
{{## def.newBadge:
    <span class="badge">{{= this.isNew ? "new" : "" }}</span>
#}}

<h2>Articles {{# def.newBadge }}</h2>
<h2>Videos {{# def.newBadge }}</h2>
```

The fragment is copied into the template before compilation, so it can refer to `this`. Only the
parameterless form is supported; doT's parameterised partials (`{{## def.badge:label: … #}}`)
fail to compile.

For anything reused across components, a small component or a TypeScript helper function that
returns a string is usually clearer.
