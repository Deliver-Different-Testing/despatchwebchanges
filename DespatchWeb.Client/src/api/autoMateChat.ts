import {redirectTo} from '../utils/navigation';
import type {AutoMateChatRequest, AutoMateStreamEvent} from '../types/autoMateChat';

const CHAT_URL = '/Ai/Chat';

/** The server's `{ error, code }` body when it failed before streaming; the rate limiter's own 429 has no body. */
async function readErrorReason(response: Response): Promise<{error: string | null; code?: string}> {
    try {
        const body = (await response.json()) as {error?: unknown; code?: unknown};
        return {
            error: typeof body.error === 'string' && body.error ? body.error : null,
            code: typeof body.code === 'string' ? body.code : undefined,
        };
    } catch {
        return {error: null};
    }
}

export async function* streamChat(
    request: AutoMateChatRequest,
    signal: AbortSignal,
): AsyncGenerator<AutoMateStreamEvent> {
    const response = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'include',
        body: JSON.stringify(request),
        signal,
    });

    if (response.status === 401) {
        redirectTo(response.headers.get('x-auth-redirect') || '/');
        return;
    }

    if (!response.ok) {
        const fallback =
            response.status === 429
                ? 'Too many requests. Wait a moment, then try again.'
                : `Request failed (${response.status})`;
        const {error, code} = await readErrorReason(response);
        yield {type: 'error', error: error ?? fallback, code};
        return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
        yield {type: 'error', error: 'Streaming not supported'};
        return;
    }

    const decoder = new TextDecoder();
    let buffer = '';

    try {
        while (true) {
            const {done, value} = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, {stream: true});
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed.startsWith('data: ')) continue;

                try {
                    const event: AutoMateStreamEvent = JSON.parse(trimmed.slice(6));
                    yield event;
                    if (event.type === 'done' || event.type === 'error') return;
                } catch {
                    // Skip malformed events
                }
            }
        }
    } finally {
        reader.releaseLock();
    }
}
