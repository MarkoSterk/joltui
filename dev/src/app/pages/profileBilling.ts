import { component, CustomElement, page } from "joltui";
import type FieldnotesApp from "../app";
import ProfileSublayout from "../layouts/profileSublayout";

@page({path: "/profile-billing", title: "ecris.frontend.pages.profile", subLayouts: [
    {target: "#page-content", layout: ProfileSublayout}
], target: "#subcontent" })
@component({tagName: "profile-billing"})
export default class ProfileBilling extends CustomElement<FieldnotesApp>{

    override markup = (): string => {
        return `
            <h2>Profile billing</h2>
        `
    }

}
