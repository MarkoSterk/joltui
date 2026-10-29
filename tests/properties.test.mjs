import assert from "node:assert/strict";
import test from "node:test";
import ts from "typescript";
import { fileURLToPath } from "node:url";
import { select, selectAll } from "../dist/properties.js";

test("select options typecheck on TypeScript auto-accessors", () => {
    const program = ts.createProgram([
        fileURLToPath(new URL("./fixtures/select-types.mts", import.meta.url)),
    ], {
        noEmit: true, strict: true, skipLibCheck: true,
        target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.NodeNext,
        exactOptionalPropertyTypes: true,
    });
    const diagnostics = ts.getPreEmitDiagnostics(program);
    assert.equal(diagnostics.length, 0, diagnostics.map(diagnostic =>
        ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")).join("\n"));
});

// Minimal descendant-query tree, following the existing DOM stub test pattern.
class ElementStub {
    constructor(id, ...children) {
        this.id = id;
        this.children = children;
    }
    querySelectorAll(selector) {
        return this.children.flatMap(child => [
            ...(selector === `#${child.id}` ? [child] : []),
            ...child.querySelectorAll(selector),
        ]);
    }
    querySelector(selector) {
        return this.querySelectorAll(selector)[0] ?? null;
    }
}

function accessor(decorator, selector, options) {
    return decorator(selector, options)({}, {
        kind: "accessor", name: "selected", static: false, private: false,
    });
}

for (const decorator of [select, selectAll]) {
    const many = decorator === selectAll;
    const expected = elements => many ? elements : elements[0] ?? null;

    test(`${decorator.name}: default and false remain local without accessing app`, () => {
        const local = new ElementStub("match");
        const host = new ElementStub("host", local);
        Object.defineProperty(host, "app", { get() { throw new Error("App accessed"); } });
        for (const options of [undefined, {}, { global: false }]) {
            assert.deepEqual(accessor(decorator, "#match", options).get.call(host), expected([local]));
        }
    });

    test(`${decorator.name}: global searches app siblings and excludes other apps`, () => {
        const outside = new ElementStub("match");
        const sibling = new ElementStub("match");
        const local = new ElementStub("match");
        const host = new ElementStub("host", local);
        const container = new ElementStub("container", sibling, host);
        const otherApp = new ElementStub("other-app", outside);
        const documentRoot = new ElementStub("document", otherApp, container);
        host.app = { container };
        assert.equal(documentRoot.querySelector("#match"), outside);
        const selected = accessor(decorator, "#match", { global: true, required: true });
        assert.deepEqual(selected.get.call(host), expected([sibling, local]));
        container.children.shift();
        assert.deepEqual(selected.get.call(host), expected([local]));
        host.children = [];
        assert.throws(() => selected.get.call(host), /required|Required/);
        assert.deepEqual(accessor(decorator, "#match", { global: true }).get.call(host), expected([]));
        assert.throws(() => selected.set.call(host, outside), /read-only/);
    });

    test(`${decorator.name}: required uses the selected scope`, () => {
        const sibling = new ElementStub("match");
        const host = new ElementStub("host");
        host.app = { container: new ElementStub("container", sibling, host) };
        assert.throws(() => accessor(decorator, "#match", { required: true }).get.call(host), /required|Required/);
        assert.deepEqual(accessor(decorator, "#missing").get.call(host), expected([]));
        assert.deepEqual(accessor(decorator, "#match", { global: true }).get.call(host), expected([sibling]));
    });

    test(`${decorator.name}: global requires an initialized app`, () => {
        const host = new ElementStub("host");
        const selected = accessor(decorator, "#match", { global: true });
        assert.throws(() => selected.get.call(host), /initialized application/);
        const error = new Error("Application container is not initialized.");
        host.app = { get container() { throw error; } };
        assert.throws(() => selected.get.call(host), error);
    });
}
