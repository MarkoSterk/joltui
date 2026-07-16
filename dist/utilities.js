export class NotImplementedError extends Error {
    constructor(method, options) {
        super(`Method '${method}' not implemented`, options);
        this.name = "NotImplementedError";
    }
}
//# sourceMappingURL=utilities.js.map