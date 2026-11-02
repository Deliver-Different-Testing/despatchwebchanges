import {createChatAdapter} from './chatAdapter';
import {streamChat} from '../../api/autoMateChat';
import type {AutoMateStreamEvent} from '../../types/autoMateChat';

jest.mock('../../api/autoMateChat', () => ({streamChat: jest.fn()}));

const mockStreamChat = streamChat as jest.MockedFunction<typeof streamChat>;

const stream = (events: AutoMateStreamEvent[]) =>
    mockStreamChat.mockImplementation(async function* () {
        yield* events;
    });

const run = async (adapter: ReturnType<typeof createChatAdapter>, messages: unknown[]) => {
    const yielded: unknown[] = [];
    const result = adapter.run({messages, abortSignal: new AbortController().signal} as never);
    for await (const chunk of result as AsyncIterable<unknown>) yielded.push(chunk);
    return yielded;
};

const msg = (role: string, ...parts: {type: string; text?: string}[]) => ({role, content: parts});

describe('createChatAdapter', () => {
    it('sends text-only user/assistant history with the page context and yields cumulative text, then sources on done', async () => {
        const sources = [{articleId: 'a-1', title: 'Booking a job', isFaq: false}];
        stream([
            {type: 'text_delta', text: 'Open '},
            {type: 'tool_use', toolName: 'search'},
            {type: 'text_delta', text: 'Jobs.'},
            {type: 'done', sources},
        ]);

        const yielded = await run(createChatAdapter(() => 'Job search'), [
            msg('system', {type: 'text', text: 'ignored'}),
            msg('user', {type: 'text', text: 'How do '}, {type: 'image'}, {type: 'text', text: 'I book?'}),
            msg('assistant', {type: 'image'}),
        ]);

        expect(mockStreamChat.mock.calls[0][0]).toEqual({
            messages: [{role: 'user', content: 'How do I book?'}],
            pageContext: 'Job search',
        });
        expect(yielded).toEqual([
            {content: [{type: 'text', text: 'Open '}]},
            {content: [{type: 'text', text: 'Open Jobs.'}]},
            {content: [{type: 'text', text: 'Open Jobs.'}], metadata: {custom: {sources}}},
        ]);
    });

    it('appends an error to the text so far and yields no sources frame when done carries none', async () => {
        stream([{type: 'text_delta', text: 'Partial'}, {type: 'error', error: 'boom'}, {type: 'done', sources: null}]);

        const yielded = await run(createChatAdapter(() => undefined), [msg('user', {type: 'text', text: 'Hi'})]);

        expect(yielded).toEqual([
            {content: [{type: 'text', text: 'Partial'}]},
            {content: [{type: 'text', text: 'Partial\n\nError: boom'}]},
        ]);
    });
});
