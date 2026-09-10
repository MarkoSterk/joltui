import App, { dataEventEnum, } from "./app.js";
import { awaitWithSignal, ElementDisconnectedError, isElementCancellation, } from "./cancellation.js";
import doT, {} from "./dotjs/dot.js";
import { Lifecycle, getLifecycleMethods, } from "./lifecycle.js";
import { requireElementMetadata, } from "./elementMetadata.js";
import { AuthenticationError, AuthorizationError, HttpRequestError, InternalServerError, NetworkError, ServerComponentNotFound, ServerComponentBadRequestResponse, } from "./errors.js";
export class RenderError extends Error {
    elementName;
    constructor(elementName) {
        super(`Failed to render element ${elementName}`);
        this.name = "RenderError";
        this.elementName = elementName;
    }
}
export class MissingMarkupMethod extends Error {
    elementName;
    constructor(elementName) {
        super(`Missing markup method for element ${elementName}`);
        this.name = "MissingMarkupMethod";
        this.elementName = elementName;
    }
}
export class DotJSEngineError extends Error {
    elementName;
    constructor(elementName, options) {
        super(`Error in dotJS templating engine in element ${elementName}`, options);
        this.name = "DotJSEngineError";
        this.elementName = elementName;
    }
}
export class MethodExecutionError extends Error {
    methodName;
    elementName;
    constructor(methodName, elementName, options) {
        super(`Failed to execute method '${methodName}' ` +
            `on element '${elementName}'`, options);
        this.name = "MethodExecutionError";
        this.methodName = methodName;
        this.elementName = elementName;
    }
}
export class ElementInitializationError extends Error {
    element;
    elementName;
    constructor(element, options) {
        const elementName = element.tagName.toLowerCase();
        super(`Failed to initialize element ` +
            `'${elementName}'.`, options);
        this.name = "ElementInitializationError";
        this.element = element;
        this.elementName = elementName;
    }
}
export class MarkupFetchError extends Error {
    elementName;
    constructor(msg, tagName) {
        super(msg);
        this.elementName = tagName;
        this.name = "MarkupFetchError";
    }
}
const baseTemplateSettings = Object.freeze({
    evaluate: /\{\{([\s\S]+?)\}\}/g,
    interpolate: /\{\{=([\s\S]+?)\}\}/g,
    encode: /\{\{!([\s\S]+?)\}\}/g,
    use: /\{\{#([\s\S]+?)\}\}/g,
    define: /\{\{##\s*([\w.$]+)\s*(:|=)([\s\S]+?)#\}\}/g,
    conditional: /\{\{\?(\?)?\s*([\s\S]*?)\s*\}\}/g,
    iterate: /\{\{~\s*(?:\}\}|([\s\S]+?)\s*:\s*([\w$]+)\s*(?::\s*([\w$]+))?\s*\}\})/g,
    varname: "it",
    strip: true,
    append: true,
    selfcontained: false,
});
function createTemplateSettings() {
    return {
        ...baseTemplateSettings,
        def: {},
        dataBinds: new Map(),
        sanitizeFunc: value => value,
    };
}
export function randomId(max = 10000, min = 1) {
    return (Math.floor(Math.random() * (max - min + 1)) + min);
}
export const html = (strings, ...values) => {
    return strings.reduce((result, part, index) => result + part + (values[index] ?? ""), "");
};
export class CustomElement extends HTMLElement {
    static tagName = "";
    static dependencies = [];
    _app = null;
    _resolveInitialization = null;
    _rejectInitialization = null;
    _initializationState = "pending";
    _initializationError = null;
    _initializationTask = null;
    _templateSettings = createTemplateSettings();
    _parent = null;
    _renderTime = 0;
    _lastRender = 0;
    _abort = false;
    _abortController = new AbortController();
    get abortSignal() {
        return this._abortController.signal;
    }
    initComplete;
    rndId;
    hashId = "";
    markup = null;
    constructor() {
        super();
        this.rndId = randomId();
        this.initComplete = new Promise((resolve, reject) => {
            this._resolveInitialization = resolve;
            this._rejectInitialization = reject;
        });
        void this.initComplete.catch(() => undefined);
        this.abortSignal.addEventListener("abort", () => {
            this._abort = true;
            this._failInitialization(this.abortSignal.reason);
        }, { once: true });
    }
    async connectedCallback() {
        if (this._initializationState !== "pending" ||
            this._initializationTask) {
            return;
        }
        if (this.hasAttribute("defer")) {
            this._completeInitialization();
            return;
        }
        try {
            await this.initElement();
        }
        catch (error) {
            if (!isElementCancellation(error))
                throw error;
        }
    }
    disconnectedCallback() {
        this._abortController.abort(new ElementDisconnectedError(this.tagName));
        if (!this._app) {
            return;
        }
        this._abort = true;
        this.app.removeEventListener(dataEventEnum.CHANGE, this._updateBoundAppDataParts);
        this.app.removeEventListener(dataEventEnum.QUERY_CHANGE, this._updateBoundQueryParamParts);
        if (this.dataField) {
            this.app.removeDataListener(this);
        }
        void this._runLifecycle(Lifecycle.AFTER_DISCONNECT).catch(error => this.app.handleErrorOnce(error));
    }
    initElement = () => {
        if (this._initializationTask) {
            return this._initializationTask;
        }
        if (this._initializationState !== "pending") {
            return this.initComplete;
        }
        this._initializationTask =
            awaitWithSignal(this._initializeElement(), this.abortSignal);
        return this._initializationTask;
    };
    _initializeElement = async () => {
        try {
            this.abortSignal.throwIfAborted();
            this._abort = false;
            const appContainer = this.closest("[app-id]");
            if (!appContainer?.app) {
                throw new Error(`Failed to detect application ` +
                    `container for ${this.tagName}`);
            }
            this._app = appContainer.app;
            this.rndId = randomId();
            this.hashId =
                this.getAttribute("data-hash-id") ??
                    this.generateHash();
            if (!this.hasAttribute("data-hash-id")) {
                this.setAttribute("data-hash-id", this.hashId);
            }
            if (!this.hasAttribute("data-parent-id")) {
                const parent = this.parentElement?.closest("[data-hash-id]") ?? null;
                const parentId = parent?.getAttribute("data-hash-id");
                if (parent && parentId) {
                    this.setAttribute("data-parent-id", parentId);
                    this._parent = parent;
                }
            }
            this._templateSettings =
                createTemplateSettings();
            // Children can initialize before their parent adopts their host.
            this._normalizePrerenderedAttributes(this);
            await awaitWithSignal(this._loadDependencies(), this.abortSignal);
            this._throwIfInitializationAborted();
            await this._runLifecycle(Lifecycle.BEFORE_INIT);
            this._throwIfInitializationAborted();
            this.app.addEventListener(dataEventEnum.CHANGE, this._updateBoundAppDataParts);
            this.app.addEventListener(dataEventEnum.QUERY_CHANGE, this._updateBoundQueryParamParts);
            if (this.dataField) {
                this.app.registerDataListener(this);
            }
            if (!this.useServer && !this.markup) {
                this._initializePrerenderedMarkup();
            }
            else {
                await this.render();
            }
            this._throwIfInitializationAborted();
            await this._waitForSubelements();
            this._throwIfInitializationAborted();
            await this._runLifecycle(Lifecycle.BEFORE_INIT_RESOLVE);
            this.abortSignal.throwIfAborted();
            this._completeInitialization();
            await this._runLifecycle(Lifecycle.AFTER_INIT);
        }
        catch (error) {
            this._abort = true;
            if (this.abortSignal.aborted || isElementCancellation(error)) {
                const cancellation = this.abortSignal.aborted
                    ? this.abortSignal.reason
                    : error;
                this._failInitialization(cancellation);
                throw cancellation;
            }
            if (this._initializationState ===
                "pending") {
                const initializationError = error instanceof
                    ElementInitializationError
                    ? error
                    : new ElementInitializationError(this, { cause: error });
                this._failInitialization(initializationError);
                await this._handleError(initializationError);
                return;
            }
            await this._handleError(error);
        }
    };
    _completeInitialization() {
        if (this._initializationState !== "pending") {
            return;
        }
        this._initializationState = "fulfilled";
        this._resolveInitialization?.();
        this._resolveInitialization = null;
        this._rejectInitialization = null;
    }
    _failInitialization(error) {
        if (this._initializationState !== "pending") {
            return;
        }
        this._initializationState = "rejected";
        this._initializationError = error;
        this._rejectInitialization?.(error);
        this._resolveInitialization = null;
        this._rejectInitialization = null;
    }
    _throwIfInitializationAborted() {
        if (!this._abort && this.isConnected) {
            return;
        }
        if (!this.abortSignal.aborted) {
            this._abortController.abort(new ElementDisconnectedError(this.tagName));
        }
        this.abortSignal.throwIfAborted();
    }
    async _loadDependencies() {
        const constructorChain = [];
        let constructor = this.constructor;
        while (constructor === CustomElement ||
            constructor.prototype instanceof
                CustomElement) {
            constructorChain.unshift(constructor);
            constructor = Object.getPrototypeOf(constructor);
        }
        const dependencies = new Set();
        for (const elementClass of constructorChain) {
            if (!Object.prototype.hasOwnProperty.call(elementClass, "dependencies")) {
                continue;
            }
            const declaredDependencies = elementClass.dependencies;
            if (!Array.isArray(declaredDependencies)) {
                throw new TypeError(`Static dependencies for ` +
                    `'${this.tagName}' must be an array.`);
            }
            for (const dependency of declaredDependencies) {
                if (!dependency ||
                    typeof dependency.load !== "function") {
                    throw new TypeError(`Invalid lazy dependency declared by ` +
                        `'${this.tagName}'.`);
                }
                dependencies.add(dependency);
            }
        }
        await Promise.all(Array.from(dependencies, dependency => dependency.load()));
    }
    async _handleError(error) {
        if (this.abortSignal.aborted || isElementCancellation(error))
            return;
        await this.app.handleErrorOnce(error);
    }
    async _runLifecycle(stage) {
        const disconnecting = stage === Lifecycle.AFTER_DISCONNECT;
        if (!disconnecting)
            this.abortSignal.throwIfAborted();
        for (const { name, method } of getLifecycleMethods(this, stage)) {
            try {
                if (disconnecting) {
                    await method.call(this);
                }
                else {
                    this.abortSignal.throwIfAborted();
                    await awaitWithSignal(Promise.resolve(method.call(this)), this.abortSignal);
                    this.abortSignal.throwIfAborted();
                }
            }
            catch (error) {
                if (isElementCancellation(error))
                    throw error;
                throw new MethodExecutionError(name, this.tagName, { cause: error });
            }
        }
        if (!disconnecting)
            this.abortSignal.throwIfAborted();
    }
    async _markup() {
        try {
            if (this.markup == null) {
                throw new MissingMarkupMethod(this.tagName);
            }
            return await this.markup.call(this);
        }
        catch (error) {
            if (isElementCancellation(error))
                throw error;
            if (error instanceof
                MissingMarkupMethod) {
                throw error;
            }
            throw new RenderError(this.tagName);
        }
    }
    templateCacheKey() {
        return this.app.getTemplateCacheKey(this.tagName, this.args);
    }
    _normalizePrerenderedAttributes(element) {
        for (const attribute of Array.from(element.attributes)) {
            const prefix = attribute.name[0];
            if (prefix !== ":" && prefix !== "@")
                continue;
            const suffix = attribute.name.substring(1);
            if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(suffix)) {
                throw new Error(`Invalid shorthand attribute '${attribute.name}' ` +
                    `on <${element.localName}>.`);
            }
            const normalizedName = prefix === ":"
                ? `data-jolt-${suffix}`
                : `jolt-${suffix}`;
            if (!element.hasAttribute(normalizedName)) {
                element.setAttribute(normalizedName, attribute.value);
            }
            // removeAttribute(":name") would remove the canonical attribute.
            element.removeAttributeNode(attribute);
        }
    }
    _isCustomElementBoundary(element) {
        return element.namespaceURI === "http://www.w3.org/1999/xhtml" &&
            element.localName.includes("-");
    }
    _getOwnedElements(roots) {
        const owned = [];
        const visited = new Set();
        const visit = (element) => {
            if (visited.has(element))
                return;
            visited.add(element);
            owned.push(element);
            // Include child hosts, but never their contents, even before upgrade.
            if (this._isCustomElementBoundary(element))
                return;
            for (const child of Array.from(element.children)) {
                visit(child);
            }
        };
        for (const root of roots) {
            // Explicit insertion roots may themselves be inside another component.
            let parent = root.parentElement;
            while (parent && parent !== this) {
                if (this._isCustomElementBoundary(parent))
                    break;
                parent = parent.parentElement;
            }
            if (parent === this)
                visit(root);
        }
        return owned;
    }
    _getPrerenderedOwnedElements() {
        const owned = this._getOwnedElements(Array.from(this.children));
        for (const child of owned) {
            if (this._isCustomElementBoundary(child) && !customElements.get(child.localName)) {
                throw new Error(`Cannot initialize <${this.localName}>: ` +
                    `child <${child.localName}> is not registered. ` +
                    `Register it before initialization or declare it ` +
                    `in the host component's dependencies.`);
            }
        }
        return owned;
    }
    _initializePrerenderedMarkup() {
        this.abortSignal.throwIfAborted();
        const elements = this._getPrerenderedOwnedElements();
        this._lastRender = Date.now();
        const renderTime = this.lastRender.toString();
        for (const element of elements) {
            this.abortSignal.throwIfAborted();
            this._normalizePrerenderedAttributes(element);
            element.setAttribute("data-parent-id", this.hashId);
            element.setAttribute("data-render-time", renderTime);
        }
        this.abortSignal.throwIfAborted();
        this._hydrateElements(elements);
    }
    render = async () => {
        try {
            this.abortSignal.throwIfAborted();
            const renderTemplate = async (signal = this.abortSignal) => {
                if (this.useServer) {
                    return await this._fetchHTML(signal);
                }
                if (!this.markup) {
                    const markup = this.innerHTML.trim();
                    return markup;
                }
                return await this._markup();
            };
            let renderedHtml;
            if (this.cache) {
                const cacheKey = this.templateCacheKey();
                if ((typeof cacheKey !== "string" ||
                    cacheKey.trim().length === 0)) {
                    throw new TypeError("templateCacheKey must return a non-empty string.");
                }
                const cacheDuration = this.cacheDuration ??
                    this.app.templatesCacheDuration;
                renderedHtml = cacheDuration > 0
                    ? await awaitWithSignal(this.app.getOrSetCachedTemplate(cacheKey, cacheDuration, () => renderTemplate(null)), this.abortSignal)
                    : await awaitWithSignal(renderTemplate(), this.abortSignal);
            }
            else {
                renderedHtml = await awaitWithSignal(renderTemplate(), this.abortSignal);
            }
            this.abortSignal.throwIfAborted();
            this.innerHTML = renderedHtml;
        }
        catch (error) {
            this._abort = true;
            throw error;
        }
    };
    _fetchHTML = async (signal = this.abortSignal) => {
        return await this.fetchHTML({
            tagName: this.tagName.toLowerCase(),
            groupName: this.groupName == null ? "default" : this.groupName,
            queryParameters: this.app.queryParameters || {},
            routeParameters: this.app?.router.routeParameters || {},
            attributes: this.args,
        }, signal);
    };
    fetchHTML = async (request, signal = this.abortSignal) => {
        signal?.throwIfAborted();
        if (!this.app.serverComponentsUrl) {
            throw new Error("If using server components you need to provide the " +
                "'serverComponentsUrl' property at application initialization.");
        }
        let response;
        try {
            const url = `${this.app.serverComponentsUrl}?${this.app.createQueryParametersString(this.app.queryParameters)}`;
            response = await fetch(url, {
                method: "POST",
                signal,
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(request)
            });
        }
        catch {
            signal?.throwIfAborted();
            throw new NetworkError("Failed to fetch requested content. Server unresponsive.");
        }
        signal?.throwIfAborted();
        if (!response.ok) {
            return this._checkFetchHTMLError(response);
        }
        try {
            const text = await response.text();
            signal?.throwIfAborted();
            if (text.trim().length === 0) {
                throw new MarkupFetchError("Fetched HTML markup was empty for a 2xx response.", this.tagName);
            }
            return text;
        }
        catch (error) {
            signal?.throwIfAborted();
            if (error instanceof MarkupFetchError) {
                throw error;
            }
            throw new MarkupFetchError("Failed to read fetched html markup for 2xx responses.", this.tagName);
        }
    };
    _checkFetchHTMLError = (response) => {
        const requestedPath = `${location.pathname}${location.search}`;
        if (response.status >= 500) {
            throw new InternalServerError(`Server component fetch failed with status ${response.status}`);
        }
        switch (response.status) {
            case 400:
                throw new ServerComponentBadRequestResponse(this.tagName.toLowerCase(), this.groupName || "default");
            case 401:
                throw new AuthenticationError(requestedPath);
            case 403:
                throw new AuthorizationError(requestedPath, []);
            case 404:
                throw new ServerComponentNotFound(this.tagName.toLowerCase(), this.groupName || "default");
            default:
                throw new HttpRequestError("POST", response);
        }
    };
    rerender = async () => {
        try {
            this.abortSignal.throwIfAborted();
            this._templateSettings.dataBinds.clear();
            await this._runLifecycle(Lifecycle.BEFORE_RERENDER);
            await this.render();
            if (this._abort) {
                return;
            }
            await this._waitForSubelements();
            await this._runLifecycle(Lifecycle.AFTER_RERENDER);
        }
        catch (error) {
            this._abort = true;
            if (this.abortSignal.aborted)
                throw this.abortSignal.reason;
            await this._handleError(error);
            throw error;
        }
    };
    async _waitForSubelements() {
        this.abortSignal.throwIfAborted();
        const customElements = Array.from(this.querySelectorAll("*")).filter((element) => element instanceof CustomElement).filter(element => {
            // HTML wrappers do not establish a component boundary.
            let parent = element.parentElement;
            while (parent && parent !== this) {
                if (parent instanceof CustomElement)
                    return false;
                parent = parent.parentElement;
            }
            return parent === this;
        });
        await awaitWithSignal(Promise.all(customElements.map(element => element.initComplete)), this.abortSignal);
    }
    generateHash(length = 16) {
        return this.app.generateHash(length);
    }
    _updateBoundAppDataParts = (event) => {
        const customEvent = event;
        this._refreshBoundElements(`app.${customEvent.detail.field}`);
    };
    _updateBoundQueryParamParts = (event) => {
        const customEvent = event;
        this._refreshBoundElements(`query.${customEvent.detail.field}`);
    };
    invalidate(bindingName) {
        if (!bindingName) {
            throw new TypeError("Binding name cannot be empty.");
        }
        this._refreshBoundElements(bindingName);
    }
    _refreshBoundElements(propertyName) {
        if (this.abortSignal.aborted)
            return;
        const templates = this._templateSettings.dataBinds.get(propertyName);
        if (!templates) {
            return;
        }
        this._renderTime = Date.now();
        this.querySelectorAll(`[data-bind="${propertyName}"]`).forEach(element => {
            if (this.abortSignal.aborted)
                return;
            const elementId = element.getAttribute("data-bind-id");
            if (!elementId) {
                return;
            }
            const elementTemplate = templates[elementId];
            if (elementTemplate === undefined) {
                return;
            }
            element.setAttribute("data-render-time", this._renderTime.toString());
            if (this.abortSignal.aborted)
                return;
            element.innerHTML =
                elementTemplate;
        });
    }
    _hydrate = (roots = null) => {
        const elements = roots
            ? this._getOwnedElements(roots)
            : this._getOwnedElements(Array.from(this.children)).filter(element => element.getAttribute("data-parent-id") === this.hashId &&
                element.getAttribute("data-render-time") === String(this.lastRender));
        this._hydrateElements(elements);
    };
    _hydrateElements(elements) {
        const elementsWithEvents = this._allElementsWithEvents(elements);
        this._setEventListeners(elementsWithEvents);
    }
    _setEventListeners(elementsWithEvents) {
        for (const eventConfig of elementsWithEvents) {
            const { element, eventName, methodName, } = eventConfig;
            const activeKey = `jolt-${eventName}:active`;
            const listenerKey = `jolt-${eventName}:active-method-` +
                methodName;
            const eventElement = element;
            if (eventElement[activeKey]) {
                continue;
            }
            const listener = this._createEventListenerMethod(element, methodName);
            element.addEventListener(eventName, listener);
            eventElement[activeKey] = true;
            eventElement[listenerKey] =
                listener;
        }
    }
    _createEventListenerMethod(element, methodName) {
        return async (event) => {
            await this._executeElementMethod(element, methodName, event);
        };
    }
    async _executeElementMethod(element, methodName, event) {
        try {
            this.abortSignal.throwIfAborted();
            const args = this._getAllArgs(element);
            const dynamicElement = this;
            const method = dynamicElement[methodName];
            if (typeof method !== "function") {
                throw new Error(`Method '${methodName}' ` +
                    `does not exist on element ` +
                    `'${this.tagName}'`);
            }
            const boundMethod = method;
            if (Object.keys(args).length > 0) {
                await awaitWithSignal(Promise.resolve(boundMethod.call(this, event, args)), this.abortSignal);
            }
            else {
                await awaitWithSignal(Promise.resolve(boundMethod.call(this, event)), this.abortSignal);
            }
        }
        catch (error) {
            await this._handleError(new MethodExecutionError(methodName, this.tagName, { cause: error }));
        }
    }
    _getAllArgs(element) {
        const data = {};
        for (const attribute of Array.from(element.attributes)) {
            const isJoltArgument = attribute.name.startsWith("data-jolt-");
            const isColonArgument = attribute.name.startsWith(":");
            const isInternalArgument = attribute.name.startsWith("data-jolt-is-active-");
            if ((isJoltArgument ||
                isColonArgument) &&
                !isInternalArgument) {
                const key = isJoltArgument
                    ? attribute.name.substring("data-jolt-".length)
                    : attribute.name.substring(1);
                let value = attribute.value;
                try {
                    value = JSON.parse(attribute.value.trim());
                }
                catch {
                    value = attribute.value;
                }
                data[key] = value;
            }
        }
        return data;
    }
    _allElementsWithEvents(allElements) {
        const elementsWithEvents = [];
        for (const element of allElements) {
            elementsWithEvents.push(...this._elementWithEvent(element));
        }
        return elementsWithEvents;
    }
    _elementWithEvent(element) {
        const events = [];
        for (const attribute of Array.from(element.attributes)) {
            if (attribute.name.startsWith("jolt-") &&
                !attribute.name.startsWith("jolt-show-if")) {
                events.push({
                    element,
                    eventName: attribute.name.substring("jolt-".length),
                    methodName: attribute.value,
                });
            }
        }
        return events;
    }
    _dotJSengine = (template) => {
        try {
            const templateFunction = doT.template.call(this, template, this._templateSettings, undefined);
            const renderedTemplate = templateFunction.call(this, {}, this._templateSettings
                .sanitizeFunc);
            return this._parseStringTemplate(renderedTemplate);
        }
        catch (error) {
            this._abort = true;
            throw new DotJSEngineError(this.tagName, { cause: error });
        }
    };
    _parseStringTemplate(template) {
        let parsedTemplate = this._replaceAtWithJolt(template);
        parsedTemplate =
            this._replaceColonWithData(parsedTemplate);
        return parsedTemplate;
    }
    _tagInsertedElements = (roots) => {
        this._lastRender = Date.now();
        for (const child of this._getOwnedElements(roots)) {
            child.setAttribute("data-parent-id", this.hashId);
            child.setAttribute("data-render-time", this.lastRender.toString());
        }
    };
    _replaceAtWithJolt(template) {
        return template.replace(/@([a-z][a-z0-9]*(?:-[a-z0-9]+)*)=/g, "jolt-$1=");
    }
    _replaceColonWithData(template) {
        return template.replace(/:([a-z][a-z0-9]*(?:-[a-z0-9]+)*)=/g, "data-jolt-$1=");
    }
    getData(field) {
        return this.app.getData(field);
    }
    setData(field, data) {
        this.app.setData(field, data);
    }
    get data() {
        return this.app.data;
    }
    get lastRender() {
        return this._lastRender;
    }
    get initializationState() {
        return this._initializationState;
    }
    get initializationError() {
        return this._initializationError;
    }
    get app() {
        if (!this._app) {
            throw new Error(`Application object not found ` +
                `for element '${this.tagName}'`);
        }
        return this._app;
    }
    get metadata() {
        return requireElementMetadata(this.constructor);
    }
    get dataField() {
        return this.metadata.dataField;
    }
    get groupName() {
        return this.metadata.groupName;
    }
    get useServer() {
        return this.metadata.useServer;
    }
    get cache() {
        return this.metadata.cache;
    }
    get cacheDuration() {
        return this.metadata.cacheDuration;
    }
    get parent() {
        return this._parent;
    }
    get args() {
        return this._getAllArgs(this);
    }
    get dotJSengine() {
        return this._dotJSengine;
    }
    get tagInsertedElements() {
        return this._tagInsertedElements;
    }
    get hydrate() {
        return this._hydrate;
    }
    static generate(hashId, args = null) {
        const generatedArguments = Object.entries(args ?? {}).map(([name, value]) => {
            const serializedValue = typeof value === "string"
                ? value
                : JSON.stringify(value);
            return (`data-jolt-${name}="` +
                `${escapeHtmlAttribute(serializedValue)}"`);
        });
        const argumentString = generatedArguments.length > 0
            ? ` ${generatedArguments.join(" ")}`
            : "";
        const hashIdAttribute = hashId
            ? (` data-hash-id="` +
                `${escapeHtmlAttribute(hashId)}"`)
            : "";
        return (`<${this.tagName}` +
            `${hashIdAttribute}` +
            `${argumentString}>` +
            `</${this.tagName}>`);
    }
}
export function escapeHtmlAttribute(value) {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll('"', "&quot;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
}
export default CustomElement;
//# sourceMappingURL=customElement.js.map