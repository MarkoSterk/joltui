import App, { type AppContainer } from "./app.js";
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

        const appElement = document.querySelector('[app-id]') as AppContainer;
        const app = appElement.app;

        try {
            response = await fetch(input, {
                ...init,
                method,
            });
        } catch (e: unknown) {
            const error = new NetworkError(
                `Failed to execute ${method} request ` +
                `to '${this.getRequestUrl(input)}'.`,
                { cause: e },
            );
            return await this.handleError(app, error);
        }

        if (!response.ok) {
            const error = new HttpRequestError(
                method,
                response,
            );
            return await this.handleError(app, error);
        }

        let responseText: string;

        try {
            responseText = await response.text();
        } catch (e: unknown) {
            const error = new JsonResponseError(
                method,
                response,
                { cause: e },
            );
            return await this.handleError(app, error);
        }

        if (responseText.trim().length === 0) {
            return null as TResponse;
        }

        try {
            return JSON.parse(responseText) as TResponse;
        } catch (e: unknown) {
            const error = new JsonResponseError(
                method,
                response,
                { cause: e },
            );
            return await this.handleError(app, error);
        }
    }

    protected static async handleError<
        TResponse = unknown,
    >(app: App, error: Error): Promise<TResponse>{
        if(!app){
            throw error;
        }
        await app.handleError(error);
        return null as TResponse;;
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
