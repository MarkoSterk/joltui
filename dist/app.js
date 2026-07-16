import Router from "./router.js";
import ErrorHandler, {} from "./errorHandler.js";
import { CustomElement } from "./customElement.js";
import Authenticator from "./authenticator.js";
import { transformSelector } from "./selectorParser/index.js";
export const dataEventEnum = {
    CHANGE: "app-data-change",
};
export class ExtensionNotRegistered extends Error {
    constructor(extName, options) {
        super(`Extension ${extName} not registered.`, options);
    }
}
class App {
    _identifier;
    _appName;
    _container;
    _routerGenerator;
    _authenticatorGenerator;
    _dataStructure;
    _errorHandlersList;
    _errorHandlersMap;
    _elements;
    _router;
    _authenticator;
    _originalInnerHTML;
    _originalOuterHTML;
    _afterInit;
    _beforeInit;
    _extensions;
    _extensionsMap;
    _dataChangeListeners;
    _originalInsertAdjacentHTML;
    _originalSetAttribute;
    _originalGetAttribute;
    _originalRemoveAttribute;
    _originalDocQS;
    _originalDocQSA;
    _originalElQS;
    _originalElQSA;
    _protectedProperties;
    constructor({ appName, dataStructure = null, elements = null, routerGenerator = null, authenticatorGenerator = null, container = null, errorHandlers = null, beforeInit = null, afterInit = null, extensions = null, define = null }) {
        this._identifier = "app";
        this._appName = appName;
        this._dataStructure = new Map(Object.entries(dataStructure || {}));
        this._routerGenerator = routerGenerator;
        this._authenticatorGenerator = authenticatorGenerator;
        this._container = container;
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
        this._originalInnerHTML = this.getRequiredSetter(Element.prototype, "innerHTML");
        this._originalOuterHTML = this.getRequiredSetter(Element.prototype, "outerHTML");
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
        if (define) {
            this._assignDefinedGettersAndSetters(define);
        }
    }
    init = async (target) => {
        if (!target && !this._container) {
            throw new Error("Missing application container at app startup.");
        }
        const container = typeof target === "string" ? document.querySelector(target) : this._container;
        if (!container) {
            throw new Error("Couldn't find application container element.");
        }
        this._container = container;
        this._container.app = this;
        this._container.setAttribute("app-id", this.generateHash());
        this._registerCustomElements();
        this._modifyPrototypeMethods();
        await this._runMethods(this._beforeInit);
        if (this._routerGenerator) {
            this._router = this._routerGenerator(this);
        }
        if (this._authenticatorGenerator) {
            this._authenticator = this._authenticatorGenerator(this);
        }
        await this._initializeExtensions();
        if (this._router) {
            await this._router.route();
        }
        await this._waitForSubelements();
        await this._runMethods(this._afterInit);
    };
    _registerCustomElements() {
        if (!this._elements) {
            return;
        }
        this.registerCustomElements(this._elements);
    }
    registerCustomElements(elements) {
        for (const element of elements) {
            customElements.define(element.tagName, element);
        }
    }
    _assignDefinedGettersAndSetters = (definitions) => {
        if (!definitions) {
            return;
        }
        for (const [prop, methods] of Object.entries(definitions)) {
            if (this._protectedProperties.includes(prop) || prop.startsWith("#") || prop.startsWith("_")) {
                throw new Error(`Illegal or protected property name. Can't assign property with name (${prop}) that is protected or if it is of illegal format (startswith: # or _) to application`);
            }
            if (typeof methods === "function") {
                //@ts-ignore
                Object.defineProperty(this, prop, methods.bind(this)(prop));
            }
            else {
                Object.defineProperty(this, prop, methods);
            }
        }
    };
    registerDataListener = (component) => {
        if (!this._dataStructure) {
            return;
        }
        if (!component.dataField) {
            return;
        }
        if (!this._dataStructure.has(component.dataField)) {
            throw new Error("Missing dataField in application data structure");
        }
        const listener = async (event) => {
            if (event.detail.field === component.dataField) {
                await component.rerender();
            }
        };
        const key = this._generateListenerKey(component.dataField, component);
        const existingListener = this._dataChangeListeners.get(key);
        if (existingListener) {
            this.removeEventListener(dataEventEnum.CHANGE, existingListener);
        }
        this._dataChangeListeners.set(key, listener);
        this.addEventListener(dataEventEnum.CHANGE, listener);
    };
    removeDataListener = (component) => {
        if (!component.dataField) {
            return;
        }
        const key = this._generateListenerKey(component.dataField, component);
        const listener = this._dataChangeListeners.get(key);
        if (!listener) {
            return;
        }
        this.removeEventListener(dataEventEnum.CHANGE, listener);
        this._dataChangeListeners.delete(key);
    };
    generateHash = (length = 16) => {
        const array = new Uint8Array(length);
        window.crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(length).padStart(2, '0')).join('');
    };
    _generateListenerKey = (field, component) => {
        return `${field}-${component.tagName}-${component.hashId}`;
    };
    _waitForSubelements = async () => {
        const subelementPromises = [];
        const allCustomElements = Array.from(this.querySelectorAll('*')).filter((el) => {
            return el instanceof CustomElement;
        });
        allCustomElements.forEach(elem => {
            subelementPromises.push(elem.initComplete);
        });
        return await Promise.all(subelementPromises);
    };
    _initializeExtensions = async () => {
        if (!this._extensions) {
            return;
        }
        for (const [key, initializer] of Object.entries(this._extensions)) {
            this._extensionsMap[key] = await initializer(this);
        }
    };
    _runMethods = async (methods) => {
        for (const [key, func] of Object.entries(methods)) {
            await func.bind(this)();
        }
    };
    querySelector = (selector) => {
        return this.container.querySelector(selector);
    };
    querySelectorAll = (selector) => {
        return this.container.querySelectorAll(selector);
    };
    getElementById = (selector) => {
        return this.container.querySelector(`#${selector}`);
    };
    getElementsByClassName = (selector) => {
        return this.container.getElementsByClassName(selector);
    };
    getElementsByTagName = (selector) => {
        return this.container.getElementsByTagName(selector);
    };
    matches = (selector) => {
        return this.container.matches(selector);
    };
    handleError = async (e) => {
        if (!this._errorHandlersMap || !this._isError(e)) {
            throw e;
        }
        const handler = this._errorHandlersMap?.[e.constructor.name];
        if (!handler) {
            throw e;
        }
        return await handler(e);
    };
    _isError = (e) => {
        return e instanceof Error;
    };
    addEventListener(eventType, listener, options) {
        this.container.addEventListener(eventType, listener, options);
    }
    removeEventListener(eventType, listener, options) {
        this.container.removeEventListener(eventType, listener, options);
    }
    insertAdjacentHTML = (position, markup) => {
        this.container.insertAdjacentHTML(position, markup);
    };
    _modifyPrototypeMethods = () => {
        const appInstance = this;
        HTMLElement.prototype.setAttribute = function (name, value) {
            if (this instanceof CustomElement) {
                try {
                    if (![undefined, null].includes(value)) {
                        value = JSON.parse(value);
                    }
                }
                catch (e) {
                    //silent pass
                }
                if (name.startsWith(":")) {
                    name = `${name.substring(1)}`.trim();
                }
                appInstance._originalSetAttribute.call(this, `data-jolt-${name}`, value);
            }
            else {
                appInstance._originalSetAttribute.call(this, name, value);
            }
        };
        HTMLElement.prototype.removeAttribute = function (name) {
            if (name.startsWith(":")) {
                name = "data-df-" + name.substring(1);
            }
            appInstance._originalRemoveAttribute.call(this, name);
        };
        HTMLElement.prototype.getAttribute = function (name) {
            if (name.startsWith(":")) {
                name = `data-df-${name.substring(1)}`.trim();
            }
            return appInstance._originalGetAttribute.call(this, name);
        };
        Element.prototype.insertAdjacentHTML = function (position, html) {
            //"this" refers to the element the operation is being performed on
            const customElement = this.closest("[data-hash-id]");
            if (customElement) {
                //html = customElement._processDataBinds(html);
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
                //this points to the element whos innerHTML changes.
                //appInstance._originalInnerHTML.call(this, "");
                //this.insertAdjacentHTML("afterbegin", html);
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
                //this points to the element which outerHTML is changed
                //tries to find the parent (custom) element of the element that changes outerHTML
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
        // 3) Patch Element methods
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
        if (typeof descriptor?.set !== "function") {
            throw new Error(`Missing setter for "${propertyName}".`);
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
        const event = new CustomEvent(dataEventEnum.CHANGE, {
            detail: { field: field }
        });
        this.container.dispatchEvent(event);
    }
    get children() {
        return this.container.children;
    }
    get childNodes() {
        return this.container.childNodes;
    }
    get container() {
        return this._container;
    }
    get authenticator() {
        if (!this._authenticator) {
            throw new ExtensionNotRegistered("authenticator");
        }
        return this._authenticator;
    }
    get router() {
        if (!this._router) {
            throw new ExtensionNotRegistered("router");
        }
        return this._router;
    }
    get appName() {
        return this._appName;
    }
    get originalInnerHTML() {
        return this._originalInnerHTML;
    }
    get originalInsertAdjacentHTML() {
        return this._originalInsertAdjacentHTML;
    }
    get queryParameters() {
        const searchParams = new URLSearchParams(location.search);
        const params = {};
        for (const [key, value] of searchParams.entries()) {
            params[key] = value;
        }
        return params;
    }
    set queryParameters(params) {
        const url = new URL(window.location.href);
        url.search = "";
        for (const [key, value] of Object.entries(params)) {
            url.searchParams.set(key, String(value));
        }
        history.pushState(history.state, "", url);
    }
    updateQueryParameters(params) {
        const url = new URL(window.location.href);
        for (const [key, value] of Object.entries(params)) {
            url.searchParams.set(key, `${value}`);
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