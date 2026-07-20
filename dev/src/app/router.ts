import {
    Router
} from "joltui";

import type DevApp from "./app.js";

type UserObject = {
    email: string,
    roles: string[]
}

export default class DevRouter extends Router<DevApp> {
    isAuthenticated = async (): Promise<boolean> => {
        const isAuthenticated = this.app.getData("user") != null;
        //console.log("User is authenticated: ", isAuthenticated)
        return isAuthenticated;
    }

    checkUserRoles = async(roles: unknown[]) =>{
        const user = this.app.getData<UserObject>("user");
        // console.log("Required user roles: ", roles);
        // console.log("User roles: ", user.roles);
        return roles.some(r=> user.roles.includes(r as string))
    }
}