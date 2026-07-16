import App from "./app.js";
import { type DoTDataBindTemplates, type DoTSanitizeFunction, type DoTTemplateSettings } from "./dotjs/dot.js";
export declare class RenderError extends Error {
    protected readonly elementName: string;
    constructor(elementName: string);
}
export declare class MissingMarkupMethod extends Error {
    protected readonly elementName: string;
    constructor(elementName: string);
}
export declare class DotJSEngineError extends Error {
    protected readonly elementName: string;
    constructor(elementName: string);
}
export declare class MethodExecutionError extends Error {
    protected readonly methodName: string;
    protected readonly elementName: string;
    constructor(methodName: string, elementName: string);
}
type MaybePromise<T> = T | Promise<T>;
export type ComponentMethod = (this: CustomElement, ...args: any[]) => MaybePromise<unknown>;
export type LifecycleMethod = (this: CustomElement) => MaybePromise<void>;
export type MarkupMethod = (this: CustomElement) => MaybePromise<string>;
export type TemplateFunction = (this: CustomElement, ...args: unknown[]) => unknown;
export type ComponentMethods = Record<string, ComponentMethod>;
export type LifecycleMethods = Record<string, LifecycleMethod>;
export type PropertyDescriptorFactory = (this: CustomElement, propertyName: string) => PropertyDescriptor;
export type PropertyDefinition = PropertyDescriptor | PropertyDescriptorFactory;
export type PropertyDefinitions = Record<string, PropertyDefinition>;
export type CustomElementConfig = {
    tagName: string;
    markup: MarkupMethod;
    methods?: ComponentMethods;
    beforeInit?: LifecycleMethods;
    beforeInitResolve?: LifecycleMethods;
    afterInit?: LifecycleMethods;
    beforeRerender?: LifecycleMethods;
    afterRerender?: LifecycleMethods;
    afterDisconnect?: LifecycleMethods;
    dataField?: string | null;
    define?: PropertyDefinitions;
    templateFunctions?: Record<string, TemplateFunction>;
};
export type CustomElementClass<TElement extends CustomElement = CustomElement> = {
    new (): TElement;
    readonly tagName: string;
    generate(hashId?: string | null, args?: Record<string, unknown> | null): string;
};
type ElementEventConfig = {
    element: Element;
    eventName: string;
    methodName: string;
};
type DataBindTemplates = DoTDataBindTemplates;
export type TemplateSettings = DoTTemplateSettings & {
    evaluate: RegExp;
    interpolate: RegExp;
    encode: RegExp;
    use: RegExp;
    define: RegExp;
    conditional: RegExp;
    iterate: RegExp;
    varname: string;
    strip: boolean;
    append: boolean;
    selfcontained: boolean;
    def: Record<string, TemplateFunction>;
    dataBinds: Map<string, DataBindTemplates>;
    sanitizeFunc: DoTSanitizeFunction;
};
export declare function randomId(max?: number, min?: number): number;
export declare function defineValue(initValue: unknown, triggerRerender?: boolean): PropertyDescriptorFactory;
export declare function queryParameter(name: string, defaultValue?: string | null, triggerRerender?: boolean): PropertyDescriptorFactory;
export declare function querySelector<TElement extends Element = Element>(selector: string): PropertyDescriptorFactory;
export declare function querySelectorAll<TElement extends Element = Element>(selector: string): PropertyDescriptorFactory;
export declare const html: (template: {
    raw: readonly string[] | ArrayLike<string>;
}, ...substitutions: any[]) => string;
export declare class CustomElement extends HTMLElement {
    static readonly tagName: string;
    protected _app: App | null;
    protected _resolveInitialization: (() => void) | null;
    protected _templateSettings: TemplateSettings;
    protected _dataField: string | null;
    protected _parent: CustomElement | null;
    protected _protectedProperties: string[];
    protected _methods: ComponentMethods | null;
    protected _beforeInit: LifecycleMethods;
    protected _beforeInitResolve: LifecycleMethods;
    protected _afterInit: LifecycleMethods;
    protected _beforeRerender: LifecycleMethods;
    protected _afterRerender: LifecycleMethods;
    protected _afterDisconnect: LifecycleMethods;
    protected _define: PropertyDefinitions;
    protected _templateFunctions: Record<string, TemplateFunction>;
    protected _renderTime: number;
    protected _lastRender: number;
    protected _abort: boolean;
    protected readonly _virtualRenderDiv = "virtual-render-div";
    readonly initComplete: Promise<void>;
    readonly _values: Record<string, unknown>;
    rndId: number;
    hashId: string;
    markup: MarkupMethod;
    constructor();
    connectedCallback(): Promise<void>;
    disconnectedCallback(): void;
    initElement: () => Promise<void>;
    protected _resolveInitComplete(): void;
    protected _handleError(error: unknown): Promise<void>;
    protected _assignTemplateFunctions(): void;
    protected _assignMethods(): void;
    protected _assignDefinedGettersAndSetters(): void;
    protected _assertPublicMemberName(name: string, memberType: "method" | "property"): void;
    protected _runMethods(methods: LifecycleMethods): Promise<void>;
    protected _markup(): Promise<string>;
    render: () => Promise<void>;
    rerender: () => Promise<void>;
    protected _waitForSubelements(): Promise<void>;
    generateHash(length?: number): string;
    protected _updateBoundAppDataParts: EventListener;
    _refreshBoundElements(propertyName: string): void;
    protected _hydrate: () => void;
    protected _setEventListeners(elementsWithEvents: ElementEventConfig[]): void;
    protected _createEventListenerMethod(element: Element, methodName: string): EventListener;
    protected _executeElementMethod(element: Element, methodName: string, event: Event): Promise<void>;
    _getAllArgs(element: Element | HTMLElement | CustomElement): Record<string, unknown>;
    protected _allElementsWithEvents(allElements: NodeListOf<Element>): ElementEventConfig[];
    protected _elementWithEvent(element: Element): ElementEventConfig[];
    protected _dotJSengine: (template: string) => string;
    protected _parseStringTemplate(template: string): string;
    protected _tagAllElementsWithParent<TElement extends Element>(element: TElement): TElement;
    protected _replaceAtWithJolt(template: string): string;
    protected _replaceColonWithData(template: string): string;
    getData(field: string): unknown;
    setData(field: string, data: unknown): void;
    get lastRender(): number;
    get app(): App;
    get dataField(): string | null;
    get parent(): CustomElement | null;
    get args(): Record<string, unknown>;
    get dotJSengine(): (template: string) => string;
    get hydrate(): () => void;
    static generate(hashId?: string | null, args?: Record<string, unknown> | null): string;
}
export declare function escapeHtmlAttribute(value: string): string;
export declare function ElementFactory(config: CustomElementConfig): CustomElementClass;
export default ElementFactory;
//# sourceMappingURL=customElement.d.ts.map