/** Normal end-of-lifetime cancellation, not an application failure. */
export class ElementDisconnectedError extends Error {
    tagName;
    constructor(tagName) {
        super(`Element <${tagName}> disconnected before its operation completed.`);
        this.tagName = tagName;
        this.name = "ElementDisconnectedError";
    }
}
export function isElementCancellation(error) {
    const visited = new Set();
    while (error instanceof Error && !visited.has(error)) {
        if (error instanceof ElementDisconnectedError)
            return true;
        visited.add(error);
        error = error.cause;
    }
    return false;
}
/** Cancel this consumer's wait without cancelling shared underlying work. */
export function awaitWithSignal(work, signal) {
    return new Promise((resolve, reject) => {
        const onAbort = () => reject(signal.reason);
        if (signal.aborted) {
            reject(signal.reason);
        }
        else {
            signal.addEventListener("abort", onAbort, { once: true });
        }
        // Always observe work, including when the signal was already aborted.
        Promise.resolve(work).then(resolve, reject).finally(() => {
            signal.removeEventListener("abort", onAbort);
        });
    });
}
//# sourceMappingURL=cancellation.js.map