import Router from "./router.js";
import ErrorHandler, {} from "./errorHandler.js";
import { CustomElement, } from "./customElement.js";
import { transformSelector } from "./selectorParser/index.js";
import { requireElementMetadata } from "./elementMetadata.js";
import { Lifecycle, getLifecycleMethods, } from "./lifecycle.js";
export const dataEventEnum = {
    CHANGE: "app-data-change",
};
class App {
    elements = [];
    errorHandlers = [];
    _errorHandlerInstances = [];
    _identifier = "app";
    _appName;
    _serverComponentsUrl = null;
    _container;
    _dataStructure;
    _router = null;
    _dataChangeListeners = new Map();
    _originalInnerHTML;
    _originalOuterHTML;
    _originalInsertAdjacentHTML;
    _originalSetAttribute;
    _originalGetAttribute;
    _originalRemoveAttribute;
    _originalDocQS;
    _originalDocQSA;
    _originalElQS;
    _originalElQSA;
    constructor({ appName, serverComponentsUrl = null, dataStructure = null, container = null, }) {
        if (typeof appName !== "string" ||
            appName.trim().length === 0) {
            throw new TypeError("Application name must be a non-empty string.");
        }
        this._appName = appName;
        if (serverComponentsUrl !== null) {
            this.serverComponentsUrl =
                serverComponentsUrl;
        }
        this._container =
            container;
        this._dataStructure = new Map(Object.entries(dataStructure ?? {}));
        this._originalInnerHTML =
            this.getRequiredSetter(Element.prototype, "innerHTML");
        this._originalOuterHTML =
            this.getRequiredSetter(Element.prototype, "outerHTML");
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
    init = async (target) => {
        const container = this._resolveContainer(target);
        this._container = container;
        this._container.app = this.application;
        this._container.setAttribute("app-id", this.generateHash());
        this.registerCustomElements(this.elements);
        this._modifyPrototypeMethods();
        this._errorHandlerInstances = this._initializeErrorHandlers();
        await this._runLifecycleStage(Lifecycle.EXTENSION_INIT);
        await this._runLifecycleStage(Lifecycle.BEFORE_INIT);
        this._router =
            this.routerGenerator();
        if (this._router) {
            await this._router.route();
        }
        await this._waitForSubelements();
        await this._runLifecycleStage(Lifecycle.AFTER_INIT);
    };
    get application() {
        return this;
    }
    routerGenerator() {
        return null;
    }
    _resolveContainer(target) {
        const configuredTarget = target ?? this._container;
        if (!configuredTarget) {
            throw new Error("Missing application container at startup.");
        }
        const container = typeof configuredTarget === "string"
            ? document.querySelector(configuredTarget)
            : configuredTarget;
        if (!container) {
            throw new Error("Could not find the application container.");
        }
        return container;
    }
    registerCustomElements(elements) {
        for (const element of elements) {
            const metadata = requireElementMetadata(element);
            const registered = customElements.get(metadata.tagName);
            if (registered) {
                if (registered !== element) {
                    throw new Error(`Custom element ` +
                        `'${metadata.tagName}' is already ` +
                        `registered with another constructor.`);
                }
                continue;
            }
            customElements.define(metadata.tagName, element);
        }
    }
    registerDataListener = (component) => {
        const dataField = component.dataField;
        if (!dataField) {
            return;
        }
        if (!this._dataStructure.has(dataField)) {
            throw new Error(`Data field '${dataField}' does not exist.`);
        }
        const listener = event => {
            if (event.detail.field ===
                dataField) {
                void component.rerender();
            }
        };
        const key = this._generateListenerKey(dataField, component);
        const existingListener = this._dataChangeListeners.get(key);
        if (existingListener) {
            this.removeEventListener(dataEventEnum.CHANGE, existingListener);
        }
        this._dataChangeListeners.set(key, listener);
        this.addEventListener(dataEventEnum.CHANGE, listener);
    };
    removeDataListener = (component) => {
        const dataField = component.dataField;
        if (!dataField) {
            return;
        }
        const key = this._generateListenerKey(dataField, component);
        const listener = this._dataChangeListeners.get(key);
        if (!listener) {
            return;
        }
        this.removeEventListener(dataEventEnum.CHANGE, listener);
        this._dataChangeListeners.delete(key);
    };
    generateHash = (length = 16) => {
        if (!Number.isInteger(length) ||
            length <= 0) {
            throw new RangeError("Hash length must be a positive integer.");
        }
        const bytes = new Uint8Array(length);
        crypto.getRandomValues(bytes);
        return Array.from(bytes, byte => byte
            .toString(16)
            .padStart(2, "0")).join("");
    };
    _generateListenerKey(field, component) {
        return (`${field}-` +
            `${component.tagName}-` +
            `${component.hashId}`);
    }
    async _waitForSubelements() {
        const customElements = Array.from(this.querySelectorAll("*")).filter((element) => element instanceof
            CustomElement);
        await Promise.all(customElements.map(element => element.initComplete));
    }
    _initializeErrorHandlers() {
        const handlerInstances = [];
        for (const ErrorHandlerClass of this.errorHandlers) {
            if (typeof ErrorHandlerClass !==
                "function" ||
                !(ErrorHandlerClass.prototype
                    instanceof ErrorHandler)) {
                throw new TypeError("Application error handlers must extend ErrorHandler.");
            }
            handlerInstances.push(new ErrorHandlerClass(this.application));
        }
        return handlerInstances;
    }
    async _runLifecycleStage(stage) {
        for (const { method } of getLifecycleMethods(this, stage)) {
            await method.call(this);
        }
    }
    querySelector(selector) {
        return this.container
            .querySelector(selector);
    }
    querySelectorAll(selector) {
        return this.container
            .querySelectorAll(selector);
    }
    getElementById(id) {
        return this.querySelector(`#${CSS.escape(id)}`);
    }
    getElementsByClassName(className) {
        return this.container
            .getElementsByClassName(className);
    }
    getElementsByTagName(tagName) {
        return this.container
            .getElementsByTagName(tagName);
    }
    matches(selector) {
        return this.container
            .matches(selector);
    }
    handleError = async (error) => {
        if (!(error instanceof Error)) {
            throw new Error("Failed to handle error. Provided instance is not an instance of Error.");
        }
        for (const errorHandler of this._errorHandlerInstances) {
            if (await errorHandler.handle(error)) {
                return;
            }
        }
        throw error;
    };
    addEventListener(eventType, listener, options) {
        this.container.addEventListener(eventType, listener, options);
    }
    removeEventListener(eventType, listener, options) {
        this.container.removeEventListener(eventType, listener, options);
    }
    insertAdjacentHTML(position, markup) {
        this.container
            .insertAdjacentHTML(position, markup);
    }
    _modifyPrototypeMethods = () => {
        const appInstance = this;
        const normalizeAttributeName = (name) => {
            if (!name.startsWith(":")) {
                return name;
            }
            return (`data-jolt-` +
                name.substring(1).trim());
        };
        HTMLElement.prototype.setAttribute = function (name, value) {
            appInstance._originalSetAttribute.call(this, normalizeAttributeName(name), value);
        };
        HTMLElement.prototype.removeAttribute = function (name) {
            appInstance._originalRemoveAttribute.call(this, normalizeAttributeName(name));
        };
        HTMLElement.prototype.getAttribute = function (name) {
            return appInstance._originalGetAttribute.call(this, normalizeAttributeName(name));
        };
        Element.prototype.insertAdjacentHTML = function (position, html) {
            const customElement = this.closest("[data-hash-id]");
            if (customElement) {
                const renderedTemplate = customElement.dotJSengine(html);
                if (!renderedTemplate) {
                    return;
                }
                appInstance._originalInsertAdjacentHTML.call(this, position, renderedTemplate);
                customElement.hydrate();
                return;
            }
            appInstance._originalInsertAdjacentHTML.call(this, position, html);
        };
        Object.defineProperty(Element.prototype, 'innerHTML', {
            configurable: true,
            enumerable: true,
            set: function (html) {
                html = html.trim();
                const customElement = this.closest("[data-hash-id]");
                if (!customElement) {
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
            set: function (html) {
                html = html.trim();
                const customElement = this.closest("[data-hash-id]");
                if (customElement) {
                    const renderedTemplate = customElement.dotJSengine(html);
                    if (!renderedTemplate) {
                        return;
                    }
                    appInstance._originalOuterHTML.call(this, renderedTemplate);
                    customElement.hydrate();
                    return;
                }
                appInstance._originalOuterHTML.call(this, html);
            }
        });
        Document.prototype.querySelector = function (selector) {
            const newSelector = transformSelector(selector);
            return appInstance._originalDocQS.call(this, newSelector);
        };
        Document.prototype.querySelectorAll = function (selector) {
            const newSelector = transformSelector(selector);
            return appInstance._originalDocQSA.call(this, newSelector);
        };
        Element.prototype.querySelector = function (selector) {
            const newSelector = transformSelector(selector);
            return appInstance._originalElQS.call(this, newSelector);
        };
        Element.prototype.querySelectorAll = function (selector) {
            const newSelector = transformSelector(selector);
            return appInstance._originalElQSA.call(this, newSelector);
        };
    };
    getRequiredSetter(prototype, propertyName) {
        const descriptor = Object.getOwnPropertyDescriptor(prototype, propertyName);
        if (typeof descriptor?.set !==
            "function") {
            throw new Error(`Missing setter for ` +
                `"${propertyName}".`);
        }
        return descriptor.set;
    }
    getData(field) {
        if (!this._dataStructure.has(field)) {
            throw new Error(`Data field '${field}' does not exist.`);
        }
        return this._dataStructure.get(field);
    }
    setData(field, data) {
        if (!this._dataStructure.has(field)) {
            throw new Error(`Data field '${field}' does not exist.`);
        }
        this._dataStructure.set(field, data);
        this._dataChangeEvent(field);
    }
    _dataChangeEvent(field) {
        this.container.dispatchEvent(new CustomEvent(dataEventEnum.CHANGE, {
            detail: { field },
        }));
    }
    get data() {
        return this._dataStructure;
    }
    get children() {
        return this.container.children;
    }
    get childNodes() {
        return this.container.childNodes;
    }
    get container() {
        if (!this._container) {
            throw new Error("Application container is not initialized.");
        }
        return this._container;
    }
    get router() {
        if (!this._router) {
            throw new Error("Router is not initialized.");
        }
        return this._router;
    }
    get appName() {
        return this._appName;
    }
    get serverComponentsUrl() {
        return this._serverComponentsUrl;
    }
    set serverComponentsUrl(value) {
        if (typeof value !== "string") {
            throw new TypeError("Server components URL must be a string.");
        }
        this._serverComponentsUrl = value;
    }
    get identifier() {
        return this._identifier;
    }
    get originalInnerHTML() {
        return this._originalInnerHTML;
    }
    get originalInsertAdjacentHTML() {
        return this
            ._originalInsertAdjacentHTML;
    }
    get queryParameters() {
        return Object.fromEntries(new URLSearchParams(location.search));
    }
    set queryParameters(params) {
        const url = new URL(location.href);
        url.search = "";
        for (const [key, value] of Object.entries(params)) {
            url.searchParams.set(key, value);
        }
        history.pushState(history.state, "", url);
    }
    updateQueryParameters(params) {
        const url = new URL(location.href);
        for (const [key, value] of Object.entries(params)) {
            url.searchParams.set(key, String(value));
        }
        history.pushState(history.state, "", url);
    }
    createQueryParametersString(params) {
        const searchParams = new URLSearchParams();
        for (const [key, value] of Object.entries(params)) {
            searchParams.set(key, String(value));
        }
        return searchParams.toString();
    }
    get hash() {
        return location.hash;
    }
    get port() {
        return location.port;
    }
    get hostname() {
        return location.hostname;
    }
    get host() {
        return location.host;
    }
    get pathname() {
        return location.pathname;
    }
    get origin() {
        return location.origin;
    }
}
export default App;
//# sourceMappingURL=app.js.map