/**
 * The message of a caught error, or `fallback` when it has none worth showing. apiClient rejects with
 * a plain ApiError object rather than an Error, so `instanceof Error` alone drops the server's message.
 * A proxy's HTML error page and axios's generic status text say nothing the fallback doesn't.
 */
export function errorMessageOf(error: unknown, fallback: string): string {
    if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
        const message = error.message.trim();
        if (message && !message.startsWith('<') && !/^Request failed with status code \d+$/.test(message)) {
            return message;
        }
    }
    return fallback;
}
