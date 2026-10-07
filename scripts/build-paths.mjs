export function decodeBuildPath(pathname, description = 'build path') {
    const invalid = () => {
        throw new Error(`Invalid ${description}: ${pathname}`);
    };
    if (
        typeof pathname !== 'string' ||
        !pathname.startsWith('/') ||
        pathname.startsWith('//') ||
        /[\s?#*\\\u0000-\u001f\u007f]/.test(pathname)
    )
        invalid();

    const segments = pathname.slice(1).split('/');
    if (segments.at(-1) === '') segments.pop();
    const decoded = segments.map((segment) => {
        let value;
        try {
            value = decodeURIComponent(segment);
        } catch {
            invalid();
        }
        if (
            !value ||
            value === '.' ||
            value === '..' ||
            /[/\\:?#*\u0000-\u001f\u007f]/.test(value) ||
            /%[\da-f]{2}/i.test(value)
        )
            invalid();
        return value;
    });
    return `/${decoded.join('/')}`;
}
