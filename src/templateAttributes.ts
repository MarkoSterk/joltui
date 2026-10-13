export function replaceShorthandAttributes(
    html: string,
    prefix: "@" | ":",
    replacement: string,
): string {
    const parts: string[] = [];
    let copiedUntil = 0;
    let position = 0;

    while ((position = html.indexOf("<", position)) !== -1) {
        if (html.startsWith("<!--", position)) {
            const end = html.indexOf("-->", position + 4);
            position = end === -1 ? html.length : end + 3;
            continue;
        }
        if (html.startsWith("<![CDATA[", position)) {
            const end = html.indexOf("]]>", position + 9);
            position = end === -1 ? html.length : end + 3;
            continue;
        }

        const opening = /^<([a-z][^\t\n\f\r />]*)/i.exec(html.slice(position));
        if (!opening && !/^<(?:\/[a-z]|!|\?)/i.test(html.slice(position))) {
            position++;
            continue;
        }

        let end = position + (opening?.[0].length ?? 2);
        let quote = "";
        let valueExpected = false;
        let unquotedValue = false;
        for (; end < html.length; end++) {
            const character = html[end]!;
            if (quote) {
                if (character === quote) quote = "";
                continue;
            }
            if (character === ">") {
                break;
            }
            if (unquotedValue) {
                if (/[\t\n\f\r ]/.test(character)) unquotedValue = false;
                continue;
            }
            if (valueExpected) {
                if (/[\t\n\f\r ]/.test(character)) continue;
                valueExpected = false;
                if (character === '"' || character === "'") quote = character;
                else unquotedValue = true;
            } else if (character === "=") {
                valueExpected = true;
            }
        }
        if (end === html.length) break;

        if (opening) {
            const attributesStart = position + opening[0].length;
            const attributes = html.slice(attributesStart, end).replace(
                /([^\t\n\f\r =/>]+)([\t\n\f\r ]*=[\t\n\f\r ]*(?:"[^"]*"|'[^']*'|[^\t\n\f\r >]+))?/g,
                (attribute: string, name: string, value: string | undefined) => {
                    if (
                        !name.startsWith(prefix) ||
                        !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(name.slice(1))
                    ) return attribute;
                    return replacement + name.slice(1) + (value ?? "");
                },
            );
            parts.push(html.slice(copiedUntil, attributesStart), attributes, ">");
            copiedUntil = end + 1;

            const tagName = opening[1]!.toLowerCase();
            if (tagName === "plaintext") break;
            if (/^(script|style|textarea|title|xmp|iframe|noembed|noframes)$/.test(tagName)) {
                const closing = new RegExp(`</${tagName}(?=[\\t\\n\\f\\r />])`, "ig");
                closing.lastIndex = end + 1;
                const match = closing.exec(html);
                position = match?.index ?? html.length;
                continue;
            }
        }
        position = end + 1;
    }

    parts.push(html.slice(copiedUntil));
    return parts.join("");
}
