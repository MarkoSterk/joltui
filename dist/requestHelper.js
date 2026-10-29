import { captureErrorResponse, createErrorResponse } from "./errorResponse.js";
import App, {} from "./app.js";
import { HttpRequestError, JsonResponseError, NetworkError, } from "./errors.js";
export default class RequestHelper {
    static get(input, init) {
        return this.request("GET", input, init);
    }
    static post(input, init) {
        return this.request("POST", input, init);
    }
    static put(input, init) {
        return this.request("PUT", input, init);
    }
    static patch(input, init) {
        return this.request("PATCH", input, init);
    }
    static delete(input, init) {
        return this.request("DELETE", input, init);
    }
    static async request(method, input, init) {
        let response;
        const appElement = document.querySelector('[app-id]');
        const app = appElement.app;
        try {
            response = await fetch(input, {
                ...init,
                method,
            });
        }
        catch (e) {
            const error = new NetworkError(`Failed to execute ${method} request ` +
                `to '${this.getRequestUrl(input)}'.`, {
                cause: e,
                response: createErrorResponse({ method, url: this.getRequestUrl(input) }),
            });
            return await this.handleError(app, error);
        }
        if (!response.ok) {
            const error = new HttpRequestError(method, response, {
                response: await captureErrorResponse(response, {
                    method, url: this.getRequestUrl(input),
                }),
            });
            return await this.handleError(app, error);
        }
        let responseText;
        try {
            responseText = await response.text();
        }
        catch (e) {
            const error = new JsonResponseError(method, response, {
                cause: e,
                response: {
                    ...createErrorResponse({ method, url: this.getRequestUrl(input) }, response),
                    bodyReadError: e,
                },
            });
            return await this.handleError(app, error);
        }
        if (responseText.trim().length === 0) {
            return null;
        }
        try {
            return JSON.parse(responseText);
        }
        catch (e) {
            const error = new JsonResponseError(method, response, {
                cause: e,
                response: {
                    ...createErrorResponse({ method, url: this.getRequestUrl(input) }, response),
                    body: responseText,
                },
            });
            return await this.handleError(app, error);
        }
    }
    static async handleError(app, error) {
        if (!app) {
            throw error;
        }
        await app.handleError(error);
        return null;
        ;
    }
    static getRequestUrl(input) {
        if (input instanceof Request) {
            return input.url;
        }
        return String(input);
    }
}
//# sourceMappingURL=requestHelper.js.map