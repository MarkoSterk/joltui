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
const { default: ErrorHandler, handles } = await import("../dist/errorHandler.js");
const { DependencyLoadError, lazy } = await import("../dist/lazy.js");
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

test("cache clearing removes every stored key and remains explicitly controlled", () => {
    const app = new App({ appName: "Cache tests", dataStructure: { user: "Alice" } });
    app._container = new EventTarget();
    const key = app.getTemplateCacheKey("profile-card");
    app.setCachedTemplate(key, "profile", 60);
    app.setCachedTemplate("custom-key", "custom", 60);
    app.setData("user", "Bob");
    assert.equal(app.getTemplateCacheKey("profile-card"), key);
    assert.equal(app.getCachedTemplate(key), "profile");
    app.clearTemplatesCache();
    assert.equal(app.getCachedTemplate(key), null);
    assert.equal(app.getCachedTemplate("custom-key"), null);
    app.clearTemplatesCache();
    app.setCachedTemplate(key, "new profile", 60);
    assert.equal(app.getCachedTemplate(key), "new profile");
});

test("clearing preserves existing callers' results without repopulating the cache", async () => {
    const app = makeApp();
    const gate = deferred();
    const first = app.getOrSetCachedTemplate("shared", 60, () => gate.promise);
    const second = app.getOrSetCachedTemplate("shared", 60, () => assert.fail("must share"));
    await Promise.resolve();
    app.clearTemplatesCache();
    gate.resolve("old HTML");
    assert.deepEqual(await Promise.all([first, second]), ["old HTML", "old HTML"]);
    assert.equal(app.getCachedTemplate("shared"), null);
});

for (const fails of [false, true]) {
    test(`obsolete ${fails ? "failed" : "successful"} request cannot remove a newer pending request`, async () => {
        const app = makeApp();
        const oldGate = deferred();
        const newGate = deferred();
        const older = app.getOrSetCachedTemplate("shared", 60, () => oldGate.promise);
        const oldOutcome = fails ? assert.rejects(older, /old failure/) : older;
        await Promise.resolve();
        app.clearTemplatesCache();
        let newCalls = 0;
        const newer = app.getOrSetCachedTemplate("shared", 60, () => {
            newCalls++;
            return newGate.promise;
        });
        await Promise.resolve();
        assert.equal(newCalls, 1);
        if (fails) oldGate.reject(new Error("old failure"));
        else oldGate.resolve("old HTML");
        await oldOutcome;
        assert.equal(app.getCachedTemplate("shared"), null);
        const joined = app.getOrSetCachedTemplate("shared", 60, () => assert.fail("must share new request"));
        newGate.resolve("new HTML");
        assert.deepEqual(await Promise.all([newer, joined]), ["new HTML", "new HTML"]);
        assert.equal(app.getCachedTemplate("shared"), "new HTML");
    });
}

test("late requests from multiple clears cannot overwrite a fresh cached result", async () => {
    const app = makeApp();
    const firstGate = deferred();
    const secondGate = deferred();
    const first = app.getOrSetCachedTemplate("shared", 60, () => firstGate.promise);
    app.clearTemplatesCache();
    const second = app.getOrSetCachedTemplate("shared", 60, () => secondGate.promise);
    app.clearTemplatesCache();
    assert.equal(await app.getOrSetCachedTemplate("shared", 60, () => "fresh HTML"), "fresh HTML");
    secondGate.resolve("second HTML");
    firstGate.resolve("first HTML");
    assert.deepEqual(await Promise.all([first, second]), ["first HTML", "second HTML"]);
    assert.equal(app.getCachedTemplate("shared"), "fresh HTML");
});

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

test("data listeners consume rerender cancellation", async () => {
    const app = makeApp();
    app._dataStructure.set("field", null);

    let listener;
    app.addEventListener = (_type, registered) => {
        listener = registered;
    };

    const element = new TestElement();
    element._app = app;
    Object.defineProperty(element, "dataField", {
        configurable: true,
        get: () => "field",
    });

    let rerenders = 0;
    element.rerender = async () => {
        rerenders++;
        throw new ElementDisconnectedError(element.tagName);
    };

    app.registerDataListener(element);
    listener({ detail: { field: "field" } });
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(rerenders, 1);

    disconnect(element);
    listener({ detail: { field: "field" } });
    assert.equal(rerenders, 1);
});

test("error handlers use constructor identity instead of constructor names", async () => {
    class FirstError extends Error {}
    class SecondError extends Error {}

    Object.defineProperty(FirstError, "name", { value: "e" });
    Object.defineProperty(SecondError, "name", { value: "e" });

    class ConstructorHandler extends ErrorHandler {
        handled = [];
        first(error) {
            this.handled.push(error);
        }
    }

    handles(FirstError)(
        ConstructorHandler.prototype.first,
        {
            kind: "method",
            name: "first",
            static: false,
            private: false,
        },
    );

    const handler = new ConstructorHandler(makeApp());
    const second = new SecondError();
    const first = new FirstError();

    assert.equal(await handler.handle(second), false);
    assert.equal(await handler.handle(first), true);
    assert.deepEqual(handler.handled, [first]);
});

test("lazy dependency failures include an optional dependency name", async () => {
    const cause = new Error("Import failed");
    const dependency = lazy(
        async () => {
            throw cause;
        },
        "researcher page dependencies",
    );

    assert.equal(dependency.name, "researcher page dependencies");

    await assert.rejects(
        dependency.load(),
        error => {
            assert.ok(error instanceof DependencyLoadError);
            assert.equal(
                error.dependencyName,
                "researcher page dependencies",
            );
            assert.match(
                error.message,
                /researcher page dependencies/,
            );
            assert.equal(error.cause, cause);
            return true;
        },
    );
});

test("bound refresh after disconnection is a synchronous no-op", () => {
    const element = new TestElement();
    element._app = makeApp();
    disconnect(element);
    element.querySelectorAll = () => assert.fail("Must not query detached markup");
    element._refreshBoundElements("attr.weight");
});

test("shorthand conversion changes attribute names while preserving SVG, values, and text", () => {
    const element = new TestElement();
    const input = `<svg xmlns:xlink="http://www.w3.org/1999/xlink"><use xlink:href="#icon" @click = "choose" :item-id='12' /></svg>
<button title='literal @click="wrong" :value=other > text' data-note="@focus=wrong :id=wrong" data-url=/search?q=:id=1 @focus=focus :enabled>Text @click=wrong :value=wrong</button>`;
    const expected = `<svg xmlns:xlink="http://www.w3.org/1999/xlink"><use xlink:href="#icon" jolt-click = "choose" data-jolt-item-id='12' /></svg>
<button title='literal @click="wrong" :value=other > text' data-note="@focus=wrong :id=wrong" data-url=/search?q=:id=1 jolt-focus=focus data-jolt-enabled>Text @click=wrong :value=wrong</button>`;
    assert.equal(element._parseStringTemplate(input), expected);
    assert.equal(element._parseStringTemplate(expected), expected);
});

test("shorthand conversion preserves comments, CDATA, and raw text contents", () => {
    const element = new TestElement();
    const literal = `<button @click="literal" :value="literal">`;
    const unchanged = `<!DOCTYPE html><!-- ${literal} --><![CDATA[${literal}]]>` +
        ["script", "style", "textarea", "title", "xmp", "iframe", "noembed", "noframes"]
            .map(tag => `<${tag}>${literal}</${tag}>`).join("");
    assert.equal(
        element._parseStringTemplate(unchanged + `<button @click="real" :value="real"></button>`),
        unchanged + `<button jolt-click="real" data-jolt-value="real"></button>`,
    );
    assert.equal(element._parseStringTemplate(`<SCRIPT>${literal}</SCRIPT><i :id="1">`), `<SCRIPT>${literal}</SCRIPT><i data-jolt-id="1">`);
});

test("shorthand attributes following quoted values convert without intervening whitespace", () => {
    const element = new TestElement();
    const input = `<fieldset class="mb-3 ":group="classification.science"><input type="checkbox"data-key="1"@change="handleChange"/><button title='literal @click="keep" :group=keep'@click="handleChange":item-id='1'>Change</button></fieldset>`;
    const expected = `<fieldset class="mb-3 "data-jolt-group="classification.science"><input type="checkbox"data-key="1"jolt-change="handleChange"/><button title='literal @click="keep" :group=keep'jolt-click="handleChange"data-jolt-item-id='1'>Change</button></fieldset>`;
    assert.equal(element._parseStringTemplate(input), expected);
    assert.equal(element._parseStringTemplate(expected), expected);
});

test("server facet markup converts every repeated event and group attribute", () => {
    const element = new TestElement();
    for (const separator of [" ", "\n    ", ""]) {
        const groups = ["classification.science", "rsr.type", "rsr.rsrttl", "rsr.sex", "bibgroup", "rsr.statadm"];
        const input = `<aside aria-label="Filtri">` + groups.map(group =>
            `<fieldset class="mb-3 "${separator}:group="${group}">` +
            `<legend title="Veda" data-name="Veda">Veda</legend>` +
            `<div class="form-check mb-0"><input class="form-check-input all-js" type="checkbox" value="all" checked id="facet-${group}-all" @change="handleChange" /></div>` +
            ["1", "2", "ZZ"].map(value =>
                `<div class="form-check mb-0 val-js"><input class="form-check-input" type="checkbox" value="${value}" id="facet-${group}-${value}" data-key="${value}"${separator}@change="handleChange" /><label data-key="${value}"><span class="f-name-js">Naravoslovje</span><span class="count"></span></label></div>`,
            ).join("") + `</fieldset>`,
        ).join("") + `</aside>`;
        const output = element._parseStringTemplate(input);
        assert.equal((output.match(/jolt-change="handleChange"/g) ?? []).length, 24);
        assert.equal((output.match(/data-jolt-group=/g) ?? []).length, 6);
        assert.ok(!output.includes("@change="));
        assert.ok(!output.includes(":group="));
    }
});

test("a stray quote on the transfer button does not prevent event conversion", () => {
    const element = new TestElement();
    for (const stray of ['"', ' "=""']) {
        const input = `<div><input @change="selectAll" type="checkbox"><button @click="deleteChange" :id="-1">Delete</button><button @click="validateChanges" id="validateBtn">Validate</button><button class="btn btn-primary btn-sm mb-1" @click="transferChanges"${stray} id="transferBtn" title="Prenos">Transfer</button><button @click="afterTransfer">Next</button></div>`;
        const expected = input.replaceAll("@change=", "jolt-change=")
            .replaceAll("@click=", "jolt-click=").replaceAll(":id=", "data-jolt-id=");
        assert.equal(element._parseStringTemplate(input), expected);
    }
});

test("quotes in attribute names and unquoted values do not consume subsequent tags", () => {
    const element = new TestElement();
    const input = `<button data-label=can't @click="transferChanges">Transfer</button><input ' @change="handleChange"><svg><use xlink:href="#icon" /></svg><button title="literal > @click='keep' :id=keep" @click="next">Next</button>`;
    const expected = `<button data-label=can't jolt-click="transferChanges">Transfer</button><input ' jolt-change="handleChange"><svg><use xlink:href="#icon" /></svg><button title="literal > @click='keep' :id=keep" jolt-click="next">Next</button>`;
    assert.equal(element._parseStringTemplate(input), expected);
});

test("shorthand conversion preserves incomplete markup and does not consume later tags", () => {
    const element = new TestElement();
    assert.equal(element._parseStringTemplate(`2 < 3 <i\n@focus = 'go'\t:value = "a > b">`), `2 < 3 <i\njolt-focus = 'go'\tdata-jolt-value = "a > b">`);
    for (const input of [`<!-- <i :id=1>`, `<script><i :id=1>`, `<i :id="unfinished`, `<plaintext><i :id=1>`]) {
        assert.equal(element._parseStringTemplate(input), input);
    }
});

test("decorated handler overrides replace base handlers and preserve unrelated inherited handlers", async () => {
    class FirstError extends Error {}
    class SecondError extends Error {}
    const calls = [];
    class Base extends ErrorHandler {
        first() { calls.push("base"); }
        second() { calls.push("second"); }
    }
    handles(FirstError)(Base.prototype.first, { name: "first" });
    handles(SecondError)(Base.prototype.second, { name: "second" });
    class Derived extends Base {
        first() { calls.push("derived"); }
    }
    handles(FirstError)(Derived.prototype.first, { name: "first" });
    class Leaf extends Derived {}
    const handler = new Leaf(makeApp());
    assert.equal(await handler.handle(new FirstError()), true);
    assert.equal(await handler.handle(new SecondError()), true);
    assert.deepEqual(calls, ["derived", "second"]);
});

test("undecorated method and accessor overrides suppress inherited handler metadata", async () => {
    class Base extends ErrorHandler { handleFailure() { assert.fail("base handler was shadowed"); } }
    handles(Error)(Base.prototype.handleFailure, { name: "handleFailure" });
    class MethodOverride extends Base { handleFailure() { assert.fail("undecorated method is not a handler"); } }
    class AccessorOverride extends Base { get handleFailure() { assert.fail("discovery must not invoke getters"); } }
    assert.equal(await new MethodOverride(makeApp()).handle(new Error()), false);
    assert.equal(await new AccessorOverride(makeApp()).handle(new Error()), false);
});

test("an override can change the handled error type without inheriting the old registration", async () => {
    class FirstError extends Error {}
    class SecondError extends Error {}
    const calls = [];
    class Base extends ErrorHandler { handleFailure() { assert.fail("base handler was shadowed"); } }
    handles(FirstError)(Base.prototype.handleFailure, { name: "handleFailure" });
    class Derived extends Base { handleFailure(error) { calls.push(error); } }
    handles(SecondError)(Derived.prototype.handleFailure, { name: "handleFailure" });
    const handler = new Derived(makeApp());
    assert.equal(await handler.handle(new FirstError()), false);
    const second = new SecondError();
    assert.equal(await handler.handle(second), true);
    assert.deepEqual(calls, [second]);
});

test("distinct effective methods still cannot register the same error type", () => {
    class Base extends ErrorHandler { first() {} }
    handles(Error)(Base.prototype.first, { name: "first" });
    class Derived extends Base { second() {} }
    handles(Error)(Derived.prototype.second, { name: "second" });
    assert.throws(() => new Derived(makeApp()), /already registered/);
});

for (const asynchronous of [false, true]) {
    test(`${asynchronous ? "asynchronous" : "synchronous"} markup failure preserves its cause for error handlers`, async () => {
        class ServiceError extends Error {}
        const original = new ServiceError("Service failed", { cause: new Error("Connection failed") });
        const element = new TestElement();
        element.markup = asynchronous
            ? async () => { throw original; }
            : () => { throw original; };
        let renderedError;
        await assert.rejects(element._markup(), error => {
            assert.equal(error.name, "RenderError");
            assert.equal(error.cause, original);
            assert.equal(error.cause.stack, original.stack);
            renderedError = error;
            return true;
        });
        const handled = [];
        class Handler extends ErrorHandler {
            service(error) { handled.push(error); }
        }
        handles(ServiceError)(Handler.prototype.service, { name: "service" });
        const handler = new Handler(makeApp());
        const { ElementInitializationError } = await import("../dist/customElement.js");
        assert.equal(await handler.handle(new ElementInitializationError(element, { cause: renderedError })), true);
        assert.deepEqual(handled, [original]);
    });
}

test("markup preserves non-Error causes and passes through cancellation and missing markup errors", async () => {
    const element = new TestElement();
    const reason = { message: "Application failure" };
    element.markup = () => { throw reason; };
    await assert.rejects(element._markup(), error => error.name === "RenderError" && error.cause === reason);
    const cancellation = new ElementDisconnectedError(element.tagName);
    element.markup = () => { throw cancellation; };
    await assert.rejects(element._markup(), error => error === cancellation);
    element.markup = null;
    await assert.rejects(element._markup(), error => error.name === "MissingMarkupMethod");
});

function recordRenderCommits(element) {
    const commits = [];
    Object.defineProperty(element, "innerHTML", {
        get: () => commits.at(-1) ?? "",
        set: html => {
            commits.push(html);
            element._templateSettings.dataBinds.set(html, { id: html });
        },
    });
    return commits;
}

for (const firstMethod of ["render", "rerender"]) {
    for (const secondMethod of ["render", "rerender"]) {
        test(`${secondMethod} supersedes pending ${firstMethod} without stale HTML or binding changes`, async () => {
            const element = new TestElement();
            element._app = makeApp();
            element.server = false;
            const commits = recordRenderCommits(element);
            const oldMarkup = deferred();
            const started = deferred();
            element._templateSettings.dataBinds.set("existing", { id: "existing" });
            element.markup = () => { started.resolve(); return oldMarkup.promise; };
            const older = element[firstMethod]();
            await started.promise;
            assert.ok(element._templateSettings.dataBinds.has("existing"));
            element.markup = () => "new HTML";
            await element[secondMethod]();
            await older;
            const currentBindings = element._templateSettings.dataBinds;
            oldMarkup.resolve("old HTML");
            await new Promise(resolve => setImmediate(resolve));
            assert.deepEqual(commits, ["new HTML"]);
            assert.equal(element._templateSettings.dataBinds, currentBindings);
            assert.deepEqual([...currentBindings.keys()], ["new HTML"]);
            assert.equal(element.abortSignal.aborted, false);
            assert.equal(element.app.errors, 0);
        });
    }
}

test("late markup failures from an obsolete render do not report errors or poison later renders", async () => {
    const element = new TestElement();
    element._app = makeApp();
    element.server = false;
    const oldMarkup = deferred();
    const started = deferred();
    element.markup = () => { started.resolve(); return oldMarkup.promise; };
    const older = element.rerender();
    await started.promise;
    element.markup = () => "new HTML";
    await element.rerender();
    await older;
    oldMarkup.reject(new Error("obsolete failure"));
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(element.app.errors, 0);
    assert.equal(element._abort, false);
    element.markup = () => "next HTML";
    await element.rerender();
    assert.equal(element.innerHTML, "next HTML");
});

for (const stage of [Lifecycle.BEFORE_RERENDER, Lifecycle.AFTER_RERENDER]) {
    test(`supersession during ${stage} skips remaining obsolete hooks`, async () => {
        const entered = deferred();
        const gate = deferred();
        class HookElement extends TestElement {
            calls = 0;
            tails = 0;
            first() {
                if (++this.calls === 1) { entered.resolve(); return gate.promise; }
            }
            tail() { this.tails++; }
        }
        lifecycle(stage)(HookElement.prototype.first, { name: "first" });
        lifecycle(stage)(HookElement.prototype.tail, { name: "tail" });
        const element = new HookElement();
        element._app = makeApp();
        element.server = false;
        element.markup = () => "first HTML";
        const older = element.rerender();
        await entered.promise;
        element.markup = () => "new HTML";
        await element.rerender();
        await older;
        gate.resolve();
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(element.innerHTML, "new HTML");
        assert.equal(element.tails, 1);
        assert.equal(element.app.errors, 0);
    });
}

test("supersession while waiting for descendants skips obsolete completion hooks", async () => {
    const entered = deferred();
    const child = deferred();
    class Parent extends TestElement {
        completions = 0;
        after() { this.completions++; }
    }
    lifecycle(Lifecycle.AFTER_RERENDER)(Parent.prototype.after, { name: "after" });
    const element = new Parent();
    element._app = makeApp();
    element.server = false;
    element.markup = () => "first HTML";
    element._waitForSubelements = () => { entered.resolve(); return child.promise; };
    const older = element.rerender();
    await entered.promise;
    element._waitForSubelements = async () => {};
    element.markup = () => "new HTML";
    await element.rerender();
    await older;
    child.resolve();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(element.completions, 1);
    assert.equal(element.innerHTML, "new HTML");
});

test("superseding a render leaves its shared cached request available to the latest render", async t => {
    const started = deferred();
    const response = deferred();
    let requests = 0;
    t.mock.method(globalThis, "fetch", async (_url, options) => {
        requests++;
        assert.equal(options.signal, null);
        started.resolve();
        return response.promise;
    });
    const element = new TestElement();
    element._app = makeApp();
    element.cached = true;
    const commits = recordRenderCommits(element);
    const older = element.rerender();
    await started.promise;
    const newer = element.rerender();
    await older;
    response.resolve(new Response("shared HTML"));
    await newer;
    assert.equal(requests, 1);
    assert.deepEqual(commits, ["shared HTML"]);
    assert.equal(element.app.getCachedTemplate("shared"), "shared HTML");
    assert.equal(element.abortSignal.aborted, false);
});

test("rapid app data events only commit the latest rerender", async () => {
    const app = new App({ appName: "Render tests", dataStructure: { profile: "old" } });
    app._container = new EventTarget();
    const element = new TestElement();
    element._app = app;
    element.server = false;
    Object.defineProperty(element, "dataField", { value: "profile" });
    element.hashId = "profile";
    const commits = recordRenderCommits(element);
    const first = deferred();
    const started = deferred();
    element.markup = () => {
        const value = app.getData("profile");
        if (value === "old") { started.resolve(); return first.promise; }
        return value;
    };
    app.registerDataListener(element);
    app.setData("profile", "old");
    await started.promise;
    app.setData("profile", "new");
    await new Promise(resolve => setImmediate(resolve));
    first.resolve("old");
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(commits, ["new"]);
    app.removeDataListener(element);
});

function validationErrorType() {
    const marker = Symbol("validationError");
    class InternalError extends Error {
        [marker] = true;
    }
    function ValidationError(message) { return new InternalError(message); }
    Object.defineProperty(ValidationError, Symbol.hasInstance, {
        value: error => Boolean(error?.[marker]),
    });
    return ValidationError;
}

test("instanceof fallback recognizes factory errors through nested causes", async () => {
    const ValidationError = validationErrorType();
    class Handler extends ErrorHandler {
        handled = [];
        validation(error) { this.handled.push(error); }
    }
    handles(ValidationError)(Handler.prototype.validation, { name: "validation" });
    const handler = new Handler(makeApp());
    const error = new ValidationError("Invalid value");
    assert.notEqual(error.constructor, ValidationError);
    assert.ok(error instanceof ValidationError);
    assert.equal(await handler.handle(new Error("Unrelated")), false);
    assert.equal(await handler.handle(new Error("Outer", {
        cause: new Error("Inner", { cause: error }),
    })), true);
    assert.deepEqual(handler.handled, [error]);
});

for (const inherited of [false, true]) {
    test(`constructor matches precede instanceof fallback (inherited: ${inherited})`, async () => {
        class ParentError extends Error {}
        class ChildError extends ParentError {}
        class Fallback {
            static [Symbol.hasInstance]() { assert.fail("Fallback must not run"); }
        }
        class Handler extends ErrorHandler {
            fallback() { assert.fail("Fallback must not win"); }
            exact(error) { this.handled = error; }
        }
        handles(Fallback)(Handler.prototype.fallback, { name: "fallback" });
        handles(inherited ? ParentError : ChildError)(Handler.prototype.exact, { name: "exact" });
        const handler = new Handler(makeApp());
        const error = new ChildError();
        assert.equal(await handler.handle(error), true);
        assert.equal(handler.handled, error);
    });
}

test("fallback uses discovery order and precedes cause traversal", async () => {
    const ValidationError = validationErrorType();
    class CauseError extends Error {}
    class OtherValidation {
        static [Symbol.hasInstance](error) { return error instanceof ValidationError; }
    }
    class Handler extends ErrorHandler {
        first(error) { this.handled = error; }
        second() { assert.fail("Only the first fallback should run"); }
        cause() { assert.fail("A matching outer error takes precedence"); }
    }
    handles(ValidationError)(Handler.prototype.first, { name: "first" });
    handles(OtherValidation)(Handler.prototype.second, { name: "second" });
    handles(CauseError)(Handler.prototype.cause, { name: "cause" });
    const handler = new Handler(makeApp());
    const error = new ValidationError("Invalid value");
    error.cause = new CauseError();
    assert.equal(await handler.handle(error), true);
    assert.equal(handler.handled, error);
});

test("fallback awaits handlers and propagates their failures", async () => {
    const ValidationError = validationErrorType();
    const failure = new Error("Handler failed");
    class Handler extends ErrorHandler {
        async validation() {
            await Promise.resolve();
            throw failure;
        }
    }
    handles(ValidationError)(Handler.prototype.validation, { name: "validation" });
    await assert.rejects(new Handler(makeApp()).handle(new ValidationError()), error => error === failure);
});
