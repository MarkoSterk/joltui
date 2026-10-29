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

export type ErrorRequestContext = Pick<ErrorResponse, "method"> &
    Partial<Pick<ErrorResponse, "url" | "tagName" | "groupName">>;

export function createErrorResponse(
    context: ErrorRequestContext = { method: "" },
    response?: Response,
): ErrorResponse {
    return {
        ...context,
        status: response?.status ?? 0,
        statusText: response?.statusText ?? "",
        headers: new Headers(response?.headers),
        body: "",
        url: response?.url || context.url || "",
        redirected: response?.redirected ?? false,
        type: response?.type ?? "error",
        ok: response?.ok ?? false,
        synthetic: !response,
    };
}

/** Read once, retaining the HTTP failure even if reading its body fails. */
export async function captureErrorResponse(
    response: Response,
    context: ErrorRequestContext,
): Promise<ErrorResponse> {
    const details = createErrorResponse(context, response);
    try {
        details.body = await response.text();
    } catch (error) {
        details.bodyReadError = error;
        return details;
    }
    const mediaType = details.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
    if (mediaType === "application/json" || mediaType?.endsWith("+json")) {
        try {
            details.data = JSON.parse(details.body);
        } catch {
            // The original body remains available even for malformed JSON.
        }
    }
    return details;
}

export class ResponseError extends Error {
    readonly response: ErrorResponse;

    constructor(message: string, options?: ResponseErrorOptions) {
        super(message, options);
        this.response = options?.response ?? createErrorResponse();
    }
}
