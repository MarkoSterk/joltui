/** A captured response, not a live Fetch Response or a one-shot body stream. */
export interface ErrorResponse {
    status: number;
    statusText: string;
    headers: Headers;
    body: string;
    url: string;
    redirected: boolean;
    type: ResponseType;
    ok: boolean;
    synthetic: boolean;
    method: string;
    tagName?: string;
    groupName?: string;
    data?: unknown;
    bodyReadError?: unknown;
}
export interface ResponseErrorOptions extends ErrorOptions {
    response?: ErrorResponse;
}
export type ErrorRequestContext = Pick<ErrorResponse, "method"> & Partial<Pick<ErrorResponse, "url" | "tagName" | "groupName">>;
export declare function createErrorResponse(context?: ErrorRequestContext, response?: Response): ErrorResponse;
/** Read once, retaining the HTTP failure even if reading its body fails. */
export declare function captureErrorResponse(response: Response, context: ErrorRequestContext): Promise<ErrorResponse>;
export declare class ResponseError extends Error {
    readonly response: ErrorResponse;
    constructor(message: string, options?: ResponseErrorOptions);
}
//# sourceMappingURL=errorResponse.d.ts.map