import App, { dataEventEnum, } from "./app.js";
import doT, {} from "./dotjs/dot.js";
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
    constructor(methodName, elementName) {
        super(`Failed to execute method '${methodName}' ` +
            `on element '${elementName}'`);
        this.name = "MethodExecutionError";
        this.methodName = methodName;
        this.elementName = elementName;
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
export function defineValue(initValue, triggerRerender = true) {
    return function defineValueInner(name) {
        const clonedValue = window.structuredClone(initValue);
        if (clonedValue !== undefined &&
            clonedValue !== null) {
            this._values[name] = clonedValue;
        }
        return {
            configurable: true,
            enumerable: true,
            get() {
                return this._values[name];
            },
            set(value) {
                this._values[name] = value;
                if (triggerRerender) {
                    this._refreshBoundElements(name);
                }
            },
        };
    };
}
export function queryParameter(name, defaultValue = null, triggerRerender = true) {
    if (!name) {
        throw new Error("Missing or invalid query parameter name");
    }
    return function queryParameterInner() {
        return {
            configurable: true,
            enumerable: true,
            get() {
                return (this.app.queryParameters[name] ??
                    defaultValue);
            },
            set(value) {
                this.app.updateQueryParameters({ [name]: `${value}` });
                if (triggerRerender) {
                    this._refreshBoundElements(`query-${name}`);
                }
            },
        };
    };
}
export function querySelector(selector) {
    if (!selector) {
        throw new Error("Missing or invalid selector for querySelector");
    }
    return function querySelectorInner() {
        return {
            configurable: true,
            enumerable: true,
            get() {
                return this.querySelector(selector);
            },
        };
    };
}
export function querySelectorAll(selector) {
    if (!selector) {
        throw new Error("Missing or invalid selector for querySelectorAll");
    }
    return function querySelectorAllInner() {
        return {
            configurable: true,
            enumerable: true,
            get() {
                return this.querySelectorAll(selector);
            },
        };
    };
}
export const html = String.raw;
export class CustomElement extends HTMLElement {
    static tagName = "";
    _app = null;
    _resolveInitialization = null;
    _templateSettings = createTemplateSettings();
    _dataField = null;
    _parent = null;
    _protectedProperties = [];
    _methods = {};
    _beforeInit = {};
    _beforeInitResolve = {};
    _afterInit = {};
    _beforeRerender = {};
    _afterRerender = {};
    _afterDisconnect = {};
    _define = {};
    _templateFunctions = {};
    _renderTime = 0;
    _lastRender = 0;
    _abort = false;
    _virtualRenderDiv = "virtual-render-div";
    initComplete;
    _values = {};
    rndId;
    hashId = "";
    markup = function () {
        throw new MissingMarkupMethod(this.tagName);
    };
    constructor() {
        super();
        this.rndId = randomId();
        this.initComplete = new Promise(resolve => {
            this._resolveInitialization = resolve;
        });
    }
    async connectedCallback() {
        const deferValue = this.getAttribute("defer");
        const dataDeferValue = this.getAttribute("data-jolt-defer");
        const deferValues = [
            "",
            "true",
            "defer",
        ];
        const deferred = (this.hasAttribute("defer") &&
            deferValues.includes(deferValue ?? "")) ||
            (this.hasAttribute("data-jolt-defer") &&
                deferValues.includes(dataDeferValue ?? ""));
        if (deferred) {
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
        if (this._dataField) {
            this.app.removeDataListener(this);
        }
        void this._runMethods(this._afterDisconnect);
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
            this._dataField =
                this.getAttribute("data-field") ??
                    this._dataField;
            this._templateSettings =
                createTemplateSettings();
            this._assignTemplateFunctions();
            this._protectedProperties =
                Object.getOwnPropertyNames(this);
            this._assignMethods();
            this._assignDefinedGettersAndSetters();
            await this._runMethods(this._beforeInit);
            this.app.addEventListener(dataEventEnum.CHANGE, this._updateBoundAppDataParts);
            if (this._dataField) {
                this.app.registerDataListener(this);
            }
            await this.render();
            if (this._abort) {
                this._resolveInitComplete();
                return;
            }
            await this._waitForSubelements();
            await this._runMethods(this._beforeInitResolve);
            this._resolveInitComplete();
            await this._runMethods(this._afterInit);
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
    _assignTemplateFunctions() {
        for (const [name, templateFunction,] of Object.entries(this._templateFunctions)) {
            this._templateSettings.def[name] =
                templateFunction.bind(this);
        }
    }
    _assignMethods() {
        if (!this._methods) {
            return;
        }
        for (const [name, method] of Object.entries(this._methods)) {
            this._assertPublicMemberName(name, "method");
            Object.defineProperty(this, name, {
                configurable: true,
                enumerable: false,
                writable: true,
                value: method.bind(this),
            });
        }
        this._methods = null;
    }
    _assignDefinedGettersAndSetters() {
        for (const [propertyName, definition,] of Object.entries(this._define)) {
            this._assertPublicMemberName(propertyName, "property");
            const descriptor = typeof definition === "function"
                ? definition.call(this, propertyName)
                : definition;
            Object.defineProperty(this, propertyName, descriptor);
        }
    }
    _assertPublicMemberName(name, memberType) {
        if (this._protectedProperties.includes(name) ||
            name.startsWith("_") ||
            name.startsWith("#")) {
            throw new Error(`Illegal or protected ${memberType} ` +
                `name '${name}' on element ` +
                `'${this.tagName}'`);
        }
    }
    async _runMethods(methods) {
        for (const [name, method] of Object.entries(methods)) {
            try {
                await method.call(this);
            }
            catch {
                throw new MethodExecutionError(name, this.tagName);
            }
        }
    }
    async _markup() {
        try {
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
    render = async () => {
        try {
            const renderedHtml = await this._markup();
            this.innerHTML = renderedHtml;
        }
        catch (error) {
            this._abort = true;
            await this._handleError(error);
        }
    };
    rerender = async () => {
        this._templateSettings.dataBinds.clear();
        await this._runMethods(this._beforeRerender);
        await this.render();
        if (this._abort) {
            return;
        }
        await this._waitForSubelements();
        await this._runMethods(this._afterRerender);
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
    _hydrate = () => {
        const elementsWithEvents = this._allElementsWithEvents(this.querySelectorAll(`[data-parent-id="${this.hashId}"]` +
            `[data-render-time="${this.lastRender}"]`));
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
        return (event) => {
            void this._executeElementMethod(element, methodName, event);
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
                await boundMethod.call(this, element, event, args);
            }
            else {
                await boundMethod.call(this, element, event);
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
        allElements.forEach(element => {
            elementsWithEvents.push(...this._elementWithEvent(element));
        });
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
        const virtualElement = document.createElement("div");
        virtualElement.classList.add(this._virtualRenderDiv);
        this.app.originalInsertAdjacentHTML.call(virtualElement, "afterbegin", parsedTemplate);
        this._lastRender = Date.now();
        return this._tagAllElementsWithParent(virtualElement).innerHTML;
    }
    _tagAllElementsWithParent(element) {
        element
            .querySelectorAll("*")
            .forEach(child => {
            child.setAttribute("data-parent-id", this.hashId);
            child.setAttribute("data-render-time", this.lastRender.toString());
        });
        return element;
    }
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
    get dataField() {
        return this._dataField;
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
const validCustomElementTagName = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)+$/;
export function ElementFactory(config) {
    const { tagName, markup, methods = {}, beforeInit = {}, beforeInitResolve = {}, afterInit = {}, beforeRerender = {}, afterRerender = {}, afterDisconnect = {}, dataField = null, define = {}, templateFunctions = {}, } = config;
    if (!tagName) {
        throw new Error("Missing tagName in ElementFactory");
    }
    if (typeof markup !== "function") {
        throw new Error(`Missing or invalid markup method ` +
            `for element '${tagName}'`);
    }
    if (!validCustomElementTagName.test(tagName)) {
        throw new Error(`Element tagName '${tagName}' must ` +
            `use valid custom-element kebab-case ` +
            `syntax and contain at least one hyphen`);
    }
    class GeneratedCustomElement extends CustomElement {
        static tagName = tagName;
        _methods = {
            ...methods,
        };
        _beforeInit = {
            ...beforeInit,
        };
        _beforeInitResolve = {
            ...beforeInitResolve,
        };
        _afterInit = {
            ...afterInit,
        };
        _beforeRerender = {
            ...beforeRerender,
        };
        _afterRerender = {
            ...afterRerender,
        };
        _afterDisconnect = {
            ...afterDisconnect,
        };
        _dataField = dataField;
        _define = {
            ...define,
        };
        _templateFunctions = {
            ...templateFunctions,
        };
        markup = markup;
    }
    return GeneratedCustomElement;
}
export default ElementFactory;
//# sourceMappingURL=customElement.js.map