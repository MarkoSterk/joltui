import { select, selectAll } from "../../dist/properties.js";

class Selections extends HTMLElement {
    @select<HTMLDivElement>("div", { required: true })
    accessor local!: HTMLDivElement;

    @select<HTMLDivElement>("div", { required: true, global: true })
    accessor globalRequired!: HTMLDivElement;

    @select<HTMLDivElement>("div", { global: true })
    accessor globalOptional!: HTMLDivElement | null;

    @select<HTMLDivElement>("div", { global: false })
    accessor localOptional!: HTMLDivElement | null;

    @selectAll<HTMLDivElement>("div", { required: true, global: true })
    accessor all!: NodeListOf<HTMLDivElement>;

    @selectAll<HTMLDivElement>("div", { global: false })
    accessor allLocal!: NodeListOf<HTMLDivElement>;
}
