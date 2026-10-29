export interface ReactivePropertyHost {
    invalidate(bindingName: string): void;
}
export interface QueryParameterHost extends ReactivePropertyHost {
    readonly app: {
        readonly queryParameters: Readonly<Record<string, string>>;
        updateQueryParameters(parameters: Record<string, string | number | null>): void;
    };
}
export interface SelectOptions {
    required?: boolean;
    /** Query inside the owning app's container instead of this element. */
    global?: boolean;
}
export interface RequiredSelectOptions extends SelectOptions {
    required: true;
}
export interface OptionalSelectOptions extends SelectOptions {
    required?: false;
}
export interface SelectAllOptions extends SelectOptions {
}
type AccessorTarget<THost, TValue> = ClassAccessorDecoratorTarget<THost, TValue>;
type AccessorContext<THost, TValue> = ClassAccessorDecoratorContext<THost, TValue>;
type AccessorResult<THost, TValue> = ClassAccessorDecoratorResult<THost, TValue>;
export declare function react<TValue>(initialValue: TValue, bindingName?: string): <THost extends ReactivePropertyHost>(target: AccessorTarget<THost, TValue>, context: AccessorContext<THost, TValue>) => AccessorResult<THost, TValue>;
export declare function reactFactory<TValue>(initialValueFactory: () => TValue, bindingName?: string): <THost extends ReactivePropertyHost>(target: AccessorTarget<THost, TValue>, context: AccessorContext<THost, TValue>) => AccessorResult<THost, TValue>;
export declare function queryParam(parameterName: string, defaultValue: string, bindingName?: string): <THost extends QueryParameterHost>(target: AccessorTarget<THost, string>, context: AccessorContext<THost, string>) => AccessorResult<THost, string>;
export declare function queryParam(parameterName: string, defaultValue?: null, bindingName?: string): <THost extends QueryParameterHost>(target: AccessorTarget<THost, string | null>, context: AccessorContext<THost, string | null>) => AccessorResult<THost, string | null>;
export declare function select<TElement extends Element = Element>(selector: string, options: RequiredSelectOptions): <THost extends ParentNode>(target: AccessorTarget<THost, TElement>, context: AccessorContext<THost, TElement>) => AccessorResult<THost, TElement>;
export declare function select<TElement extends Element = Element>(selector: string, options?: OptionalSelectOptions): <THost extends ParentNode>(target: AccessorTarget<THost, TElement | null>, context: AccessorContext<THost, TElement | null>) => AccessorResult<THost, TElement | null>;
export declare function selectAll<TElement extends Element = Element>(selector: string, options?: SelectAllOptions): <THost extends ParentNode>(target: AccessorTarget<THost, NodeListOf<TElement>>, context: AccessorContext<THost, NodeListOf<TElement>>) => AccessorResult<THost, NodeListOf<TElement>>;
export {};
//# sourceMappingURL=properties.d.ts.map