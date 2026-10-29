import assert from 'node:assert/strict';
import test from 'node:test';
globalThis.HTMLElement = class extends EventTarget {};
globalThis.location = { pathname: '/page', search: '?id=1' };
const { default: CustomElement } = await import('../dist/customElement.js');
const { default: RequestHelper } = await import('../dist/requestHelper.js');
const errors = await import('../dist/errors.js');
const { captureErrorResponse } = await import('../dist/errorResponse.js');
const request = { tagName: 'employ-table', groupName: 'organization', queryParameters: {}, routeParameters: {}, attributes: {} };
function element() {
    const el = new CustomElement();
    el._app = { serverComponentsUrl: '/components', createQueryParametersString: () => '' };
    return el;
}
for (const [status, name] of [[400, 'ServerComponentBadRequestResponse'], [401, 'AuthenticationError'], [403, 'AuthorizationError'], [404, 'ServerComponentNotFound'], [418, 'HttpRequestError'], [500, 'InternalServerError'], [503, 'InternalServerError']]) {
    test('component preserves response and error type for ' + status, async t => {
        t.mock.method(globalThis, 'fetch', async () => new Response('<p>Error ID: abc-123</p>', { status, statusText: 'Failure', headers: { 'x-error-id': 'abc-123' } }));
        await assert.rejects(element()._requestHTML(request, null), error => {
            assert.ok(error instanceof errors[name]);
            assert.equal(error.response.body, '<p>Error ID: abc-123</p>');
            assert.equal(error.response.status, status);
            assert.equal(error.response.statusText, 'Failure');
            assert.equal(error.response.headers.get('x-error-id'), 'abc-123');
            assert.equal(error.response.url, '/components');
            assert.equal(error.response.method, 'POST');
            assert.equal(error.response.tagName, 'employ-table');
            assert.equal(error.response.groupName, 'organization');
            assert.equal(error.response.synthetic, false);
            return true;
        });
    });
}
test('RequestHelper preserves JSON and raw text for non-success statuses', async t => {
    globalThis.document = { querySelector: () => ({ app: null }) };
    for (const status of [302, 400, 401, 403, 404, 429, 500, 503]) {
        t.mock.method(globalThis, 'fetch', async () => new Response('{"id":"abc"}', { status, headers: { 'content-type': 'application/problem+json' } }));
        await assert.rejects(RequestHelper.get('/api'), error => {
            assert.ok(error instanceof errors.HttpRequestError);
            assert.equal(error.response.status, status);
            assert.equal(error.response.body, '{"id":"abc"}');
            assert.deepEqual(error.response.data, { id: 'abc' });
            assert.equal(error.response.method, 'GET');
            return true;
        });
    }
});
test('network errors have synthetic responses and retain the original cause', async t => {
    const cause = new TypeError('offline');
    t.mock.method(globalThis, 'fetch', async () => { throw cause; });
    globalThis.document = { querySelector: () => ({ app: null }) };
    for (const operation of [() => element()._requestHTML(request, null), () => RequestHelper.post('/api')]) {
        await assert.rejects(operation(), error => {
            assert.ok(error instanceof errors.NetworkError);
            assert.equal(error.cause, cause);
            assert.equal(error.response.synthetic, true);
            assert.equal(error.response.status, 0);
            assert.equal(error.response.body, '');
            assert.deepEqual([...error.response.headers], []);
            assert.equal(error.response.ok, false);
            assert.equal(error.response.type, 'error');
            assert.equal(error.response.method, 'POST');
            assert.ok(error.response.url);
            return true;
        });
    }
});
test('empty and malformed bodies do not replace the HTTP error', async () => {
    for (const body of ['', '{invalid']) {
        const details = await captureErrorResponse(new Response(body, { status: 500, headers: { 'content-type': 'application/json' } }), { method: 'POST' });
        assert.equal(details.body, body);
        assert.equal(details.status, 500);
        assert.equal(details.data, undefined);
    }
});
test('body read failures retain status and headers', async t => {
    const cause = new Error('stream failed');
    t.mock.method(globalThis, 'fetch', async () => {
        const response = new Response(null, { status: 500, headers: { 'x-error-id': 'abc' } });
        response.text = async () => { throw cause; };
        return response;
    });
    await assert.rejects(element()._requestHTML(request, null), error => {
        assert.ok(error instanceof errors.InternalServerError);
        assert.equal(error.response.bodyReadError, cause);
        assert.equal(error.response.headers.get('x-error-id'), 'abc');
        return true;
    });
});
test('cancellation while reading a failed response remains cancellation', async t => {
    const controller = new AbortController();
    const cause = new Error('cancelled');
    t.mock.method(globalThis, 'fetch', async () => {
        const response = new Response(null, { status: 500 });
        response.text = async () => { controller.abort(cause); throw cause; };
        return response;
    });
    await assert.rejects(element()._requestHTML(request, controller.signal), error => error === cause);
});
test('response URL, redirect flag and type are retained', async () => {
    const response = new Response('failure', { status: 502 });
    Object.defineProperties(response, { url: { value: 'https://example.test/final' }, redirected: { value: true } });
    const details = await captureErrorResponse(response, { method: 'GET', url: '/original' });
    assert.equal(details.url, 'https://example.test/final');
    assert.equal(details.redirected, true);
    assert.equal(details.type, response.type);
});

test('RequestHelper preserves malformed successful JSON and read failures', async t => {
    globalThis.document = { querySelector: () => ({ app: null }) };
    t.mock.method(globalThis, 'fetch', async () => new Response('{invalid', { status: 200 }));
    await assert.rejects(RequestHelper.get('/api'), error => {
        assert.ok(error instanceof errors.JsonResponseError);
        assert.equal(error.response.body, '{invalid');
        assert.equal(error.response.status, 200);
        assert.equal(error.response.synthetic, false);
        return true;
    });
    const cause = new Error('read failed');
    t.mock.method(globalThis, 'fetch', async () => {
        const response = new Response(null);
        response.text = async () => { throw cause; };
        return response;
    });
    await assert.rejects(RequestHelper.get('/api'), error => {
        assert.equal(error.response.bodyReadError, cause);
        assert.equal(error.cause, cause);
        return true;
    });
});
