import Router from "./router.js";
import { isElementCancellation } from "./cancellation.js";
import ErrorHandler, {} from "./errorHandler.js";
import { CustomElement, } from "./customElement.js";
import { transformSelector } from "./selectorParser/index.js";
import { Lifecycle, getLifecycleMethods, } from "./lifecycle.js";
let prototypeMethodsModified = false;
function normalizeJoltAttributeName(name) {
    if (!name.startsWith(":")) {
        return name;
    }
    const shorthandName = name.substring(1);
    if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(shorthandName)) {
        throw new DOMException(`Invalid JoltUI attribute name '${name}'.`, "InvalidCharacterError");
    }
    return `data-jolt-${shorthandName}`;
}
function getAttributeBindingName(normalizedName) {
    const attributeName = normalizedName.startsWith("data-jolt-")
        ? normalizedName.substring("data-jolt-".length)
        : normalizedName;
    return `attr.${attributeName}`;
}
export const dataEventEnum = {
    CHANGE: "app-data-change",
    QUERY_CHANGE: "query-parameter-change",
};
function assertCacheDuration(value, propertyName) {
    if (typeof value !== "number" ||
        !Number.isFinite(value) ||
        value < 0) {
        throw new TypeError(`${propertyName} must be a finite, non-negative number.`);
    }
}
function stableSerialize(value, seen = new WeakSet()) {
    if (value === null) {
        return "null";
    }
    if (typeof value === "number" && !Number.isFinite(value)) {
        return JSON.stringify({
            type: "number",
            value: String(value),
        });
    }
    if (typeof value === "bigint") {
        return JSON.stringify({
            type: "bigint",
            value: value.toString(),
        });
    }
    if (typeof value !== "object") {
        return JSON.stringify(value === undefined
            ? { type: "undefined" }
            : value) ?? String(value);
    }
    if (value instanceof Date) {
        return JSON.stringify({
            type: "date",
            value: value.toISOString(),
        });
    }
    if (seen.has(value)) {
        throw new TypeError("Template cache key values cannot contain circular references.");
    }
    seen.add(value);
    const serialized = Array.isArray(value)
        ? `[${value.map(item => stableSerialize(item, seen)).join(",")}]`
        : `{${Object.entries(value)
            .sort(([first], [second]) => first.localeCompare(second))
            .map(([key, item]) => `${JSON.stringify(key)}:${stableSerialize(item, seen)}`)
            .join(",")}}`;
    seen.delete(value);
    return serialized;
}
class App {
    errorHandlers = [];
    _errorHandlerInstances = [];
    _identifier = "app";
    _appName;
    _serverComponentsUrl = null;
    _container;
    _dataStructure;
    _router = null;
    _dataChangeListeners = new Map();
    _handledErrors = new WeakMap();
    _originalInnerHTML;
    _originalOuterHTML;
    _originalInsertAdjacentHTML;
    _originalSetAttribute;
    _originalGetAttribute;
    _originalRemoveAttribute;
    _originalHasAttribute;
    _originalToggleAttribute;
    _originalDocQS;
    _originalDocQSA;
    _originalElQS;
    _originalElQSA;
    _templatesCache;
    _pendingTemplateCache = new Map();
    _templatesCacheDefaultDuration = 300;
    _templatesCacheCleanupInterval = 60;
    _templatesCacheCleanupTimer = null;
    constructor({ appName, serverComponentsUrl = null, dataStructure = null, container = null, templatesCacheDuration = null, templatesCacheCleanupInterval = null, }) {
        if (typeof appName !== "string" ||
            appName.trim().length === 0) {
            throw new TypeError("Application name must be a non-empty string.");
        }
        this._appName = appName;
        if (templatesCacheDuration !== null) {
            assertCacheDuration(templatesCacheDuration, "templatesCacheDuration");
            this._templatesCacheDefaultDuration = templatesCacheDuration;
        }
        if (templatesCacheCleanupInterval !== null) {
            assertCacheDuration(templatesCacheCleanupInterval, "templatesCacheCleanupInterval");
            this._templatesCacheCleanupInterval =
                templatesCacheCleanupInterval;
        }
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
            Element.prototype.setAttribute;
        this._originalGetAttribute =
            Element.prototype.getAttribute;
        this._originalRemoveAttribute =
            Element.prototype
                .removeAttribute;
        this._originalHasAttribute =
            Element.prototype.hasAttribute;
        this._originalToggleAttribute =
            Element.prototype.toggleAttribute;
        this._originalDocQS =
            Document.prototype.querySelector;
        this._originalDocQSA =
            Document.prototype.querySelectorAll;
        this._originalElQS =
            Element.prototype.querySelector;
        this._originalElQSA =
            Element.prototype.querySelectorAll;
        this._templatesCache = new Map;
    }
    init = async (target) => {
        const container = this._resolveContainer(target);
        this._container = container;
        this._container.app = this.application;
        this._container.setAttribute("app-id", this.generateHash());
        this._startTemplatesCacheCleanup();
        this._modifyPrototypeMethods();
        this._errorHandlerInstances = this._initializeErrorHandlers();
        await this._runLifecycleStage(Lifecycle.BEFORE_INIT);
        await this._runLifecycleStage(Lifecycle.EXTENSION_INIT);
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
            CustomElement).filter(element => {
            // Each top-level component waits for its own children.
            let parent = element.parentElement;
            while (parent && parent !== this.container) {
                if (parent instanceof CustomElement)
                    return false;
                parent = parent.parentElement;
            }
            return parent === this.container;
        });
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
        if (isElementCancellation(error))
            return;
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
    handleErrorOnce = (error) => {
        if (!(error instanceof Error)) {
            return Promise.reject(new Error("Failed to handle error. Provided " +
                "instance is not an instance of Error."));
        }
        const existing = this._handledErrors.get(error);
        if (existing) {
            return existing;
        }
        const handling = this.handleError(error);
        this._handledErrors.set(error, handling);
        return handling;
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
        if (prototypeMethodsModified) {
            return;
        }
        const appInstance = this;
        Element.prototype.setAttribute = function (name, value) {
            const normalizedName = normalizeJoltAttributeName(name);
            const previousValue = appInstance._originalGetAttribute.call(this, normalizedName);
            appInstance._originalSetAttribute.call(this, normalizedName, value);
            if (this instanceof CustomElement &&
                previousValue !== value) {
                this._refreshBoundElements(getAttributeBindingName(normalizedName));
            }
        };
        Element.prototype.removeAttribute = function (name) {
            const normalizedName = normalizeJoltAttributeName(name);
            const attributeExisted = appInstance._originalHasAttribute.call(this, normalizedName);
            appInstance._originalRemoveAttribute.call(this, normalizedName);
            if (this instanceof CustomElement &&
                attributeExisted) {
                this._refreshBoundElements(getAttributeBindingName(normalizedName));
            }
        };
        Element.prototype.getAttribute = function (name) {
            return appInstance._originalGetAttribute.call(this, normalizeJoltAttributeName(name));
        };
        Element.prototype.hasAttribute = function (name) {
            return appInstance._originalHasAttribute.call(this, normalizeJoltAttributeName(name));
        };
        Element.prototype.toggleAttribute = function (name, force) {
            const normalizedName = normalizeJoltAttributeName(name);
            const existedBefore = appInstance._originalHasAttribute.call(this, normalizedName);
            const existsAfter = appInstance._originalToggleAttribute.call(this, normalizedName, force);
            if (this instanceof CustomElement &&
                existedBefore !== existsAfter) {
                this._refreshBoundElements(getAttributeBindingName(normalizedName));
            }
            return existsAfter;
        };
        const elementsBetween = (first, end) => {
            const elements = [];
            let current = first;
            while (current && current !== end) {
                if (current instanceof Element) {
                    elements.push(current);
                }
                current = current.nextSibling;
            }
            return elements;
        };
        Element.prototype.insertAdjacentHTML = function (position, html) {
            const customElement = this.closest("[data-hash-id]");
            if (customElement) {
                const renderedTemplate = customElement.dotJSengine(html);
                if (!renderedTemplate) {
                    return;
                }
                const parent = this.parentNode;
                const previousSibling = this.previousSibling;
                const nextSibling = this.nextSibling;
                const firstChild = this.firstChild;
                const lastChild = this.lastChild;
                appInstance._originalInsertAdjacentHTML.call(this, position, renderedTemplate);
                let insertedElements;
                switch (position) {
                    case "beforebegin":
                        insertedElements = parent
                            ? elementsBetween(previousSibling
                                ? previousSibling.nextSibling
                                : parent.firstChild, this)
                            : [];
                        break;
                    case "afterbegin":
                        insertedElements = elementsBetween(this.firstChild, firstChild);
                        break;
                    case "beforeend":
                        insertedElements = elementsBetween(lastChild
                            ? lastChild.nextSibling
                            : this.firstChild, null);
                        break;
                    case "afterend":
                        insertedElements = parent
                            ? elementsBetween(this.nextSibling, nextSibling)
                            : [];
                        break;
                }
                customElement.tagInsertedElements(insertedElements);
                customElement.hydrate(insertedElements);
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
                    const parent = this.parentNode;
                    const previousSibling = this.previousSibling;
                    const nextSibling = this.nextSibling;
                    appInstance._originalOuterHTML.call(this, renderedTemplate);
                    const insertedElements = parent
                        ? elementsBetween(previousSibling
                            ? previousSibling.nextSibling
                            : parent.firstChild, nextSibling)
                        : [];
                    customElement.tagInsertedElements(insertedElements);
                    customElement.hydrate(insertedElements);
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
        prototypeMethodsModified = true;
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
    _queryChangeEvent(field) {
        this.container.dispatchEvent(new CustomEvent(dataEventEnum.QUERY_CHANGE, {
            detail: { field },
        }));
    }
    _getChangedQueryParameterNames(previousParameters, currentParameters) {
        const parameterNames = new Set([
            ...previousParameters.keys(),
            ...currentParameters.keys(),
        ]);
        const changedParameterNames = [];
        for (const parameterName of parameterNames) {
            const previousValues = previousParameters.getAll(parameterName);
            const currentValues = currentParameters.getAll(parameterName);
            if (previousValues.length !==
                currentValues.length ||
                previousValues.some((value, index) => value !==
                    currentValues[index])) {
                changedParameterNames.push(parameterName);
            }
        }
        return changedParameterNames;
    }
    _emitQueryParameterChanges(parameterNames) {
        for (const parameterName of parameterNames) {
            this._queryChangeEvent(parameterName);
        }
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
        const previousParameters = new URLSearchParams(url.search);
        url.search = "";
        for (const [key, value] of Object.entries(params)) {
            url.searchParams.set(key, value);
        }
        const changedParameterNames = this._getChangedQueryParameterNames(previousParameters, url.searchParams);
        if (changedParameterNames.length === 0) {
            return;
        }
        history.pushState(history.state, "", url);
        this._emitQueryParameterChanges(changedParameterNames);
    }
    setQueryParameters(params) {
        this.queryParameters = params;
    }
    updateQueryParameters(params) {
        const url = new URL(location.href);
        const previousParameters = new URLSearchParams(url.search);
        for (const [key, value] of Object.entries(params)) {
            if (value === null) {
                url.searchParams.delete(key);
                continue;
            }
            url.searchParams.set(key, String(value));
        }
        const changedParameterNames = this._getChangedQueryParameterNames(previousParameters, url.searchParams);
        if (changedParameterNames.length === 0) {
            return;
        }
        history.pushState(history.state, "", url);
        this._emitQueryParameterChanges(changedParameterNames);
    }
    createQueryParametersString(params, exclude) {
        const searchParams = new URLSearchParams();
        for (const [key, value] of Object.entries(params)) {
            if (exclude && exclude.includes(key)) {
                continue;
            }
            searchParams.set(key, String(value));
        }
        return searchParams.toString();
    }
    getTemplateCacheKey(tagName, args = {}) {
        const queryParameters = Array.from(new URLSearchParams(location.search).entries()).sort(([firstKey, firstValue], [secondKey, secondValue]) => firstKey.localeCompare(secondKey) ||
            firstValue.localeCompare(secondValue));
        const routeParameters = this._router?.routeParameters ?? {};
        return stableSerialize({
            tagName: tagName.toLowerCase(),
            routeParameters,
            queryParameters,
            args,
            appData: Object.fromEntries(this._dataStructure),
        });
    }
    setCachedTemplate(key, template, duration) {
        assertCacheDuration(duration, "duration");
        if (duration === 0) {
            this._templatesCache.delete(key);
            return;
        }
        this._templatesCache.set(key, {
            template,
            duration,
            setTime: Date.now(),
        });
    }
    getCachedTemplate(key) {
        const cache = this._templatesCache.get(key);
        if (!cache) {
            return null;
        }
        if (Date.now() - cache.setTime >=
            cache.duration * 1000) {
            this._templatesCache.delete(key);
            return null;
        }
        return cache.template;
    }
    async getOrSetCachedTemplate(key, duration, templateFactory) {
        const cachedTemplate = this.getCachedTemplate(key);
        if (cachedTemplate !== null) {
            return cachedTemplate;
        }
        const pendingTemplate = this._pendingTemplateCache.get(key);
        if (pendingTemplate) {
            return await pendingTemplate;
        }
        const templatePromise = Promise.resolve()
            .then(templateFactory)
            .then(template => {
            this.setCachedTemplate(key, template, duration);
            return template;
        })
            .finally(() => {
            this._pendingTemplateCache.delete(key);
        });
        this._pendingTemplateCache.set(key, templatePromise);
        return await templatePromise;
    }
    removeCachedTemplate(key) {
        return this._templatesCache.delete(key);
    }
    cleanTemplatesCache = () => {
        const currentTime = Date.now();
        let removedEntries = 0;
        for (const [key, cache] of this._templatesCache) {
            if (currentTime - cache.setTime >=
                cache.duration * 1000) {
                this._templatesCache.delete(key);
                removedEntries++;
            }
        }
        return removedEntries;
    };
    _startTemplatesCacheCleanup() {
        if (this._templatesCacheCleanupTimer !== null) {
            globalThis.clearInterval(this._templatesCacheCleanupTimer);
            this._templatesCacheCleanupTimer = null;
        }
        if (this._templatesCacheCleanupInterval === 0) {
            return;
        }
        this._templatesCacheCleanupTimer =
            globalThis.setInterval(this.cleanTemplatesCache, this._templatesCacheCleanupInterval * 1000);
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
    get templatesCacheDuration() {
        return this._templatesCacheDefaultDuration;
    }
    set templatesCacheDuration(duration) {
        assertCacheDuration(duration, "templatesCacheDuration");
        this._templatesCacheDefaultDuration = duration;
    }
    get templatesCacheCleanupInterval() {
        return this._templatesCacheCleanupInterval;
    }
    set templatesCacheCleanupInterval(interval) {
        assertCacheDuration(interval, "templatesCacheCleanupInterval");
        this._templatesCacheCleanupInterval = interval;
        this._startTemplatesCacheCleanup();
    }
}
export default App;
//# sourceMappingURL=app.js.map