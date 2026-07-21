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
        try {
            response = await fetch(input, {
                ...init,
                method,
            });
        }
        catch (error) {
            throw new NetworkError(`Failed to execute ${method} request ` +
                `to '${this.getRequestUrl(input)}'.`, { cause: error });
        }
        if (!response.ok) {
            throw new HttpRequestError(method, response);
        }
        let responseText;
        try {
            responseText = await response.text();
        }
        catch (error) {
            throw new JsonResponseError(method, response, { cause: error });
        }
        if (responseText.trim().length === 0) {
            return null;
        }
        try {
            return JSON.parse(responseText);
        }
        catch (error) {
            throw new JsonResponseError(method, response, { cause: error });
        }
    }
    static getRequestUrl(input) {
        if (input instanceof Request) {
            return input.url;
        }
        return String(input);
    }
}
//# sourceMappingURL=requestHelper.js.map