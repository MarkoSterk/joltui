/** Normal end-of-lifetime cancellation, not an application failure. */
export declare class ElementDisconnectedError extends Error {
    constructor();
}
export declare function isElementCancellation(error: unknown): boolean;
/** Cancel this consumer's wait without cancelling shared underlying work. */
export declare function awaitWithSignal<T>(work: PromiseLike<T>, signal: AbortSignal): Promise<T>;
//# sourceMappingURL=cancellation.d.ts.map