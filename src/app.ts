import Router from "./router.js";
import ErrorHandler, { type ErrorHandlerMethod } from "./errorHandler.js";
import { CustomElement, type CustomElementClass } from "./customElement.js";
import Authenticator from "./authenticator.js";
import { transformSelector } from "./selectorParser/index.js";

export const dataEventEnum = {
    CHANGE: "app-data-change",
} as const;

export type AppDataChangeDetail = {
    field: string;
};

export type AppDataChangeEvent =
    CustomEvent<AppDataChangeDetail>;

interface AppEventMap extends GlobalEventHandlersEventMap {
    "app-data-change": AppDataChangeEvent;
}

type AppEventListener<K extends keyof AppEventMap> = (
    this: Element,
    event: AppEventMap[K],
) => void;

type DataChangeListener =
    AppEventListener<typeof dataEventEnum.CHANGE>;

export class ExtensionNotRegistered extends Error{
    constructor(extName: string, options?: ErrorOptions){
        super(`Extension ${extName} not registered.`, options);
    }
}

type DataStructure = Record<string, unknown>;

type RouterGenerator = (app: App) => Router<App>

type AuthenticatorGenerator = (app: App) => Authenticator<App>

export type AppContainer = Element & {
    app: App;
};

type AppConfig = {
    appName: string,
    dataStructure: DataStructure|null,
    elements: CustomElementClass[]|null,
    routerGenerator: RouterGenerator|null,
    authenticatorGenerator: AuthenticatorGenerator|null,
    container: AppContainer|null,
    errorHandlers: ErrorHandler<App>[]|null,
    beforeInit: Record<string, CallableFunction>|null,
    afterInit: Record<string, CallableFunction>|null,
    extensions: Record<string, CallableFunction>|null,
    define: Record<string, any|Record<string, CallableFunction>>|null
}


type ElementHtmlSetter = (
    this: Element,
    value: string,
) => void;

class App{
    protected readonly _identifier: string;
    protected readonly _appName: string;
    protected _container: AppContainer|null;
    protected readonly _routerGenerator: RouterGenerator|null;
    protected readonly _authenticatorGenerator: AuthenticatorGenerator|null;
    protected _dataStructure: Map<string, any>;
    protected _errorHandlersList: ErrorHandler<App>[]|null;
    protected _errorHandlersMap: Record<string, ErrorHandlerMethod>|null;
    protected readonly _elements: CustomElementClass[]|null;
    protected _router: Router<App>|null;
    protected _authenticator: Authenticator<App>|null;
    protected readonly _originalInnerHTML: ElementHtmlSetter;
    protected readonly _originalOuterHTML: ElementHtmlSetter;
    protected _afterInit: Record<string, CallableFunction>;
    protected _beforeInit: Record<string, CallableFunction>;
    protected _extensions: Record<string, CallableFunction>
    protected _extensionsMap: Record<string, any>
    protected _dataChangeListeners: Map<string, DataChangeListener>;
    protected readonly _originalInsertAdjacentHTML:
        typeof Element.prototype.insertAdjacentHTML;

    protected readonly _originalSetAttribute:
        typeof HTMLElement.prototype.setAttribute;

    protected readonly _originalGetAttribute:
        typeof HTMLElement.prototype.getAttribute;

    protected readonly _originalRemoveAttribute:
        typeof HTMLElement.prototype.removeAttribute;

    protected readonly _originalDocQS:
        typeof Document.prototype.querySelector;

    protected readonly _originalDocQSA:
        typeof Document.prototype.querySelectorAll;

    protected readonly _originalElQS:
        typeof Element.prototype.querySelector;

    protected readonly _originalElQSA:
        typeof Element.prototype.querySelectorAll;
    protected _protectedProperties: string[];


    constructor({appName, dataStructure = null,
                elements = null, routerGenerator = null,
                authenticatorGenerator = null, container = null,
            errorHandlers = null, beforeInit = null, afterInit = null,
            extensions = null, define = null}: AppConfig){
        this._identifier = "app";
        this._appName = appName;
        this._dataStructure = new Map(Object.entries(dataStructure || {}));
        this._routerGenerator = routerGenerator;
        this._authenticatorGenerator = authenticatorGenerator;
        this._container = container
        this._errorHandlersList = errorHandlers;
        this._errorHandlersMap = null;
        this._elements = elements;
        this._router = null;
        this._authenticator = null;
        this._beforeInit = beforeInit || {};
        this._afterInit = afterInit || {};
        this._extensions = extensions || {};
        this._extensionsMap = {};
        this._dataChangeListeners = new Map();
        this._protectedProperties = Object.getOwnPropertyNames(this);
        this._originalInnerHTML = this.getRequiredSetter(
            Element.prototype,
            "innerHTML",
        );
        this._originalOuterHTML = this.getRequiredSetter(
            Element.prototype,
            "outerHTML",
        );

        this._originalInsertAdjacentHTML =
            Element.prototype.insertAdjacentHTML;

        this._originalSetAttribute =
            HTMLElement.prototype.setAttribute;

        this._originalGetAttribute =
            HTMLElement.prototype.getAttribute;

        this._originalRemoveAttribute =
            HTMLElement.prototype.removeAttribute;

        this._originalDocQS =
            Document.prototype.querySelector;

        this._originalDocQSA =
            Document.prototype.querySelectorAll;

        this._originalElQS =
            Element.prototype.querySelector;

        this._originalElQSA =
            Element.prototype.querySelectorAll;
        if(define){
            this._assignDefinedGettersAndSetters(define)
        }
    }

    init = async (target?: string) => {
        if(!target && !this._container){
            throw new Error("Missing application container at app startup.")
        }
        const container: AppContainer|null = typeof target === "string" ? document.querySelector(target) : this._container;
        if(!container){
            throw new Error("Couldn't find application container element.")
        }
        this._container = container;
        this._container.app = this;
        this._container.setAttribute("app-id", this.generateHash());
        this._registerCustomElements();
        this._modifyPrototypeMethods()
        await this._runMethods(this._beforeInit);
        if(this._routerGenerator){
            this._router = this._routerGenerator(this);
        }
        if(this._authenticatorGenerator){
            this._authenticator = this._authenticatorGenerator(this);
        }
        await this._initializeExtensions();
        if(this._router){
            await this._router.route();
        }
        await this._waitForSubelements();
        await this._runMethods(this._afterInit);
    }

    _registerCustomElements(){
        if(!this._elements){
            return;
        }
        this.registerCustomElements(this._elements);
    }

    registerCustomElements(elements: CustomElementClass[]){
        for(const element of elements){
            customElements.define(element.tagName, element);
        }
    }

    protected _assignDefinedGettersAndSetters = (definitions: Record<string, any|Record<string, CallableFunction>>) => {
        if(!definitions){
            return;
        }
        for(const [prop, methods] of Object.entries(definitions)){
            if(this._protectedProperties.includes(prop) || prop.startsWith("#") || prop.startsWith("_")){
                throw new Error(`Illegal or protected property name. Can't assign property with name (${prop}) that is protected or if it is of illegal format (startswith: # or _) to application`);
            }
            if(typeof methods === "function"){
                //@ts-ignore
                Object.defineProperty(this, prop, methods.bind(this)(prop));
            }else{
                Object.defineProperty(this, prop, methods);
            }
        }
    }

    registerDataListener = (component: CustomElement) => {
        if(!this._dataStructure){
            return;
        }
        if(!component.dataField){
            return;
        }
        if(!this._dataStructure.has(component.dataField)){
            throw new Error("Missing dataField in application data structure");
        }
        const listener = async (event: CustomEvent) => {
            if (event.detail.field === component.dataField) {
                await component.rerender();
            }
        };
        const key = this._generateListenerKey(component.dataField, component);
        const existingListener = this._dataChangeListeners.get(key);
        if(existingListener){
            this.removeEventListener(dataEventEnum.CHANGE, existingListener);
        }
        this._dataChangeListeners.set(key, listener);
        this.addEventListener(dataEventEnum.CHANGE, listener);
    }

    removeDataListener = (component: CustomElement) => {
        if(!component.dataField){
            return;
        }
        const key = this._generateListenerKey(component.dataField, component);
        const listener = this._dataChangeListeners.get(key);
        if(!listener){
            return;
        }
        this.removeEventListener(dataEventEnum.CHANGE, listener);
        this._dataChangeListeners.delete(key);
    }

    generateHash = (length: number = 16) => {
        const array = new Uint8Array(length);
        window.crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(length).padStart(2, '0')).join('');
    }

    protected _generateListenerKey = (field: string, component: CustomElement) => {
        return `${field}-${component.tagName}-${component.hashId}`;
    }

    protected _waitForSubelements = async () => {
        const subelementPromises: Promise<void>[] = [];
        const allCustomElements = Array.from(this.querySelectorAll('*')).filter(
            (el) => {
                return el instanceof CustomElement
            }
        );
        allCustomElements.forEach(elem => {
            subelementPromises.push(elem.initComplete);
        })
        return await Promise.all(subelementPromises);
    }

    protected _initializeExtensions = async () => {
        if(!this._extensions){
            return;
        }
        for(const [key, initializer] of Object.entries(this._extensions)){
            this._extensionsMap[key] = await initializer(this);
        }

    }

    protected _runMethods = async (methods: Record<string, CallableFunction>) => {
        for(const [key, func] of Object.entries(methods)){
            await func.bind(this)()
        }
    }


    querySelector = (selector: string) => {
        return this.container.querySelector(selector);
    }

    querySelectorAll = (selector: string) => {
        return this.container.querySelectorAll(selector);
    }

    getElementById = (selector: string) => {
        return this.container.querySelector(`#${selector}`);
    }

    getElementsByClassName = (selector: string) => {
        return this.container.getElementsByClassName(selector);
    }

    getElementsByTagName = (selector: string) => {
        return this.container.getElementsByTagName(selector);
    }

    matches = (selector: string) => {
        return this.container.matches(selector);
    }

    handleError = async (e: any): Promise<any> => {
        if(!this._errorHandlersMap || !this._isError(e)){
            throw e;
        }
        const handler = this._errorHandlersMap?.[e.constructor.name] as ErrorHandlerMethod|null;
        if(!handler){
            throw e;
        }
        return await handler(e);
    }

    _isError = (e: any): boolean => {
        return e instanceof Error;
    }

    addEventListener<K extends keyof AppEventMap>(
        eventType: K,
        listener: AppEventListener<K>,
        options?: boolean | AddEventListenerOptions,
    ): void;

    addEventListener(
        eventType: string,
        listener: EventListenerOrEventListenerObject,
        options?: boolean | AddEventListenerOptions,
    ): void;

    addEventListener(
        eventType: string,
        listener: EventListenerOrEventListenerObject,
        options?: boolean | AddEventListenerOptions,
    ): void {
        this.container.addEventListener(
            eventType,
            listener,
            options,
        );
    }

    removeEventListener<K extends keyof AppEventMap>(
        eventType: K,
        listener: AppEventListener<K>,
        options?: boolean | EventListenerOptions,
    ): void;

    removeEventListener(
        eventType: string,
        listener: EventListenerOrEventListenerObject,
        options?: boolean | EventListenerOptions,
    ): void;

    removeEventListener(
        eventType: string,
        listener: EventListenerOrEventListenerObject,
        options?: boolean | EventListenerOptions,
    ): void {
        this.container.removeEventListener(
            eventType,
            listener,
            options,
        );
    }

    insertAdjacentHTML = (position: InsertPosition, markup: string) => {
        this.container.insertAdjacentHTML(position, markup);
    }

    protected _modifyPrototypeMethods = () => {
        const appInstance = this;
        
        HTMLElement.prototype.setAttribute = function(name, value: any) {
            if(this instanceof CustomElement){
                try{
                    if(![undefined, null].includes(value)){
                        value = JSON.parse(value);
                    }
                }catch(e){
                    //silent pass
                }
                if(name.startsWith(":")){
                    name = `${name.substring(1)}`.trim()
                }
                appInstance._originalSetAttribute.call(this,`data-jolt-${name}`, value);
            }else{
                appInstance._originalSetAttribute.call(this, name, value);
            }
        }

        HTMLElement.prototype.removeAttribute = function(name){
            if(name.startsWith(":")){
                name = "data-df-" + name.substring(1);
            }
            appInstance._originalRemoveAttribute.call(this, name);
        }

        HTMLElement.prototype.getAttribute = function(name) {
            if(name.startsWith(":")){
                name = `data-df-${name.substring(1)}`.trim();
            }
            return appInstance._originalGetAttribute.call(this, name);
        }

        Element.prototype.insertAdjacentHTML = function(position, html, ){
            //"this" refers to the element the operation is being performed on
            const customElement = this.closest("[data-hash-id]") as CustomElement;
            if(customElement){
                //html = customElement._processDataBinds(html);
                const renderedTemplate = customElement.dotJSengine(html)
                if(!renderedTemplate){
                    return;
                }
                appInstance._originalInsertAdjacentHTML.call(this, position, renderedTemplate)
                customElement.hydrate();
                return;
            }
            appInstance._originalInsertAdjacentHTML.call(this, position, html);
        }
        Object.defineProperty(Element.prototype, 'innerHTML',  {
            configurable: true,
            enumerable: true,
            set: function(this: Element, html: string){
                //this points to the element whos innerHTML changes.
                //appInstance._originalInnerHTML.call(this, "");
                //this.insertAdjacentHTML("afterbegin", html);
                html = html.trim();
                const customElement = this.closest("[data-hash-id]") as CustomElement;
                if(!customElement){
                    appInstance._originalInnerHTML.call(this, html);
                    return;
                }
                appInstance._originalInnerHTML.call(this, "");
                this.insertAdjacentHTML("afterbegin", html);
            }
        });
        Object.defineProperty(Element.prototype, 'outerHTML', {
            configurable: true,
            enumerable: true,
            set: function(this: Element, html: string){
                //this points to the element which outerHTML is changed
                //tries to find the parent (custom) element of the element that changes outerHTML
                html = html.trim();
                const customElement = this.closest("[data-hash-id]") as CustomElement;
                if(customElement){
                    const renderedTemplate = customElement.dotJSengine(html)
                    if(!renderedTemplate){
                        return;
                    }
                    appInstance._originalOuterHTML.call(this, renderedTemplate);
                    customElement.hydrate();
                    return;
                }
                appInstance._originalOuterHTML.call(this, html);
            }
        });

        Document.prototype.querySelector = function(selector: string) {
            const newSelector = transformSelector(selector)
            return appInstance._originalDocQS.call(this, newSelector);
        };

        Document.prototype.querySelectorAll = function(selector: string) {
            const newSelector = transformSelector(selector)
            return appInstance._originalDocQSA.call(this, newSelector);
        };

        // 3) Patch Element methods
        Element.prototype.querySelector = function(selector: string) {
            const newSelector = transformSelector(selector)
            return appInstance._originalElQS.call(this, newSelector);
        };

        Element.prototype.querySelectorAll = function(selector: string) {
            const newSelector = transformSelector(selector)
            return appInstance._originalElQSA.call(this, newSelector);
        };

    }

    getRequiredSetter(
        prototype: object,
        propertyName: string,
    ): ElementHtmlSetter {
        const descriptor = Object.getOwnPropertyDescriptor(
            prototype,
            propertyName,
        );

        if (typeof descriptor?.set !== "function") {
            throw new Error(
                `Missing setter for "${propertyName}".`,
            );
        }

        return descriptor.set as ElementHtmlSetter;
    }

    getData(field: string): any{
        if(!this._dataStructure.has(field)){
            throw new Error(`Data field '${field}' does not exist.`);
        }
        return this._dataStructure.get(field);
    }

    setData(field: string, data: any){
        if(!this._dataStructure.has(field)){
            throw new Error(`Data field '${field}' does not exist.`);
        }
        this._dataStructure.set(field, data);
        this._dataChangeEvent(field);
    }

    _dataChangeEvent(field: string){
        const event = new CustomEvent(dataEventEnum.CHANGE, {
            detail: {field: field}
        });
        this.container.dispatchEvent(event);
    }

    get children(){
        return this.container.children;
    }

    get childNodes(){
        return this.container.childNodes;
    }

    get container(): AppContainer{
        return this._container as AppContainer;
    }

    get authenticator():Authenticator<App>{
        if(!this._authenticator){
            throw new ExtensionNotRegistered("authenticator");
        }
        return this._authenticator;
    }

    get router(): Router<App>{
        if(!this._router){
            throw new ExtensionNotRegistered("router")
        }
        return this._router;
    }

    get appName(): string{
        return this._appName;
    }

    get originalInnerHTML(): ElementHtmlSetter{
        return this._originalInnerHTML;
    }

    get originalInsertAdjacentHTML(): typeof Element.prototype.insertAdjacentHTML{
        return this._originalInsertAdjacentHTML;
    }

    get queryParameters(): Record<string,string>{
        const searchParams = new URLSearchParams(location.search);
        const params:  Record<string,string> = {};
        for (const [key, value] of searchParams.entries()) {
            params[key] = value;
        }
        return params;
    }

    set queryParameters(params: Record<string, string>){
        const url = new URL(window.location.href);
        url.search = "";
        for (const [key, value] of Object.entries(params)) {
            url.searchParams.set(key, String(value));
        }
        history.pushState(history.state, "", url);
    }

    updateQueryParameters(params: Record<string, string>){
        const url = new URL(window.location.href);
        for(const [key, value] of Object.entries(params)){
            url.searchParams.set(key, `${value}`);
        }
        history.pushState(history.state, "", url);
    }

    createQueryParametersString(params: Record<string, string>): string{
        const searchParams = new URLSearchParams()
        for (const [key, value] of Object.entries(params)) {
            searchParams.set(key, String(value));
        }
        return searchParams.toString()
    }

    get hash(): string{
        return location.hash;
    }

    get port(): string{
        return location.port;
    }

    get hostname(): string{
        return location.hostname;
    }

    get host(): string{
        return location.host;
    }

    get pathname(): string{
        return location.pathname;
    }

    get origin(): string{
        return location.origin;
    }
}

export default App;
