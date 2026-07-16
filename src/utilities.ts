
export class NotImplementedError extends Error{
    constructor(method: string, options?: ErrorOptions){
        super(`Method '${method}' not implemented`, options);
        this.name = "NotImplementedError"

    }
}