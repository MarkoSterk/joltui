import App, { dataEventEnum, } from "./app.js";
import doT, {} from "./dotjs/dot.js";
import { Lifecycle, getLifecycleMethods, } from "./lifecycle.js";
import { requireElementMetadata, } from "./elementMetadata.js";
import { AuthenticationError, AuthorizationError, InternalServerError, NetworkError, ServerComponentNotFound, ServerComponentBadRequestResponse } from "./errors.js";
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
    constructor(elementName) {
        super(`Error in dotJS templating engine in element ${elementName}`);
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
export const html = String.raw;
export class CustomElement extends HTMLElement {
    static tagName = "";
    _app = null;
    _resolveInitialization = null;
    _templateSettings = createTemplateSettings();
    _parent = null;
    _renderTime = 0;
    _lastRender = 0;
    _abort = false;
    _virtualRenderDiv = "virtual-render-div";
    initComplete;
    rndId;
    hashId = "";
    // markup: MarkupMethod = function (
    //     this: CustomElement,
    // ): never {
    //     throw new MissingMarkupMethod(this.tagName);
    // };
    markup = null;
    constructor() {
        super();
        this.rndId = randomId();
        this.initComplete = new Promise(resolve => {
            this._resolveInitialization = resolve;
        });
    }
    async connectedCallback() {
        if (this.hasAttribute("defer")) {
            this._resolveInitComplete();
            return;
        }
        await this.initElement();
    }
    disconnectedCallback() {
        if (!this._app) {
            return;
        }
        this._abort = true;
        this.app.removeEventListener(dataEventEnum.CHANGE, this._updateBoundAppDataParts);
        this.app.removeEventListener(dataEventEnum.QUERY_CHANGE, this._updateBoundQueryParamParts);
        if (this.dataField) {
            this.app.removeDataListener(this);
        }
        void this._runLifecycle(Lifecycle.AFTER_DISCONNECT);
    }
    initElement = async () => {
        try {
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
            await this._runLifecycle(Lifecycle.BEFORE_INIT);
            this.app.addEventListener(dataEventEnum.CHANGE, this._updateBoundAppDataParts);
            this.app.addEventListener(dataEventEnum.QUERY_CHANGE, this._updateBoundQueryParamParts);
            if (this.dataField) {
                this.app.registerDataListener(this);
            }
            await this.render();
            if (this._abort) {
                this._resolveInitComplete();
                return;
            }
            await this._waitForSubelements();
            await this._runLifecycle(Lifecycle.BEFORE_INIT_RESOLVE);
            this._resolveInitComplete();
            await this._runLifecycle(Lifecycle.AFTER_INIT);
        }
        catch (error) {
            this._abort = true;
            this._resolveInitComplete();
            await this._handleError(error);
        }
    };
    _resolveInitComplete() {
        this._resolveInitialization?.();
        this._resolveInitialization = null;
    }
    async _handleError(error) {
        if (this._app) {
            await this._app.handleError(error);
            return;
        }
        console.error(error);
    }
    async _runLifecycle(stage) {
        for (const { name, method } of getLifecycleMethods(this, stage)) {
            try {
                await method.call(this);
            }
            catch (error) {
                throw new MethodExecutionError(name, this.tagName, { cause: error });
            }
        }
    }
    async _markup() {
        try {
            if (this.markup == null) {
                throw new MissingMarkupMethod(this.tagName);
            }
            return await this.markup.call(this);
        }
        catch (error) {
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
    render = async () => {
        try {
            const renderTemplate = async () => {
                if (this.useServer) {
                    return await this._fetchHTML();
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
                    ? await this.app.getOrSetCachedTemplate(cacheKey, cacheDuration, renderTemplate)
                    : await renderTemplate();
            }
            else {
                renderedHtml = await renderTemplate();
            }
            this.innerHTML = renderedHtml;
        }
        catch (error) {
            this._abort = true;
            await this._handleError(error);
        }
    };
    _fetchHTML = async () => {
        return await this.fetchHTML({
            tagName: this.tagName.toLowerCase(),
            groupName: this.groupName == null ? "default" : this.groupName,
            queryParameters: this.app.queryParameters || {},
            routeParameters: this.app?.router.routeParameters || {},
            attributes: this.args,
        });
    };
    fetchHTML = async (request) => {
        if (!this.app.serverComponentsUrl) {
            throw new Error("If using server components you need to provide the " +
                "'serverComponentsUrl' property at application initialization.");
        }
        let response;
        try {
            response = await fetch(this.app.serverComponentsUrl, {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(request)
            });
        }
        catch {
            throw new NetworkError("Failed to fetch requested content. Server unresponsive.");
        }
        if (!response.ok) {
            return await this._checkFetchHTMLError(response);
        }
        try {
            const text = await response.text();
            if (text.trim().length === 0) {
                throw new MarkupFetchError("Fetched HTML markup was empty for a 2xx response.", this.tagName);
            }
            return text;
        }
        catch (error) {
            if (error instanceof MarkupFetchError) {
                throw error;
            }
            throw new MarkupFetchError("Failed to read fetched html markup for 2xx responses.", this.tagName);
        }
    };
    _checkFetchHTMLError = async (response) => {
        const contentType = response.headers.get("content-type") ?? "";
        if (contentType.includes("text/html")) {
            try {
                const text = await response.text();
                if (text.trim().length === 0) {
                    throw new MarkupFetchError("Fetched HTML markup was empty for a non-2xx response.", this.tagName);
                }
                return text;
            }
            catch (error) {
                if (error instanceof MarkupFetchError) {
                    throw error;
                }
                throw new MarkupFetchError("Failed to read fetched html markup for non-2xx responses.", this.tagName);
            }
        }
        if (response.status >= 500) {
            throw new InternalServerError(`Server component fetch failed with status ${response.status}`);
        }
        switch (response.status) {
            // Non-HTML error responses are converted to status-specific errors.
            case 400:
                throw new ServerComponentBadRequestResponse(this.tagName.toLowerCase(), this.groupName || "default");
            case 401:
                throw new AuthenticationError("Missing authentication for requested route");
            case 403:
                throw new AuthorizationError("User is not authorized for this route", []);
            case 404:
                throw new ServerComponentNotFound(this.tagName.toLowerCase(), this.groupName || "default");
            default:
                //throw generic error with response code
                throw new Error(`Failed to fetch component content. Server responded with status ${response.status}`);
        }
    };
    rerender = async () => {
        this._templateSettings.dataBinds.clear();
        await this._runLifecycle(Lifecycle.BEFORE_RERENDER);
        await this.render();
        if (this._abort) {
            return;
        }
        await this._waitForSubelements();
        await this._runLifecycle(Lifecycle.AFTER_RERENDER);
    };
    async _waitForSubelements() {
        const customElements = Array.from(this.querySelectorAll("*")).filter((element) => element instanceof CustomElement);
        await Promise.all(customElements.map(element => element.initComplete));
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
        this._renderTime = Date.now();
        const templates = this._templateSettings.dataBinds.get(propertyName);
        if (!templates) {
            return;
        }
        this.querySelectorAll(`[data-bind="${propertyName}"]`).forEach(element => {
            const elementId = element.getAttribute("data-bind-id");
            if (!elementId) {
                return;
            }
            const elementTemplate = templates[elementId];
            if (elementTemplate === undefined) {
                return;
            }
            element.setAttribute("data-render-time", this._renderTime.toString());
            element.innerHTML =
                elementTemplate;
        });
    }
    _hydrate = (roots = null) => {
        const elements = roots
            ? roots.flatMap(root => [
                root,
                ...Array.from(root.querySelectorAll("*")),
            ])
            : Array.from(this.querySelectorAll(`[data-parent-id="${this.hashId}"]` +
                `[data-render-time="${this.lastRender}"]`));
        const elementsWithEvents = this._allElementsWithEvents(elements);
        this._setEventListeners(elementsWithEvents);
    };
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
                await boundMethod.call(this, event, args);
            }
            else {
                await boundMethod.call(this, event);
            }
        }
        catch (error) {
            console.error(error);
            await this._handleError(new MethodExecutionError(methodName, this.tagName));
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
            console.error(error);
            void this._handleError(new DotJSEngineError(this.tagName));
            return "";
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
        for (const root of roots) {
            const elements = [
                root,
                ...Array.from(root.querySelectorAll("*")),
            ];
            for (const child of elements) {
                child.setAttribute("data-parent-id", this.hashId);
                child.setAttribute("data-render-time", this.lastRender.toString());
            }
        }
    };
    _replaceAtWithJolt(template) {
        return template.replace(/@(\w+)=/g, "jolt-$1=");
    }
    _replaceColonWithData(template) {
        return template.replace(/:(\w+)=/g, "data-jolt-$1=");
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