import Router from "./router.js";
import ErrorHandler, { type ErrorHandlerMethod } from "./errorHandler.js";
import { CustomElement, type CustomElementClass } from "./customElement.js";
import Authenticator from "./authenticator.js";
export declare const dataEventEnum: {
    readonly CHANGE: "app-data-change";
};
export type AppDataChangeDetail = {
    field: string;
};
export type AppDataChangeEvent = CustomEvent<AppDataChangeDetail>;
interface AppEventMap extends GlobalEventHandlersEventMap {
    "app-data-change": AppDataChangeEvent;
}
type AppEventListener<K extends keyof AppEventMap> = (this: Element, event: AppEventMap[K]) => void;
type DataChangeListener = AppEventListener<typeof dataEventEnum.CHANGE>;
export declare class ExtensionNotRegistered extends Error {
    constructor(extName: string, options?: ErrorOptions);
}
type DataStructure = Record<string, unknown>;
type RouterGenerator = (app: App) => Router<App>;
type AuthenticatorGenerator = (app: App) => Authenticator<App>;
export type AppContainer = Element & {
    app: App;
};
type AppConfig = {
    appName: string;
    dataStructure?: DataStructure | null;
    elements?: CustomElementClass[] | null;
    routerGenerator?: RouterGenerator | null;
    authenticatorGenerator?: AuthenticatorGenerator | null;
    container?: AppContainer | null;
    errorHandlers?: ErrorHandler<App>[] | null;
    beforeInit?: Record<string, CallableFunction> | null;
    afterInit?: Record<string, CallableFunction> | null;
    extensions?: Record<string, CallableFunction> | null;
    define?: Record<string, any | Record<string, CallableFunction>> | null;
};
type ElementHtmlSetter = (this: Element, value: string) => void;
declare class App {
    protected readonly _identifier: string;
    protected readonly _appName: string;
    protected _container: AppContainer | null;
    protected readonly _routerGenerator: RouterGenerator | null;
    protected readonly _authenticatorGenerator: AuthenticatorGenerator | null;
    protected _dataStructure: Map<string, any>;
    protected _errorHandlersList: ErrorHandler<App>[] | null;
    protected _errorHandlersMap: Record<string, ErrorHandlerMethod> | null;
    protected readonly _elements: CustomElementClass[] | null;
    protected _router: Router<App> | null;
    protected _authenticator: Authenticator<App> | null;
    protected readonly _originalInnerHTML: ElementHtmlSetter;
    protected readonly _originalOuterHTML: ElementHtmlSetter;
    protected _afterInit: Record<string, CallableFunction>;
    protected _beforeInit: Record<string, CallableFunction>;
    protected _extensions: Record<string, CallableFunction>;
    protected _extensionsMap: Record<string, any>;
    protected _dataChangeListeners: Map<string, DataChangeListener>;
    protected readonly _originalInsertAdjacentHTML: typeof Element.prototype.insertAdjacentHTML;
    protected readonly _originalSetAttribute: typeof HTMLElement.prototype.setAttribute;
    protected readonly _originalGetAttribute: typeof HTMLElement.prototype.getAttribute;
    protected readonly _originalRemoveAttribute: typeof HTMLElement.prototype.removeAttribute;
    protected readonly _originalDocQS: typeof Document.prototype.querySelector;
    protected readonly _originalDocQSA: typeof Document.prototype.querySelectorAll;
    protected readonly _originalElQS: typeof Element.prototype.querySelector;
    protected readonly _originalElQSA: typeof Element.prototype.querySelectorAll;
    protected _protectedProperties: string[];
    constructor({ appName, dataStructure, elements, routerGenerator, authenticatorGenerator, container, errorHandlers, beforeInit, afterInit, extensions, define }: AppConfig);
    init: (target?: string) => Promise<void>;
    _registerCustomElements(): void;
    registerCustomElements(elements: CustomElementClass[]): void;
    protected _assignDefinedGettersAndSetters: (definitions: Record<string, any | Record<string, CallableFunction>>) => void;
    registerDataListener: (component: CustomElement) => void;
    removeDataListener: (component: CustomElement) => void;
    generateHash: (length?: number) => string;
    protected _generateListenerKey: (field: string, component: CustomElement) => string;
    protected _waitForSubelements: () => Promise<void[]>;
    protected _initializeExtensions: () => Promise<void>;
    protected _runMethods: (methods: Record<string, CallableFunction>) => Promise<void>;
    querySelector: (selector: string) => Element | null;
    querySelectorAll: (selector: string) => NodeListOf<Element>;
    getElementById: (selector: string) => Element | null;
    getElementsByClassName: (selector: string) => HTMLCollectionOf<Element>;
    getElementsByTagName: (selector: string) => HTMLCollectionOf<Element>;
    matches: (selector: string) => boolean;
    handleError: (e: any) => Promise<any>;
    _isError: (e: any) => boolean;
    addEventListener<K extends keyof AppEventMap>(eventType: K, listener: AppEventListener<K>, options?: boolean | AddEventListenerOptions): void;
    addEventListener(eventType: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
    removeEventListener<K extends keyof AppEventMap>(eventType: K, listener: AppEventListener<K>, options?: boolean | EventListenerOptions): void;
    removeEventListener(eventType: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
    insertAdjacentHTML: (position: InsertPosition, markup: string) => void;
    protected _modifyPrototypeMethods: () => void;
    getRequiredSetter(prototype: object, propertyName: string): ElementHtmlSetter;
    getData(field: string): any;
    setData(field: string, data: any): void;
    _dataChangeEvent(field: string): void;
    get children(): HTMLCollection;
    get childNodes(): NodeListOf<ChildNode>;
    get container(): AppContainer;
    get authenticator(): Authenticator<App>;
    get router(): Router<App>;
    get appName(): string;
    get originalInnerHTML(): ElementHtmlSetter;
    get originalInsertAdjacentHTML(): typeof Element.prototype.insertAdjacentHTML;
    get queryParameters(): Record<string, string>;
    set queryParameters(params: Record<string, string>);
    updateQueryParameters(params: Record<string, string>): void;
    createQueryParametersString(params: Record<string, string>): string;
    get hash(): string;
    get port(): string;
    get hostname(): string;
    get host(): string;
    get pathname(): string;
    get origin(): string;
}
export default App;
//# sourceMappingURL=app.d.ts.map