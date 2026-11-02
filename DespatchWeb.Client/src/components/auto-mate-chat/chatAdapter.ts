import type {ChatModelAdapter} from '@assistant-ui/react';
import {streamChat} from '../../api/autoMateChat';

/**
 * Bridges our SSE streaming API (`streamChat`) to assistant-ui's LocalRuntime
 * ChatModelAdapter. `run` is an async generator that yields the *cumulative*
 * assistant content on every event — assistant-ui replaces the message content
 * with each yielded snapshot.
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
            for await (const event of streamChat(
                {messages: apiMessages, pageContext: getPageContext()},
                abortSignal,
            )) {
                switch (event.type) {
                    case 'text_delta':
                        text += event.text ?? '';
                        yield {content: [{type: 'text', text}]};
                        break;
                    case 'error':
                        text += `${text ? '\n\n' : ''}Error: ${event.error}`;
                        yield {content: [{type: 'text', text}]};
                        break;
                    case 'done':
                        if (event.sources?.length) {
                            yield {
                                content: [{type: 'text', text}],
                                metadata: {custom: {sources: event.sources}},
                            };
                        }
                        break;
                    case 'tool_use':
                        break;
                }
            }
        },
    };
}
