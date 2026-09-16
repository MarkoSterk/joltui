import assert from "node:assert/strict";
import test from "node:test";

// lifecycle cancelation tests
globalThis.HTMLElement = class extends EventTarget {
    tagName = "TEST-ELEMENT";
    isConnected = true;
    parentElement = null;
    innerHTML = "";
    localName = "test-element";
    namespaceURI = "http://www.w3.org/1999/xhtml";
    children = [];
    attributesMap = new Map();
    get attributes() {
        return Array.from(this.attributesMap, ([name, value]) => ({ name, value }));
    }
    removeAttributeNode(attribute) { this.attributesMap.delete(attribute.name); }
    getAttribute(name) { return this.attributesMap.get(name) ?? null; }
    hasAttribute(name) { return this.attributesMap.has(name); }
    setAttribute(name, value) { this.attributesMap.set(name, value); }
    closest() { return { app: this._app }; }
    querySelectorAll() { return []; }
};
globalThis.Element = globalThis.HTMLElement;
globalThis.Document = class {};
globalThis.location = { search: "" };
globalThis.customElements = { get() { return undefined; } };
for (const name of ["innerHTML", "outerHTML"]) {
    Object.defineProperty(Element.prototype, name, {
        configurable: true,
        set(value) {},
    });
}

const { default: CustomElement } = await import("../dist/customElement.js");
const { default: App } = await import("../dist/app.js");
const { Lifecycle, lifecycle } = await import("../dist/lifecycle.js");
const { ElementDisconnectedError, awaitWithSignal } =
    await import("../dist/cancellation.js");

function deferred() {
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
}

function makeApp() {
    const app = new App({ appName: "Cancellation tests" });
    Object.assign(app, {
        _templatesCache: new Map(),
        _pendingTemplateCache: new Map(),
        _errorHandlerInstances: [{ handle() { app.errors++; return true; } }],
        errors: 0,
        serverComponentsUrl: "/components",
        generateHash: () => "test-hash",
        addEventListener() {},
        removeEventListener() {},
        handleErrorOnce: error => app.handleError(error),
    });
    return app;
}

class TestElement extends CustomElement {
    cached = false;
    server = true;
    get useServer() { return this.server; }
    get cache() { return this.cached; }
    get cacheDuration() { return 60; }
    get dataField() { return null; }
    get groupName() { return "default"; }
    get args() { return {}; }
    templateCacheKey() { return "shared"; }
}

function disconnect(element) {
    element.isConnected = false;
    element.disconnectedCallback();
}

function append(parent, child) {
    parent.children.push(child);
    child.parentElement = parent;
    return child;
}

for (const childFirst of [false, true]) {
    test(`inserted markup hydrates the correct owner (child initialized first: ${childFirst})`, () => {
        const parent = new TestElement();
        parent.hashId = "page-id";
        const wrapper = append(parent, new HTMLElement());
        wrapper.localName = "div";
        const child = append(wrapper, new TestElement());
        child.localName = "edit-title";
        child.hashId = "title-id";
        child.setAttribute("jolt-change", "titleChanged");
        const button = append(child, new HTMLElement());
        button.localName = "button";
        button.setAttribute("jolt-click", "editTitle");
        const parentButton = append(wrapper, new HTMLElement());
        parentButton.localName = "button";
        parentButton.setAttribute("jolt-click", "pageAction");
        const calls = [];
        parent._executeElementMethod = (_element, method) => calls.push(`parent:${method}`);
        child._executeElementMethod = (_element, method) => calls.push(`child:${method}`);

        if (childFirst) child._initializePrerenderedMarkup();
        // These are the shared hooks invoked after server/markup/HTML insertion.
        parent.tagInsertedElements([wrapper]);
        parent.hydrate([wrapper]);
        if (!childFirst) {
            assert.equal(button.hasAttribute("data-parent-id"), false);
            assert.equal(button["jolt-click:active"], undefined);
            child._initializePrerenderedMarkup();
        }
        assert.equal(button.getAttribute("data-parent-id"), "title-id");
        assert.equal(button.getAttribute("data-render-time"), String(child.lastRender));
        assert.equal(child.getAttribute("data-parent-id"), "page-id");

        // Repeated and overlapping roots must not duplicate or steal listeners.
        parent.hydrate([wrapper, child, button]);
        parent.hydrate();
        button.dispatchEvent(new Event("click"));
        child.dispatchEvent(new Event("change"));
        parentButton.dispatchEvent(new Event("click"));
        assert.deepEqual(calls, ["child:editTitle", "parent:titleChanged", "parent:pageAction"]);
    });
}

test("insertion respects unregistered boundaries and rejects foreign ownership roots", () => {
    const parent = new TestElement();
    parent.hashId = "parent-id";
    const lazy = append(parent, new HTMLElement());
    lazy.localName = "lazy-child";
    const button = append(lazy, new HTMLElement());
    button.localName = "button";
    button.setAttribute("jolt-click", "childMethod");
    const detached = new HTMLElement();
    detached.localName = "button";
    detached.setAttribute("jolt-click", "detachedMethod");
    parent.tagInsertedElements([lazy, button, detached]);
    parent.hydrate([lazy, button, detached]);
    assert.equal(lazy.getAttribute("data-parent-id"), "parent-id");
    for (const element of [button, detached]) {
        assert.equal(element.hasAttribute("data-parent-id"), false);
        assert.equal(element["jolt-click:active"], undefined);
    }
    // Even stale matching metadata cannot bypass a component boundary.
    button.setAttribute("data-parent-id", parent.hashId);
    button.setAttribute("data-render-time", String(parent.lastRender));
    parent.hydrate();
    assert.equal(button["jolt-click:active"], undefined);
});

test("prerendered adoption preserves nodes, literal templates and component boundaries", t => {
    t.mock.method(customElements, "get", name => name === "child-element" ? TestElement : undefined);
    const host = new TestElement();
    host.hashId = "host-id";
    host.innerHTML = "{{= this.title }}";
    const wrapper = append(host, new HTMLElement());
    wrapper.localName = "div";
    wrapper.setAttribute("@click", "clicked");
    wrapper.setAttribute(":value", "literal {{= this.value }}");
    // Mimic the framework's patched removal: it must never be used here.
    wrapper.removeAttribute = () => assert.fail("Use raw attribute-node removal");
    const child = append(wrapper, new TestElement());
    child.localName = "child-element";
    child.setAttribute("data-hash-id", "child-id");
    child.setAttribute("@change", "changed");
    const grandchild = append(child, new HTMLElement());
    grandchild.localName = "unregistered-grandchild";
    grandchild.setAttribute("@click", "childMethod");
    grandchild.setAttribute("data-parent-id", "child-id");
    let clicks = 0;
    let changes = 0;
    host._executeElementMethod = (_element, method) => {
        if (method === "clicked") clicks++;
        if (method === "changed") changes++;
    };

    host._initializePrerenderedMarkup();
    host._initializePrerenderedMarkup();
    assert.equal(host.children[0], wrapper);
    assert.equal(wrapper.children[0], child);
    assert.equal(host.innerHTML, "{{= this.title }}");
    assert.equal(child.abortSignal.aborted, false);
    assert.equal(child.getAttribute("data-hash-id"), "child-id");
    for (const node of [wrapper, child]) {
        assert.equal(node.getAttribute("data-parent-id"), "host-id");
        assert.equal(node.getAttribute("data-render-time"), String(host.lastRender));
    }
    assert.equal(wrapper.hasAttribute(":value"), false);
    assert.equal(wrapper.getAttribute("data-jolt-value"), "literal {{= this.value }}");
    assert.equal(wrapper.hasAttribute("@click"), false);
    assert.equal(grandchild.getAttribute("@click"), "childMethod");
    assert.equal(grandchild.getAttribute("data-parent-id"), "child-id");
    wrapper.dispatchEvent(new Event("click"));
    child.dispatchEvent(new Event("change"));
    grandchild.dispatchEvent(new Event("click"));
    assert.equal(clicks, 1, "adoption must not duplicate listeners");
    assert.equal(changes, 1, "parent handles events declared on child hosts");
});

test("prerendered adoption rejects undeclared children before tagging descendants", () => {
    const host = new TestElement();
    const child = append(host, new HTMLElement());
    child.localName = "missing-child";
    assert.throws(() => host._initializePrerenderedMarkup(), /missing-child.*not registered/);
    assert.equal(child.hasAttribute("data-parent-id"), false);
});

test("prerendered normalization preserves canonical values and traverses foreign hyphenated tags", () => {
    const host = new TestElement();
    host.hashId = "host-id";
    const foreign = append(host, new HTMLElement());
    foreign.namespaceURI = "http://www.w3.org/2000/svg";
    foreign.localName = "font-face";
    foreign.setAttribute(":value", "shorthand");
    foreign.setAttribute("data-jolt-value", "canonical");
    host._initializePrerenderedMarkup();
    assert.equal(foreign.getAttribute("data-jolt-value"), "canonical");
    assert.equal(foreign.hasAttribute(":value"), false);
    assert.equal(foreign.getAttribute("data-parent-id"), "host-id");
});

test("prerendered initialization normalizes host arguments before loading dependencies", async t => {
    let registered = false;
    t.mock.method(customElements, "get", () => registered ? TestElement : undefined);
    const host = new TestElement();
    host._app = makeApp();
    host.server = false;
    host.setAttribute(":value", "42");
    const child = append(host, new TestElement());
    child.localName = "lazy-child";
    host._loadDependencies = async () => {
        assert.equal(host.getAttribute("data-jolt-value"), "42");
        assert.equal(host.hasAttribute(":value"), false);
        await Promise.resolve();
        registered = true;
    };
    host.render = () => assert.fail("Initial prerendered markup must bypass rendering");
    await host.initElement();
    assert.equal(host.initializationState, "fulfilled");
    assert.equal(child.getAttribute("data-parent-id"), host.hashId);
});

for (const ownerType of ["component", "application"]) {
    test(`${ownerType} waits for nearest components through HTML wrappers`, async () => {
        const owner = ownerType === "component" ? new TestElement() : makeApp();
        const root = ownerType === "component" ? owner : new HTMLElement();
        if (ownerType === "application") owner._container = root;
        const wrapper = new HTMLElement();
        wrapper.parentElement = root;
        const child = new TestElement();
        child.parentElement = wrapper;
        const nested = new TestElement();
        nested.parentElement = child;
        const sibling = new TestElement();
        sibling.parentElement = root;
        root.querySelectorAll = () => [wrapper, child, nested, sibling];

        const wait = owner._waitForSubelements();
        let completed = false;
        void wait.then(() => { completed = true; }, () => {});
        // A child's discarded descendants must not reject the owner's wait.
        disconnect(nested);
        child._completeInitialization();
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(completed, false, "must still await the sibling");
        sibling._completeInitialization();
        await wait;
        assert.equal(completed, true);
    });

    test(`${ownerType} propagates a nearest child's initialization failure`, async () => {
        const owner = ownerType === "component" ? new TestElement() : makeApp();
        const root = ownerType === "component" ? owner : new HTMLElement();
        if (ownerType === "application") owner._container = root;
        const child = new TestElement();
        child.parentElement = root;
        root.querySelectorAll = () => [child];
        const wait = owner._waitForSubelements();
        const failure = new Error("Child initialization failed");
        child._failInitialization(failure);
        await assert.rejects(wait, error => error === failure);
    });
}

test("disconnection promptly rejects initialization and aborts its private fetch", async t => {
    const started = deferred();
    let requestSignal;
    t.mock.method(globalThis, "fetch", (_url, { signal }) => {
        requestSignal = signal;
        started.resolve();
        return new Promise((_resolve, reject) => {
            signal.addEventListener("abort", () => reject(signal.reason), { once: true });
        });
    });
    const element = new TestElement();
    element._app = makeApp();
    const task = element.initElement();
    await started.promise;
    disconnect(element);
    await assert.rejects(task, ElementDisconnectedError);
    await assert.rejects(element.initComplete, ElementDisconnectedError);
    assert.equal(requestSignal.aborted, true);
    assert.equal(element.innerHTML, "");
    assert.equal(element.initializationState, "rejected");
    assert.equal(element.app.errors, 0);
    element.isConnected = true;
    await element.connectedCallback();
    assert.equal(element.abortSignal.aborted, true);
});

test("a shared fetch survives one consumer disconnecting and populates the cache", async t => {
    const response = deferred();
    const started = deferred();
    let calls = 0;
    t.mock.method(globalThis, "fetch", (_url, { signal }) => {
        calls++;
        assert.equal(signal, null);
        started.resolve();
        return response.promise;
    });
    const app = makeApp();
    const first = new TestElement();
    const second = new TestElement();
    first._app = second._app = app;
    first.cached = second.cached = true;
    const firstRender = first.render();
    const secondRender = second.render();
    await started.promise;
    disconnect(first);
    await assert.rejects(firstRender, ElementDisconnectedError);
    response.resolve(new Response("<p>shared</p>"));
    await secondRender;
    assert.equal(calls, 1);
    assert.equal(first.innerHTML, "");
    assert.equal(second.innerHTML, "<p>shared</p>");
    assert.equal(app.getCachedTemplate("shared"), "<p>shared</p>");
    assert.equal(app.errors, 0);
});

test("late non-cancellable markup never writes into a disconnected element", async () => {
    const markup = deferred();
    const element = new TestElement();
    element._app = makeApp();
    element.server = false;
    element.markup = () => markup.promise;
    const render = element.rerender();
    await Promise.resolve();
    disconnect(element);
    await assert.rejects(render, ElementDisconnectedError);
    markup.resolve("<p>too late</p>");
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(element.innerHTML, "");
    assert.equal(element.app.errors, 0);
});

test("cancellation during BEFORE_INIT_RESOLVE skips AFTER_INIT", async () => {
    const entered = deferred();
    const work = deferred();
    class HookElement extends TestElement {
        before() { entered.resolve(); return work.promise; }
        after() { assert.fail("AFTER_INIT must not run"); }
    }
    lifecycle(Lifecycle.BEFORE_INIT_RESOLVE)(HookElement.prototype.before, { name: "before" });
    lifecycle(Lifecycle.AFTER_INIT)(HookElement.prototype.after, { name: "after" });
    const element = new HookElement();
    element._app = makeApp();
    element.server = false;
    element.markup = () => "<p>ready</p>";
    const init = element.initElement();
    await entered.promise;
    disconnect(element);
    await assert.rejects(init, ElementDisconnectedError);
    work.resolve();
    await Promise.resolve();
    assert.equal(element.app.errors, 0);
});

test("successful initialization is fulfilled before AFTER_INIT runs", async () => {
    class HookElement extends TestElement {
        async after() {
            assert.equal(this.initializationState, "fulfilled");
            await this.initComplete;
            this.afterRan = true;
        }
    }
    lifecycle(Lifecycle.AFTER_INIT)(HookElement.prototype.after, { name: "after" });
    const element = new HookElement();
    element._app = makeApp();
    element.server = false;
    element.markup = () => "<p>ready</p>";
    await element.initElement();
    assert.equal(element.afterRan, true);
});

test("wrapped cancellation bypasses application handlers, ordinary errors do not", async () => {
    const app = makeApp();
    await app.handleError(new Error("wrapper", { cause: new ElementDisconnectedError() }));
    assert.equal(app.errors, 0);
    await app.handleError(new Error("genuine failure"));
    assert.equal(app.errors, 1);
});

test("an already cancelled wait still observes late rejection of its work", async () => {
    const controller = new AbortController();
    controller.abort(new ElementDisconnectedError());
    await assert.rejects(
        awaitWithSignal(Promise.reject(new Error("late failure")), controller.signal),
        ElementDisconnectedError,
    );
});

test("event-handler requests cancelled by disconnection do not dispatch errors", async t => {
    const started = deferred();
    t.mock.method(globalThis, "fetch", (_url, { signal }) => {
        started.resolve();
        return new Promise((_resolve, reject) => {
            signal.addEventListener("abort", () => reject(signal.reason), { once: true });
        });
    });
    const element = new TestElement();
    element._app = makeApp();
    element._getAllArgs = () => ({});
    element.load = () => fetch("/manual", { signal: element.abortSignal });
    const execution = element._executeElementMethod(element, "load", new Event("click"));
    await started.promise;
    disconnect(element);
    await execution;
    assert.equal(element.app.errors, 0);
});

test("response-body cancellation preserves the lifetime cancellation reason", async t => {
    const reading = deferred();
    t.mock.method(globalThis, "fetch", async (_url, { signal }) => ({
        ok: true,
        text() {
            reading.resolve();
            return new Promise((_resolve, reject) => {
                signal.addEventListener("abort", () => reject(signal.reason), { once: true });
            });
        },
    }));
    const element = new TestElement();
    element._app = makeApp();
    const request = element.fetchHTML({ tagName: "test-element", groupName: "default" });
    await reading.promise;
    disconnect(element);
    await assert.rejects(request, ElementDisconnectedError);
});

test("prefetch and render share normalized request cache keys", async t => {
    const requests = [];
    t.mock.method(globalThis, "fetch", async (url, init) => {
        requests.push({ url, body: JSON.parse(init.body) });
        return {
            ok: true,
            text: async () => "<p>cached</p>",
        };
    });

    const app = makeApp();
    app._router = {
        routeParameters: {
            system: "si",
            lang: "sl",
            researcherId: 57366,
        },
    };
    Object.defineProperty(app, "queryParameters", {
        configurable: true,
        get: () => ({ view: "summary" }),
    });

    const element = new TestElement();
    element._app = app;
    const request = {
        tagName: "researcher-page-aside",
        groupName: "researcher",
    };

    await element.prefetchHTML(request, { cacheDuration: 3600 });
    const cached = await element.fetchHTML(request, {
        cache: true,
        cacheDuration: 3600,
    });

    assert.equal(cached, "<p>cached</p>");
    assert.equal(requests.length, 1);
    assert.match(requests[0].url, /view=summary/);
    assert.deepEqual(requests[0].body.routeParameters, {
        system: "si",
        lang: "sl",
        researcherId: 57366,
    });

    await element.fetchHTML({
        ...request,
        queryParameters: {},
        routeParameters: {},
    }, {
        cache: true,
        cacheDuration: 3600,
    });

    assert.equal(requests.length, 2);
    assert.equal(requests[1].url, "/components");
    assert.deepEqual(requests[1].body.queryParameters, {});
    assert.deepEqual(requests[1].body.routeParameters, {});
});

test("bound refresh after disconnection is a synchronous no-op", () => {
    const element = new TestElement();
    element._app = makeApp();
    disconnect(element);
    element.querySelectorAll = () => assert.fail("Must not query detached markup");
    element._refreshBoundElements("attr.weight");
});
