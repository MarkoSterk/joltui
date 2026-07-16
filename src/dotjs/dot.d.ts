export type DoTSanitizeFunction = (
    value: unknown,
) => unknown;

export type DoTDefinitionValue =
    | string
    | {
          arg: string;
          text: string;
      }
    | Record<string, unknown>
    | unknown;

export type DoTDefinitions = Record<
    string,
    DoTDefinitionValue
>;

export type DoTDataBindTemplates = Record<
    string,
    string
>;

export interface DoTTemplateSettings {
    evaluate?: RegExp;
    interpolate?: RegExp;
    encode?: RegExp;
    use?: RegExp;
    useParams?: RegExp;
    define?: RegExp;
    defineParams?: RegExp;
    conditional?: RegExp;
    iterate?: RegExp;

    varname?: string;
    strip?: boolean;
    append?: boolean;
    selfcontained?: boolean;
    doNotSkipEncoded?: boolean;

    def?: DoTDefinitions;

    dataBinds?: Map<
        string,
        DoTDataBindTemplates
    >;

    sanitizeFunc?: DoTSanitizeFunction;

    [key: string]: unknown;
}

export type DoTCompiledTemplate<
    TData = unknown,
> = (
    this: unknown,
    data?: TData,
    sanitize?: DoTSanitizeFunction,
) => string;

export type DoTCompiledFunction<
    TData = unknown,
> = (
    data?: TData,
) => string;

export interface DoT {
    readonly name: string;
    readonly version: string;

    templateSettings: DoTTemplateSettings;

    log: boolean;

    encodeHTMLSource(
        doNotSkipEncoded?: boolean,
    ): (code: unknown) => string;

    template<TData = unknown>(
        this: unknown,
        template: string,
        settings?: DoTTemplateSettings | null,
        definitions?: DoTDefinitions,
    ): DoTCompiledTemplate<TData>;

    compile<TData = unknown>(
        template: string,
        definitions?: DoTDefinitions,
    ): DoTCompiledFunction<TData>;
}

declare const doT: DoT;

export default doT;