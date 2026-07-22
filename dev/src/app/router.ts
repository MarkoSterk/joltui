import { Router } from "joltui";
import type FieldnotesApp from "./app.js";
import type { DemoUser } from "./types.js";


const translations: Map<string, string> = new Map(Object.entries({
    "ecris.frontend.pages.stories": "True Stories",
    "ecris.frontend.pages.about": "About",
    "ecris.frontend.pages.drafts": "Drafts",
    "ecris.frontend.pages.signin": "Sign In",
    "ecris.frontend.pages.profile": "Profile",
    "ecris.frontend.pages.notFound": "404 - Page Not Found"
}));

export default class BlogRouter extends Router<FieldnotesApp> {
    override isAuthenticated(): boolean{
        return this.app.getData<DemoUser | null>("user") !== null;
    }

    override checkUserRoles(roles: unknown[]): boolean {
        const user = this.app.getData<DemoUser | null>("user");
        return Boolean(
            user && roles.includes(user.role),
        );
    };

    override titleGenerator(tagName: string, title: string | null): string {
        if(!title){
            return this.app.appName;
        }
        return translations.get(title) || title
    }
}
