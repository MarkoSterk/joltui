import { Router } from "joltui";
import type FieldnotesApp from "./app.js";
import type { DemoUser } from "./types.js";

export default class BlogRouter extends Router<FieldnotesApp> {
    override isAuthenticated = async (): Promise<boolean> =>
        this.app.getData<DemoUser | null>("user") !== null;

    override checkUserRoles = async (
        roles: unknown[],
    ): Promise<boolean> => {
        const user = this.app.getData<DemoUser | null>("user");
        return Boolean(
            user && roles.includes(user.role),
        );
    };
}
