# Template syntax

## doT

| Syntax | Meaning |
| --- | --- |
| `{{= expr }}` | Output, unescaped. |
| `{{! expr }}` | Output, HTML-encoded (`&`, `<`, `>`, `"`, `'`, `/`). |
| `{{ code }}` | Run statements; use `/* */` comments only. |
| `{{? a }} … {{?? b }} … {{??}} … {{?}}` | if / else if / else. |
| `{{~ list :item :index }} … {{~}}` | Loop (index optional). |
| `{{## def.name: … #}}` / `{{# def.name }}` | Define / use a compile-time partial (parameterless only). |

Expressions run with the component as `this`. Line breaks and tabs are removed before compiling.

## JoltUI attributes

| Syntax | Expands to | Meaning |
| --- | --- | --- |
| `@event="method"` | `jolt-event="method"` | Calls `this.method(event, args)` on the event. |
| `:name="value"` | `data-jolt-name="value"` | Argument (component or handler). |
| `data-bind="binding"` | — | Region re-evaluated when `binding` is invalidated. |
| `router-ignore` | — | Link is not handled by the router. |

## Binding names

| Binding | Refreshed by |
| --- | --- |
| `app.<field>` | `app.setData(field, …)` |
| `query.<name>` | query-parameter changes made through the App |
| `attr.<name>` | changes to the host's `data-jolt-<name>` attribute |
| `<name>` | `@react` / `@reactFactory` setters, `invalidate(name)` |

## `${}` versus `{{ }}`

| | `${ expr }` | `{{= expr }}` |
| --- | --- | --- |
| Evaluated | when `markup()` runs | on every render and region refresh |
| Cached by the template cache | yes (frozen) | no (re-evaluated) |
| Usable in `data-bind` regions | no | yes |
