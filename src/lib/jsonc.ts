import { parse, printParseErrorCode, type ParseError } from 'jsonc-parser';

export function parseJsonc(source: string, filename: string): unknown {
    const text = source.replace(/^\uFEFF/u, '');
    const errors: ParseError[] = [];
    const value: unknown = parse(text, errors, { allowTrailingComma: true });
    const error = errors[0];
    if (error) {
        const lines = text.slice(0, error.offset).split(/\r\n?|\n/u);
        const line = lines.length;
        const column = lines[line - 1].length + 1;
        throw new SyntaxError(
            `${filename}:${line}:${column}: ${printParseErrorCode(error.error)}`,
        );
    }
    return value;
}
