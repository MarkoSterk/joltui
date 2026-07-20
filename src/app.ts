import Router from "./router.js";
import ErrorHandler from "./errorHandler.js";
import {
    CustomElement,
    type CustomElementClass,
} from "./customElement.js";
import { transformSelector } from "./selectorParser/index.js";
import { requireElementMetadata } from "./elementMetadata.js";
import {
    Lifecycle,
    getLifecycleMethods,
} from "./lifecycle.js";

export const dataEventEnum = {
    CHANGE: "app-data-change",
} as const;

export type AppDataChangeDetail = {
    field: string;
};

export type AppDataChangeEvent =
    CustomEvent<AppDataChangeDetail>;

interface AppEventMap
    extends GlobalEventHandlersEventMap {
    "app-data-change": AppDataChangeEvent;
}

type AppEventListener<
    K extends keyof AppEventMap,
> = (
    this: Element,
    event: AppEventMap[K],
) => void;

type DataChangeListener =
    AppEventListener<
        typeof dataEventEnum.CHANGE
    >;

export class ExtensionNotRegistered
    extends Error {
    constructor(
        extensionName: string,
        options?: ErrorOptions,
    ) {
        super(
            `Extension '${extensionName}' is not registered.`,
            options,
        );
        this.name = "ExtensionNotRegistered";
    }
}

export type DataStructure =
    Record<string, unknown>;

export type ExtensionInitializer<
    TApp extends App<TApp> = App<any>,
> = (
    app: TApp,
) => unknown | Promise<unknown>;

export type AppContainer<
    TApp extends App<TApp> = App<any>,
> = Element & {
    app: TApp;
};

export type AppConfig<
    TApp extends App<TApp> = App<any>,
> = {
    appName: string;
    dataStructure?: DataStructure | null;
    container?: AppContainer<TApp> | null;
    extensions?: Record<
        string,
        ExtensionInitializer<TApp>
    > | null;
};

type ElementHtmlSetter = (
    this: Element,
    value: string,
) => void;

class App<
    TApp extends App<TApp> = any,
> {
    readonly elements:
        readonly CustomElementClass<TApp>[] = [];

    protected readonly errorHandlers:
        readonly ErrorHandler<TApp>[] = [];

    protected readonly _identifier = "app";
    protected readonly _appName: string;

    protected _container:
        AppContainer<TApp> | null;

    protected _dataStructure:
        Map<string, unknown>;

    protected _router:
        Router<TApp> | null = null;

    protected readonly _extensions:
        Record<
            string,
            ExtensionInitializer<TApp>
        >;

    protected readonly _extensionsMap:
        Record<string, unknown> = {};

    protected readonly _dataChangeListeners:
        Map<string, DataChangeListener> =
            new Map();

    protected readonly _originalInnerHTML:
        ElementHtmlSetter;

    protected readonly _originalOuterHTML:
        ElementHtmlSetter;

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

    constructor({
        appName,
        dataStructure = null,
        container = null,
        extensions = null,
    }: AppConfig<TApp>) {
        if (
            typeof appName !== "string" ||
            appName.trim().length === 0
        ) {
            throw new TypeError(
                "Application name must be a non-empty string.",
            );
        }

        this._appName = appName;
        this._container =
            container as AppContainer<TApp> | null;

        this._dataStructure = new Map(
            Object.entries(dataStructure ?? {}),
        );

        this._extensions =
            extensions ?? {};

        this._originalInnerHTML =
            this.getRequiredSetter(
                Element.prototype,
                "innerHTML",
            );

        this._originalOuterHTML =
            this.getRequiredSetter(
                Element.prototype,
                "outerHTML",
            );

        this._originalInsertAdjacentHTML =
            Element.prototype
                .insertAdjacentHTML;

        this._originalSetAttribute =
            HTMLElement.prototype.setAttribute;

        this._originalGetAttribute =
            HTMLElement.prototype.getAttribute;

        this._originalRemoveAttribute =
            HTMLElement.prototype
                .removeAttribute;

        this._originalDocQS =
            Document.prototype.querySelector;

        this._originalDocQSA =
            Document.prototype.querySelectorAll;

        this._originalElQS =
            Element.prototype.querySelector;

        this._originalElQSA =
            Element.prototype.querySelectorAll;
    }

    init = async (
        target?: string | Element,
    ): Promise<void> => {
        const container =
            this._resolveContainer(target);

        this._container = container;
        this._container.app = this.application;
        this._container.setAttribute(
            "app-id",
            this.generateHash(),
        );

        this.registerCustomElements(
            this.elements,
        );

        this._modifyPrototypeMethods();

        await this._runLifecycleStage(
            Lifecycle.BEFORE_INIT,
        );

        this._router =
            this.routerGenerator();

        await this._initializeExtensions();

        if (this._router) {
            await this._router.route();
        }

        await this._waitForSubelements();

        await this._runLifecycleStage(
            Lifecycle.AFTER_INIT,
        );
    };

    protected get application(): TApp {
        return this as unknown as TApp;
    }

    protected routerGenerator():
        Router<TApp> | null {
        return null;
    }

    protected _resolveContainer(
        target?: string | Element,
    ): AppContainer<TApp> {
        const configuredTarget =
            target ?? this._container;

        if (!configuredTarget) {
            throw new Error(
                "Missing application container at startup.",
            );
        }

        const container =
            typeof configuredTarget === "string"
                ? document.querySelector(
                    configuredTarget,
                )
                : configuredTarget;

        if (!container) {
            throw new Error(
                "Could not find the application container.",
            );
        }

        return container as AppContainer<TApp>;
    }

    registerCustomElements(
        elements:
            readonly CustomElementClass<TApp>[],
    ): void {
        for (const element of elements) {
            const metadata =
                requireElementMetadata(element);

            const registered =
                customElements.get(
                    metadata.tagName,
                );

            if (registered) {
                if (registered !== element) {
                    throw new Error(
                        `Custom element ` +
                        `'${metadata.tagName}' is already ` +
                        `registered with another constructor.`,
                    );
                }

                continue;
            }

            customElements.define(
                metadata.tagName,
                element,
            );
        }
    }

    registerDataListener = (
        component: CustomElement<TApp>,
    ): void => {
        const dataField =
            component.dataField;

        if (!dataField) {
            return;
        }

        if (
            !this._dataStructure.has(
                dataField,
            )
        ) {
            throw new Error(
                `Data field '${dataField}' does not exist.`,
            );
        }

        const listener:
            DataChangeListener =
            event => {
                if (
                    event.detail.field ===
                    dataField
                ) {
                    void component.rerender();
                }
            };

        const key =
            this._generateListenerKey(
                dataField,
                component,
            );

        const existingListener =
            this._dataChangeListeners.get(
                key,
            );

        if (existingListener) {
            this.removeEventListener(
                dataEventEnum.CHANGE,
                existingListener,
            );
        }

        this._dataChangeListeners.set(
            key,
            listener,
        );

        this.addEventListener(
            dataEventEnum.CHANGE,
            listener,
        );
    };

    removeDataListener = (
        component: CustomElement<TApp>,
    ): void => {
        const dataField =
            component.dataField;

        if (!dataField) {
            return;
        }

        const key =
            this._generateListenerKey(
                dataField,
                component,
            );

        const listener =
            this._dataChangeListeners.get(
                key,
            );

        if (!listener) {
            return;
        }

        this.removeEventListener(
            dataEventEnum.CHANGE,
            listener,
        );

        this._dataChangeListeners.delete(
            key,
        );
    };

    generateHash = (
        length = 16,
    ): string => {
        if (
            !Number.isInteger(length) ||
            length <= 0
        ) {
            throw new RangeError(
                "Hash length must be a positive integer.",
            );
        }

        const bytes =
            new Uint8Array(length);

        crypto.getRandomValues(bytes);

        return Array.from(
            bytes,
            byte =>
                byte
                    .toString(16)
                    .padStart(2, "0"),
        ).join("");
    };

    protected _generateListenerKey(
        field: string,
        component: CustomElement<TApp>,
    ): string {
        return (
            `${field}-` +
            `${component.tagName}-` +
            `${component.hashId}`
        );
    }

    protected async _waitForSubelements():
        Promise<void> {
        const customElements =
            Array.from(
                this.querySelectorAll("*"),
            ).filter(
                (
                    element,
                ): element is CustomElement<TApp> =>
                    element instanceof
                    CustomElement,
            );

        await Promise.all(
            customElements.map(
                element =>
                    element.initComplete,
            ),
        );
    }

    protected async _initializeExtensions():
        Promise<void> {
        for (
            const [name, initializer]
            of Object.entries(
                this._extensions,
            )
        ) {
            this._extensionsMap[name] =
                await initializer(this.application);
        }
    }

    protected async _runLifecycleStage(
        stage: Lifecycle,
    ): Promise<void> {
        for (
            const { method }
            of getLifecycleMethods(
                this,
                stage,
            )
        ) {
            await method.call(this);
        }
    }

    querySelector<
        TElement extends Element = Element,
    >(
        selector: string,
    ): TElement | null {
        return this.container
            .querySelector<TElement>(
                selector,
            );
    }

    querySelectorAll<
        TElement extends Element = Element,
    >(
        selector: string,
    ): NodeListOf<TElement> {
        return this.container
            .querySelectorAll<TElement>(
                selector,
            );
    }

    getElementById(
        id: string,
    ): Element | null {
        return this.querySelector(
            `#${CSS.escape(id)}`,
        );
    }

    getElementsByClassName(
        className: string,
    ): HTMLCollectionOf<Element> {
        return this.container
            .getElementsByClassName(
                className,
            );
    }

    getElementsByTagName<
        K extends keyof HTMLElementTagNameMap,
    >(
        tagName: K,
    ): HTMLCollectionOf<
        HTMLElementTagNameMap[K]
    > {
        return this.container
            .getElementsByTagName(
                tagName,
            );
    }

    matches(
        selector: string,
    ): boolean {
        return this.container
            .matches(selector);
    }

    handleError = async (
        error: unknown,
    ): Promise<void> => {
        if (!(error instanceof Error)) {
            throw error;
        }

        for (
            const errorHandler
            of this.errorHandlers
        ) {
            if (
                await errorHandler.handle(
                    error,
                )
            ) {
                return;
            }
        }

        throw error;
    };

    addEventListener<
        K extends keyof AppEventMap,
    >(
        eventType: K,
        listener: AppEventListener<K>,
        options?:
            boolean |
            AddEventListenerOptions,
    ): void;

    addEventListener(
        eventType: string,
        listener:
            EventListenerOrEventListenerObject,
        options?:
            boolean |
            AddEventListenerOptions,
    ): void;

    addEventListener(
        eventType: string,
        listener:
            EventListenerOrEventListenerObject,
        options?:
            boolean |
            AddEventListenerOptions,
    ): void {
        this.container.addEventListener(
            eventType,
            listener,
            options,
        );
    }

    removeEventListener<
        K extends keyof AppEventMap,
    >(
        eventType: K,
        listener: AppEventListener<K>,
        options?:
            boolean |
            EventListenerOptions,
    ): void;

    removeEventListener(
        eventType: string,
        listener:
            EventListenerOrEventListenerObject,
        options?:
            boolean |
            EventListenerOptions,
    ): void;

    removeEventListener(
        eventType: string,
        listener:
            EventListenerOrEventListenerObject,
        options?:
            boolean |
            EventListenerOptions,
    ): void {
        this.container.removeEventListener(
            eventType,
            listener,
            options,
        );
    }

    insertAdjacentHTML(
        position: InsertPosition,
        markup: string,
    ): void {
        this.container
            .insertAdjacentHTML(
                position,
                markup,
            );
    }

    protected _modifyPrototypeMethods = () => {
        const appInstance = this;
        
        HTMLElement.prototype.setAttribute = function(name, value: string) {
            if(this instanceof CustomElement){
                try{
                    if (value !== undefined && value !== null){
                        value = JSON.parse(value) as string;
                    }
                }catch(e){
                    //silent pass
                }
                if(name.startsWith(":")){
                    name = `${name.substring(1)}`.trim()
                }
                appInstance._originalSetAttribute.call(this, `data-jolt-${name}`, value);
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

        Element.prototype.insertAdjacentHTML = function(position, html){
            const customElement = this.closest("[data-hash-id]") as CustomElement<TApp> | null;
            if(customElement){
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
                html = html.trim();
                const customElement = this.closest("[data-hash-id]") as CustomElement<TApp> | null;
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
                html = html.trim();
                const customElement = this.closest("[data-hash-id]") as CustomElement<TApp> | null;
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
        const descriptor =
            Object.getOwnPropertyDescriptor(
                prototype,
                propertyName,
            );

        if (
            typeof descriptor?.set !==
            "function"
        ) {
            throw new Error(
                `Missing setter for ` +
                `"${propertyName}".`,
            );
        }

        return descriptor.set as ElementHtmlSetter;
    }

    getData<T = unknown>(
        field: string,
    ): T {
        if (!this._dataStructure.has(field)
        ) {
            throw new Error(
                `Data field '${field}' does not exist.`,
            );
        }
        return this._dataStructure.get(field) as T;
    }

    setData(
        field: string,
        data: unknown,
    ): void {
        if (!this._dataStructure.has(field)
        ) {
            throw new Error(
                `Data field '${field}' does not exist.`,
            );
        }
        this._dataStructure.set(
            field,
            data,
        );
        this._dataChangeEvent(field);
    }

    protected _dataChangeEvent(
        field: string,
    ): void {
        this.container.dispatchEvent(
            new CustomEvent<
                AppDataChangeDetail
            >(
                dataEventEnum.CHANGE,
                {
                    detail: { field },
                },
            ),
        );
    }

    get data():
        ReadonlyMap<string, unknown> {
        return this._dataStructure;
    }

    get children(): HTMLCollection {
        return this.container.children;
    }

    get childNodes(): NodeListOf<ChildNode> {
        return this.container.childNodes;
    }

    get container():
        AppContainer<TApp> {
        if (!this._container) {
            throw new Error(
                "Application container is not initialized.",
            );
        }

        return this._container;
    }

    get router(): Router<TApp> {
        if (!this._router) {
            throw new ExtensionNotRegistered(
                "router",
            );
        }

        return this._router;
    }

    get appName(): string {
        return this._appName;
    }

    get identifier(): string {
        return this._identifier;
    }

    get originalInnerHTML():
        ElementHtmlSetter {
        return this._originalInnerHTML;
    }

    get originalInsertAdjacentHTML():
        typeof Element.prototype.insertAdjacentHTML {
        return this
            ._originalInsertAdjacentHTML;
    }

    get queryParameters():
        Record<string, string> {
        return Object.fromEntries(
            new URLSearchParams(
                location.search,
            ),
        );
    }

    set queryParameters(
        params: Record<string, string>,
    ) {
        const url =
            new URL(location.href);

        url.search = "";

        for (
            const [key, value]
            of Object.entries(params)
        ) {
            url.searchParams.set(
                key,
                value,
            );
        }

        history.pushState(
            history.state,
            "",
            url,
        );
    }

    updateQueryParameters(
        params: Record<
            string,
            string | number
        >,
    ): void {
        const url =
            new URL(location.href);

        for (
            const [key, value]
            of Object.entries(params)
        ) {
            url.searchParams.set(
                key,
                String(value),
            );
        }

        history.pushState(
            history.state,
            "",
            url,
        );
    }

    createQueryParametersString(
        params: Record<
            string,
            string | number
        >,
    ): string {
        const searchParams =
            new URLSearchParams();

        for (
            const [key, value]
            of Object.entries(params)
        ) {
            searchParams.set(
                key,
                String(value),
            );
        }

        return searchParams.toString();
    }

    getExtension<T = unknown>(
        name: string,
    ): T {
        if (
            !(name in this._extensionsMap)
        ) {
            throw new ExtensionNotRegistered(
                name,
            );
        }

        return this._extensionsMap[name] as T;
    }

    get hash(): string {
        return location.hash;
    }

    get port(): string {
        return location.port;
    }

    get hostname(): string {
        return location.hostname;
    }

    get host(): string {
        return location.host;
    }

    get pathname(): string {
        return location.pathname;
    }

    get origin(): string {
        return location.origin;
    }
}

export default App;