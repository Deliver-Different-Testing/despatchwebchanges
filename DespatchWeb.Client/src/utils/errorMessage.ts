/**
 * The message of a caught error, or `fallback` when it has none worth showing. apiClient rejects with
 * a plain ApiError object rather than an Error, so `instanceof Error` alone drops the server's message.
 * A proxy's HTML error page and axios's generic status text say nothing the fallback doesn't, and
 * neither does a runtime fault (a TypeError from a bug or a failed chunk import, say) that a broad
 * catch around a whole action picks up.
 */
const RUNTIME_ERROR_TYPES = [TypeError, ReferenceError, SyntaxError, RangeError];

export function errorMessageOf(error: unknown, fallback: string): string {
    if (RUNTIME_ERROR_TYPES.some(type => error instanceof type)) return fallback;
    if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
        const message = error.message.trim();
        if (message && !message.startsWith('<') && !/^Request failed with status code \d+$/.test(message)) {
            return message;
        }
    }
    return fallback;
}
