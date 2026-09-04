import assert from "node:assert/strict";
import test from "node:test";

// lifecycle cancelation tests
globalThis.HTMLElement = class extends EventTarget {
    tagName = "TEST-ELEMENT";
    isConnected = true;
    parentElement = null;
    innerHTML = "";
    attributesMap = new Map();
    getAttribute(name) { return this.attributesMap.get(name) ?? null; }
    hasAttribute(name) { return this.attributesMap.has(name); }
    setAttribute(name, value) { this.attributesMap.set(name, value); }
    closest() { return { app: this._app }; }
    querySelectorAll() { return []; }
};
globalThis.Element = globalThis.HTMLElement;
globalThis.Document = class {};
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
    _fetchHTML = signal => this.fetchHTML({ tagName: "test-element", groupName: "default" }, signal);
}

function disconnect(element) {
    element.isConnected = false;
    element.disconnectedCallback();
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

test("bound refresh after disconnection is a synchronous no-op", () => {
    const element = new TestElement();
    element._app = makeApp();
    disconnect(element);
    element.querySelectorAll = () => assert.fail("Must not query detached markup");
    element._refreshBoundElements("attr.weight");
});
