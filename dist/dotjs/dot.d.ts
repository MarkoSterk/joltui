/**
 * doT.js render engine
 * MIT license
 *
 * https://olado.github.io/doT/index.html
 *
 * EXTENDED THE RENDER ENGINE TO PARSE data-bind ATTRIBUTES ON HTML ELEMENTS.
 * THIS IS CRUCIAL FOR SOME ADVANCED FUNCTIONALITY
 *
 */
declare var doT: {
    name: string;
    version: string;
    templateSettings: {
        evaluate: RegExp;
        interpolate: RegExp;
        encode: RegExp;
        use: RegExp;
        useParams: RegExp;
        define: RegExp;
        defineParams: RegExp;
        conditional: RegExp;
        iterate: RegExp;
        varname: string;
        strip: boolean;
        append: boolean;
        selfcontained: boolean;
        doNotSkipEncoded: boolean;
    };
    template: undefined;
    compile: undefined;
    log: boolean;
};
export default doT;
//# sourceMappingURL=dot.d.ts.map