# A first component

Components that are not pages are declared with `@component` alone. This counter keeps its
state in a *reactive* property and re-renders only the paragraph that displays it:

```typescript title="src/app/components/counterButton.ts"
import { CustomElement, component, html, react } from "joltui";
import type MyApp from "../app.js";

@component({ tagName: "counter-button" })
export default class CounterButton extends CustomElement<MyApp> {
    @react(0)
    accessor count!: number;

    override markup = () => html`
        <p data-bind="count">Clicked {{= this.count }} times</p>
        <button type="button" @click="increment">Click me</button>
    `;

    increment(): void {
        this.count++;
    }
}
```

To use it, import the module (importing is what registers the element) and write its tag in any
template:

```typescript title="src/app/pages/homePage.ts"
import "../components/counterButton.js";

// ...inside HomePage.markup
html`
    <h1>Hello from JoltUI</h1>
    <counter-button></counter-button>
`;
```

What happens:

1. `@click="increment"` connects the button's `click` event to the `increment` method.
2. Assigning `this.count` invalidates the `count` binding.
3. JoltUI re-evaluates the template of the element marked `data-bind="count"`, and only that
   element changes.

`{{= ... }}` is a [doT](../guide/templates.md) expression evaluated with the component as
`this`. [Reactivity](../guide/reactivity.md) explains bindings in detail.

## Passing arguments

Attributes that start with `:` (short for `data-jolt-`) are the component's arguments:

```html
<counter-button :label="Likes" :start="10"></counter-button>
```

```typescript
override markup = () => html`
    <p data-bind="count">{{! this.args.label }}: {{= this.count }}</p>
    <button type="button" @click="increment">+1</button>
`;
```

Values are parsed as JSON when possible, so `:start="10"` arrives as the number `10`.

## Next steps

- [Components](../guide/components.md): where markup comes from, events, arguments, selecting
  elements.
- [Component communication](../guide/communication.md): how components call each other.
- [Routing](../guide/routing.md): route parameters, navigation and titles.
