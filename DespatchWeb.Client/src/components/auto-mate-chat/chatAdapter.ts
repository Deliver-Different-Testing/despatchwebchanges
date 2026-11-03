import type {ChatModelAdapter} from '@assistant-ui/react';
import {streamChat} from '../../api/autoMateChat';

const STATUS_LABELS: Record<string, string> = {
    searching_kb: 'Searching help articles…',
    thinking: 'Thinking…',
    get_job: 'Looking up the job…',
    get_job_activity: 'Reading job activity…',
    search_jobs: 'Searching jobs…',
    find_client: 'Finding the client…',
    find_drivers: 'Checking drivers…',
    search_knowledge_base: 'Reading help articles…',
    get_article: 'Reading help articles…',
};

const statusLabel = (key: string | undefined) => (key && STATUS_LABELS[key]) || 'Working…';

/**
 * Bridges our SSE streaming API (`streamChat`) to assistant-ui's LocalRuntime
 * ChatModelAdapter. `run` is an async generator that yields the *cumulative*
 * assistant content on every event — assistant-ui replaces the message content
 * with each yielded snapshot. `metadata.custom.status` names what the server is
 * doing (searching, thinking, a tool) until the answer's text resumes.
 */
export function createChatAdapter(getPageContext: () => string | undefined): ChatModelAdapter {
    return {
        async *run({messages, abortSignal}) {
            const apiMessages = messages
                .filter((m) => m.role === 'user' || m.role === 'assistant')
                .map((m) => ({
                    role: m.role,
                    content: m.content
                        .filter((p): p is {type: 'text'; text: string} => p.type === 'text')
                        .map((p) => p.text)
                        .join(''),
                }))
                .filter((m) => m.content.length > 0);

            let text = '';
            // An empty text part is never yielded: it would mark earlier parts complete.
            const snapshot = (status?: string) => ({
                content: text ? [{type: 'text' as const, text}] : [],
                metadata: {custom: {status}},
            });

            for await (const event of streamChat(
                {messages: apiMessages, pageContext: getPageContext()},
                abortSignal,
            )) {
                switch (event.type) {
                    case 'text_delta':
                        text += event.text ?? '';
                        yield snapshot();
                        break;
                    case 'status':
                        yield snapshot(statusLabel(event.text));
                        break;
                    case 'tool_use':
                        yield snapshot(statusLabel(event.toolName));
                        break;
                    case 'error':
                        text += `${text ? '\n\n' : ''}Error: ${event.error}`;
                        yield snapshot();
                        break;
                    case 'done':
                        if (event.sources?.length) {
                            yield {
                                content: [{type: 'text', text}],
                                metadata: {custom: {sources: event.sources}},
                            };
                        }
                        break;
                }
            }
        },
    };
}
