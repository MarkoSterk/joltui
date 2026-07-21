export type RequestOptions = Omit<RequestInit, "method">;
type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
export default class RequestHelper {
    static get<TResponse = unknown>(input: RequestInfo | URL, init?: RequestOptions): Promise<TResponse>;
    static post<TResponse = unknown>(input: RequestInfo | URL, init?: RequestOptions): Promise<TResponse>;
    static put<TResponse = unknown>(input: RequestInfo | URL, init?: RequestOptions): Promise<TResponse>;
    static patch<TResponse = unknown>(input: RequestInfo | URL, init?: RequestOptions): Promise<TResponse>;
    static delete<TResponse = unknown>(input: RequestInfo | URL, init?: RequestOptions): Promise<TResponse>;
    protected static request<TResponse = unknown>(method: HttpMethod, input: RequestInfo | URL, init?: RequestOptions): Promise<TResponse>;
    protected static getRequestUrl(input: RequestInfo | URL): string;
}
export {};
//# sourceMappingURL=requestHelper.d.ts.map