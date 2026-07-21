import type App from "./app.js";
import type { CustomElement, CustomElementClass } from "./customElement.js";
export type ElementKind = "component" | "page" | "layout";
export type ComponentConfigs = {
    tagName: string;
    dataField?: string | null;
    groupName?: string | null;
    useServer?: boolean | null;
    cache?: boolean;
    cacheDuration?: number;
};
export type AuthenticationMetadata = Readonly<{
    authenticationRequired: boolean;
    rolesRequired: readonly unknown[];
}>;
export type PageConfigs<TApp extends App = App> = {
    path: string;
    layout?: CustomElementClass<TApp> | null;
    title?: string | null;
    target?: string | null;
    extras?: Record<string, unknown> | null;
    authentication?: AuthenticationMetadata | null;
    roles?: readonly unknown[] | null;
};
type BaseElementMetadata = Readonly<{
    tagName: string;
    dataField: string | null;
    groupName: string | null;
    useServer: boolean | null;
    cache: boolean;
    cacheDuration: number | null;
}>;
export type ComponentMetadata = BaseElementMetadata & Readonly<{
    kind: "component";
}>;
export type LayoutMetadata = BaseElementMetadata & Readonly<{
    kind: "layout";
}>;
export type PageMetadata<TApp extends App = App> = BaseElementMetadata & Readonly<{
    kind: "page";
    path: string;
    layout: CustomElementClass<TApp> | null;
    title: string | null;
    target: string | null;
    extras: Readonly<Record<string, unknown>>;
    authentication: {
        authenticationRequired: boolean;
        rolesRequired: unknown[];
    } | null;
    roles: unknown[] | null;
}>;
export type ElementMetadata<TApp extends App = App> = ComponentMetadata | LayoutMetadata | PageMetadata<TApp>;
type DecoratedElementClass<TApp extends App = App> = CustomElementClass<TApp, CustomElement<TApp>>;
export declare function setPageAuthenticationMetadata<TApp extends App = App>(elementClass: Function, authentication: AuthenticationMetadata): void;
export declare function component<TApp extends App = App>(configs: ComponentConfigs): <TClass extends DecoratedElementClass<TApp>>(elementClass: TClass, context: ClassDecoratorContext<TClass>) => void;
export declare function page<TApp extends App = App>(pathOrConfigs: string | PageConfigs<TApp>): <TClass extends DecoratedElementClass<TApp>>(elementClass: TClass, context: ClassDecoratorContext<TClass>) => void;
export declare function layout<TClass extends DecoratedElementClass>(elementClass: TClass, context: ClassDecoratorContext<TClass>): void;
export declare function getElementMetadata<TApp extends App = App>(elementClass: Function): ElementMetadata<TApp> | null;
export declare function requireElementMetadata<TApp extends App = App>(elementClass: Function): ElementMetadata<TApp>;
export {};
//# sourceMappingURL=elementMetadata.d.ts.map