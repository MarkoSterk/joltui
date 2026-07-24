import { component, CustomElement, layout } from "joltui";
import type FieldnotesApp from "../app";

@layout
@component({tagName: "profile-sublayout"})
export default class ProfileSublayout extends CustomElement<FieldnotesApp>{

    override markup = (): string => {
        return `
            <div class="row">
                <div class="col-3">
                    <a href="/profile">Profile</a>
                    <a href="/profile-billing">Billing</a>
                </div>
                <div id="subcontent" class="col-9">

                </div>
            </div>
        `
    }

}
