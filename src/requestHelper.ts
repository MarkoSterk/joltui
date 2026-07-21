import {
    HttpRequestError,
    JsonResponseError,
    NetworkError,
} from "./errors.js";

export type RequestOptions = Omit<
    RequestInit,
    "method"
>;

type HttpMethod =
    | "GET"
    | "POST"
    | "PUT"
    | "PATCH"
    | "DELETE";

export default class RequestHelper {
    static get<TResponse = unknown>(
        input: RequestInfo | URL,
        init?: RequestOptions,
    ): Promise<TResponse> {
        return this.request<TResponse>(
            "GET",
            input,
            init,
        );
    }

    static post<TResponse = unknown>(
        input: RequestInfo | URL,
        init?: RequestOptions,
    ): Promise<TResponse> {
        return this.request<TResponse>(
            "POST",
            input,
            init,
        );
    }

    static put<TResponse = unknown>(
        input: RequestInfo | URL,
        init?: RequestOptions,
    ): Promise<TResponse> {
        return this.request<TResponse>(
            "PUT",
            input,
            init,
        );
    }

    static patch<TResponse = unknown>(
        input: RequestInfo | URL,
        init?: RequestOptions,
    ): Promise<TResponse> {
        return this.request<TResponse>(
            "PATCH",
            input,
            init,
        );
    }

    static delete<TResponse = unknown>(
        input: RequestInfo | URL,
        init?: RequestOptions,
    ): Promise<TResponse> {
        return this.request<TResponse>(
            "DELETE",
            input,
            init,
        );
    }

    protected static async request<
        TResponse = unknown,
    >(
        method: HttpMethod,
        input: RequestInfo | URL,
        init?: RequestOptions,
    ): Promise<TResponse> {
        let response: Response;

        try {
            response = await fetch(input, {
                ...init,
                method,
            });
        } catch (error: unknown) {
            throw new NetworkError(
                `Failed to execute ${method} request ` +
                `to '${this.getRequestUrl(input)}'.`,
                { cause: error },
            );
        }

        if (!response.ok) {
            throw new HttpRequestError(
                method,
                response,
            );
        }

        let responseText: string;

        try {
            responseText = await response.text();
        } catch (error: unknown) {
            throw new JsonResponseError(
                method,
                response,
                { cause: error },
            );
        }

        if (responseText.trim().length === 0) {
            return null as TResponse;
        }

        try {
            return JSON.parse(responseText) as TResponse;
        } catch (error: unknown) {
            throw new JsonResponseError(
                method,
                response,
                { cause: error },
            );
        }
    }

    protected static getRequestUrl(
        input: RequestInfo | URL,
    ): string {
        if (input instanceof Request) {
            return input.url;
        }

        return String(input);
    }
}
