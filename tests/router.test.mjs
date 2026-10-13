import assert from "node:assert/strict";
import test from "node:test";

class ElementStub extends EventTarget {
    children = [];
    parentElement = null;
    attributes = new Map();
    tagName = this.constructor.tagName ?? "DIV";
    get isConnected() { return this.root || Boolean(this.parentElement?.isConnected); }
    setAttribute(name, value) { this.attributes.set(name, String(value)); }
    getAttribute(name) { return this.attributes.get(name) ?? null; }
    hasAttribute(name) { return this.attributes.has(name); }
    matches(selector) { return selector === `#${this.id}`; }
    querySelector(selector) {
        for (const child of this.children) {
            if (child.matches(selector) || selector === `[data-hash-id="${child.getAttribute("data-hash-id")}"]`) return child;
            const match = child.querySelector(selector);
            if (match) return match;
        }
        return null;
    }
    remove() {
        if (!this.parentElement) return;
        this.parentElement.children = this.parentElement.children.filter(child => child !== this);
        this.parentElement = null;
        const disconnect = element => {
            element.disconnectedCallback?.();
            for (const child of element.children) disconnect(child);
        };
        disconnect(this);
    }
}
globalThis.Element = globalThis.HTMLElement = ElementStub;
globalThis.window = { addEventListener() {}, scrollTo() {} };
const registry = new Map();
globalThis.customElements = {
    get: name => registry.get(name),
    define: (name, type) => registry.set(name, type),
};

const { default: Router, routeEventsEnum } = await import("../dist/router.js");
const { default: CustomElement } = await import("../dist/customElement.js");
const { component, page, layout } = await import("../dist/elementMetadata.js");
const { auth } = await import("../dist/auth.js");

function deferred() {
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
}

async function until(predicate) {
    for (let attempt = 0; attempt < 100; attempt++) {
        if (predicate()) return;
        await Promise.resolve();
    }
    assert.fail("Expected routing stage was not reached");
}

let sequence = 0;
function elementClass(decorators) {
    class TestElement extends CustomElement {
        static generate(hash) { return { type: this, hash }; }
        get dataField() { return null; }
    }
    const initializers = [];
    const context = { kind: "class", name: "TestElement", addInitializer: fn => initializers.push(fn) };
    component({ tagName: `test-element-${++sequence}` })(TestElement, context);
    for (const decorator of decorators) decorator(TestElement, context);
    for (const initialize of initializers) initialize();
    return TestElement;
}

function setup() {
    globalThis.location = new URL("https://example.test/fast/0");
    globalThis.history = {
        pushState(_state, _title, url) { globalThis.location = new URL(url, location); },
    };
    const title = { innerText: "" };
    globalThis.document = { head: { querySelector: () => title } };
    const Base = elementClass([layout]);
    const Sub = elementClass([layout]);
    const Slow = elementClass([page({ path: "/slow/<int:id>", title: "Slow" }), auth(["USER"])]);
    const Nested = elementClass([page({
        path: "/nested/<int:id>", title: "Nested", target: "#nested",
        subLayouts: [{ target: "#page", layout: Sub }],
    })]);
    const Fast = elementClass([page({ path: "/fast/<int:id>", title: "Fast" })]);
    const container = new ElementStub();
    container.root = true;
    const created = [];
    const gates = new Map();
    const errors = [];
    const events = [];
    let router;
    const app = {
        container, appName: "Tests",
        addEventListener: (...args) => container.addEventListener(...args),
        removeEventListener: (...args) => container.removeEventListener(...args),
        generateHash: () => String(++sequence),
        querySelector: selector => container.querySelector(selector),
        async handleErrorOnce(error) { errors.push(error); },
        originalInnerHTML(markup) {
            for (const child of [...this.children]) child.remove();
            if (!markup) return;
            const element = new markup.type();
            element._app = app;
            element.parentElement = this;
            element.setAttribute("data-hash-id", markup.hash ?? String(++sequence));
            this.children.push(element);
            if (markup.type === Base || markup.type === Sub) {
                const target = new ElementStub();
                target.id = markup.type === Base ? "page" : "nested";
                target.parentElement = element;
                element.children.push(target);
            }
            created.push({ element, parameters: { ...router.routeParameters } });
            const gate = gates.get(markup.type)?.shift();
            if (gate) {
                void gate.promise.then(
                    () => element._completeInitialization(),
                    error => element._failInitialization(error),
                );
            } else element._completeInitialization();
        },
    };
    router = new Router({ app, baseLayout: Base, defaultTarget: "#page", pages: [Slow, Nested, Fast] });
    router.isAuthenticated = () => true;
    router.checkUserRoles = () => true;
    for (const name of Object.values(routeEventsEnum)) container.addEventListener(name, () => events.push(name));
    return { router, Base, Sub, Slow, Fast, created, gates, errors, events, title };
}

function assertLatest(context) {
    assert.equal(location.pathname, "/fast/2");
    assert.equal(context.router.currentRoute.path, "/fast/2");
    assert.deepEqual(context.router.routeParameters, { id: 2 });
    assert.equal(context.title.innerText, "Fast");
    assert.deepEqual(context.errors, []);
    assert.equal(context.events.filter(name => name === routeEventsEnum.FINISHED).length, 1);
    const rendered = context.created.findLast(entry => entry.element instanceof context.Fast);
    assert.ok(rendered.element.isConnected);
    assert.deepEqual(rendered.parameters, { id: 2 });
}

for (const stage of ["authentication", "roles"]) {
    test(`latest navigation wins during delayed ${stage}`, async () => {
        const context = setup();
        const { router } = context;
        const gate = deferred();
        let entered = false;
        router[stage === "authentication" ? "isAuthenticated" : "checkUserRoles"] = () => {
            entered = true;
            return gate.promise;
        };
        router.routeParameters = { id: 0 };
        const older = router.redirect("/slow/1");
        await until(() => entered);
        assert.deepEqual(router.routeParameters, { id: 0 });
        await router.redirect("/fast/2");
        await older;
        gate.reject(new Error("late authentication failure"));
        await Promise.resolve();
        assertLatest(context);
        assert.ok(!context.created.some(entry => entry.element instanceof context.Slow));
    });
}

for (const stage of ["Base", "Sub", "Slow"]) {
    test(`superseding pending ${stage} initialization disconnects obsolete elements`, async () => {
        const context = setup();
        const { router, gates, created } = context;
        const gate = deferred();
        gates.set(context[stage], [gate]);
        const older = router.redirect(stage === "Sub" ? "/nested/1" : "/slow/1");
        await until(() => created.some(entry => entry.element instanceof context[stage]));
        const obsolete = created.find(entry => entry.element instanceof context[stage]).element;
        await router.redirect("/fast/2");
        await older;
        assert.ok(obsolete.abortSignal.aborted);
        assert.ok(!obsolete.isConnected);
        gate.resolve();
        await Promise.resolve();
        assertLatest(context);
        assert.equal(router._activeSubLayouts.length, 0);
    });
}

test("an obsolete title generator cannot overwrite the latest title or current route", async () => {
    const context = setup();
    const gate = deferred();
    let entered = false;
    context.router.titleGenerator = (_tagName, title) => {
        if (title !== "Slow") return title;
        entered = true;
        return gate.promise;
    };
    const older = context.router.redirect("/slow/1");
    await until(() => entered);
    await context.router.redirect("/fast/2");
    await older;
    gate.resolve("Obsolete title");
    await Promise.resolve();
    assertLatest(context);
});

test("superseded Back/Forward navigation does not restore stale scroll position", async () => {
    const context = setup();
    const gate = deferred();
    context.router.isAuthenticated = () => gate.promise;
    const scrolls = [];
    window.scrollTo = (...position) => scrolls.push(position);
    globalThis.location = new URL("https://example.test/slow/1");
    const older = context.router._popStateHandler({ state: { scrollPosition: { x: 1, y: 100 } } });
    globalThis.location = new URL("https://example.test/fast/2");
    await context.router._popStateHandler({ state: { scrollPosition: { x: 2, y: 200 } } });
    await older;
    assert.deepEqual(scrolls, [[2, 200]]);
    assertLatest(context);
});

test("a second click supersedes an unfinished click navigation", async () => {
    const context = setup();
    const gate = deferred();
    context.router.isAuthenticated = () => gate.promise;
    const click = pathname => {
        const anchor = new ElementStub();
        Object.assign(anchor, { href: `https://example.test${pathname}`, origin: location.origin, protocol: "https:" });
        anchor.closest = () => anchor;
        return context.router._clickHandler({ target: anchor, button: 0, preventDefault() {} });
    };
    const older = click("/slow/1");
    await click("/fast/2");
    await older;
    assertLatest(context);
});

test("route matching has no side effects and active authorization failures still reach handlers", async () => {
    const context = setup();
    const { router } = context;
    router.routeParameters = { id: 0 };
    assert.deepEqual(router._matchRoute("/slow/1").parameters, { id: 1 });
    assert.throws(() => router._matchRoute("/missing"));
    assert.deepEqual(router.routeParameters, { id: 0 });
    router.checkUserRoles = () => false;
    await router.redirect("/slow/1");
    assert.equal(context.errors.length, 1);
    assert.equal(context.errors[0].name, "AuthorizationError");
    assert.deepEqual(router.routeParameters, { id: 0 });
    assert.equal(context.created.length, 0);
});

test("completed layouts survive navigation started synchronously by a completion listener", async () => {
    const context = setup();
    const { router, Base, created } = context;
    let next;
    router.app.container.addEventListener(routeEventsEnum.FINISHED, () => {
        if (router.currentRoute.path === "/slow/1") next = router.redirect("/fast/2");
    });
    await router.redirect("/slow/1");
    await next;
    const layouts = created.filter(entry => entry.element instanceof Base);
    assert.equal(layouts.length, 1);
    assert.ok(layouts[0].element.isConnected);
    assert.ok(!layouts[0].element.abortSignal.aborted);
    assert.equal(router.currentRoute.path, "/fast/2");
    assert.equal(context.title.innerText, "Fast");
    assert.deepEqual(context.errors, []);
});

test("a navigation superseded by a start listener never inserts its elements", async () => {
    const context = setup();
    let next;
    context.router.app.container.addEventListener(routeEventsEnum.START, () => {
        if (location.pathname === "/slow/1") next = context.router.redirect("/fast/2");
    });
    await context.router.redirect("/slow/1");
    await next;
    assert.ok(!context.created.some(entry => entry.element instanceof context.Slow));
    assertLatest(context);
});

test("missing initial routes render an ordinary component without changing history", async () => {
    const { router, title, created } = setup();
    const ErrorPage = elementClass([]);
    globalThis.location = new URL("https://example.test/missing?q=1#section");
    history.pushState = () => assert.fail("Error pages must not write history");
    router.app.handleErrorOnce = error => router.showErrorPage(ErrorPage, { error, title: "Not found" });
    await router.route();
    assert.equal(location.href, "https://example.test/missing?q=1#section");
    assert.equal(router.currentRoute, null);
    assert.deepEqual(router.routeParameters, {});
    assert.equal(title.innerText, "Not found");
    assert.ok(created.find(entry => entry.element instanceof ErrorPage).element.isConnected);
});

test("error pages clear route parameters and nested layouts", async () => {
    const { router, created } = setup();
    await router.redirect("/nested/1");
    const ErrorPage = elementClass([]);
    await router.showErrorPage(ErrorPage);
    assert.equal(location.pathname, "/nested/1");
    assert.equal(router.currentRoute, null);
    assert.deepEqual(router.routeParameters, {});
    assert.equal(router._activeSubLayouts.length, 0);
    assert.deepEqual(created.at(-1).parameters, {});
    assert.ok(created.at(-1).element instanceof ErrorPage);
});

test("new navigation cancels pending error page initialization", async () => {
    const context = setup();
    const ErrorPage = elementClass([]);
    const gate = deferred();
    context.gates.set(ErrorPage, [gate]);
    const pending = context.router.showErrorPage(ErrorPage, { title: "Obsolete error" });
    await until(() => context.created.some(entry => entry.element instanceof ErrorPage));
    const obsolete = context.created.at(-1).element;
    await context.router.redirect("/fast/2");
    await pending;
    gate.resolve();
    assert.ok(!obsolete.isConnected);
    assertLatest(context);
});

test("a delayed error handler cannot replace newer navigation", async () => {
    const context = setup();
    const ErrorPage = elementClass([]);
    const gate = deferred();
    let entered = false;
    context.router.app.handleErrorOnce = async error => {
        entered = true;
        await gate.promise;
        await context.router.showErrorPage(ErrorPage, { error });
    };
    const pending = context.router.redirect("/missing");
    await until(() => entered);
    await context.router.redirect("/fast/2");
    gate.resolve();
    await pending;
    assertLatest(context);
    assert.ok(!context.created.some(entry => entry.element instanceof ErrorPage));
});

test("recursive error rendering rejects and initialization failures propagate", async () => {
    const { router, gates, created } = setup();
    const ErrorPage = elementClass([]);
    const gate = deferred();
    gates.set(ErrorPage, [gate]);
    const pending = router.showErrorPage(ErrorPage);
    await until(() => created.some(entry => entry.element instanceof ErrorPage));
    await assert.rejects(router.showErrorPage(ErrorPage), /another error page is initializing/);
    const failure = new Error("Error page failed");
    gate.reject(failure);
    await assert.rejects(pending, error => error === failure);
    await router.redirect("/fast/2");
    assert.equal(router.currentRoute.path, "/fast/2");
});

test("error pages support explicit layouts and targets", async () => {
    const { router, Sub, created } = setup();
    const ErrorPage = elementClass([]);
    await router.showErrorPage(ErrorPage, { layout: Sub, target: "#nested" });
    assert.ok(router.app.container.children[0] instanceof Sub);
    assert.ok(created.at(-1).element instanceof ErrorPage);
    await assert.rejects(router.showErrorPage(ErrorPage, { layout: ErrorPage }), /must use @layout/);
});
