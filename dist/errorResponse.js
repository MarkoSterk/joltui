export function createErrorResponse(context = { method: "" }, response) {
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
export async function captureErrorResponse(response, context) {
    const details = createErrorResponse(context, response);
    try {
        details.body = await response.text();
    }
    catch (error) {
        details.bodyReadError = error;
        return details;
    }
    const mediaType = details.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
    if (mediaType === "application/json" || mediaType?.endsWith("+json")) {
        try {
            details.data = JSON.parse(details.body);
        }
        catch {
            // The original body remains available even for malformed JSON.
        }
    }
    return details;
}
export class ResponseError extends Error {
    response;
    constructor(message, options) {
        super(message, options);
        this.response = options?.response ?? createErrorResponse();
    }
}
//# sourceMappingURL=errorResponse.js.map