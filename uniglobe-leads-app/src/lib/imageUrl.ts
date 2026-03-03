export function toRenderableImageUrl(input?: string | null): string {
    if (!input) return '';

    if (input.startsWith('/api/admin/upload?key=')) {
        return input;
    }

    const buildProxy = (key: string) => `/api/admin/upload?key=${encodeURIComponent(key)}`;

    const keyFromPath = (pathname: string): string | null => {
        const clean = pathname.replace(/^\/+/, '');
        if (!clean) return null;

        const segments = clean.split('/');
        if (segments.length < 2) return null;

        const [bucket, ...rest] = segments;
        if (bucket !== 'uniglobe') return null;

        const key = rest.join('/').trim();
        return key || null;
    };

    try {
        const parsed = new URL(input);
        const isMinioHost =
            parsed.hostname === 'minio' ||
            (parsed.hostname === 'localhost' && parsed.port === '9000') ||
            (parsed.hostname === '127.0.0.1' && parsed.port === '9000');

        if (isMinioHost) {
            const key = keyFromPath(parsed.pathname);
            if (key) return buildProxy(key);
        }
    } catch {
        if (input.startsWith('/uniglobe/')) {
            const key = keyFromPath(input);
            if (key) return buildProxy(key);
        }
    }

    return input;
}
