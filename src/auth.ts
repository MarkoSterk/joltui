import App from "./app.js";
export default class Authenticator<TApp extends App = App> {
    constructor(protected readonly app: TApp) {}
}
export class AuthenticationError extends Error {}
export class AuthorizationError extends Error {}
