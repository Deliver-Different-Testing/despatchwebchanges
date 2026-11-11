import type {MockedFunction} from 'vitest';
import {createChatAdapter} from './chatAdapter';
import {streamChat} from '../../api/autoMateChat';
import type {AutoMateStreamEvent} from '../../types/autoMateChat';

vi.mock('../../api/autoMateChat', () => ({streamChat: vi.fn()}));

const mockStreamChat = streamChat as MockedFunction<typeof streamChat>;

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
            {type: 'tool_use', toolName: 'search_jobs'},
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
            {content: [{type: 'text', text: 'Open '}], metadata: {custom: {status: undefined}}},
            {content: [{type: 'text', text: 'Open '}], metadata: {custom: {status: 'Searching jobs…'}}},
            {content: [{type: 'text', text: 'Open Jobs.'}], metadata: {custom: {status: undefined}}},
            {content: [{type: 'text', text: 'Open Jobs.'}], metadata: {custom: {sources}}},
        ]);
    });

    it('appends an error to the text so far and yields no sources frame when done carries none', async () => {
        stream([{type: 'text_delta', text: 'Partial'}, {type: 'error', error: 'boom'}, {type: 'done', sources: null}]);

        const yielded = await run(createChatAdapter(() => undefined), [msg('user', {type: 'text', text: 'Hi'})]);

        expect(yielded).toEqual([
            {content: [{type: 'text', text: 'Partial'}], metadata: {custom: {status: undefined}}},
            {content: [{type: 'text', text: 'Partial\n\nError: boom'}], metadata: {custom: {status: undefined}}},
        ]);
    });

    it('says it is not connected as a plain reply, without the Error prefix', async () => {
        stream([{type: 'error', error: "Sorry, I'm not connected right now.", code: 'not_connected'}]);

        const yielded = await run(createChatAdapter(() => undefined), [msg('user', {type: 'text', text: 'Hi'})]);

        expect(yielded).toEqual([
            {content: [{type: 'text', text: "Sorry, I'm not connected right now."}], metadata: {custom: {status: undefined}}},
        ]);
    });

    it('yields a readable status with no parts while searching, thinking or running a tool', async () => {
        stream([
            {type: 'status', text: 'searching_kb'},
            {type: 'status', text: 'thinking'},
            {type: 'tool_use', toolName: 'get_job'},
            {type: 'tool_use', toolName: 'some_new_tool'},
            {type: 'text_delta', text: 'Done'},
            {type: 'done'},
        ]);

        const yielded = await run(createChatAdapter(() => undefined), [msg('user', {type: 'text', text: 'Hi'})]);

        expect(yielded).toEqual([
            {content: [], metadata: {custom: {status: 'Searching help articles…'}}},
            {content: [], metadata: {custom: {status: 'Thinking…'}}},
            {content: [], metadata: {custom: {status: 'Looking up the job…'}}},
            {content: [], metadata: {custom: {status: 'Working…'}}},
            {content: [{type: 'text', text: 'Done'}], metadata: {custom: {status: undefined}}},
        ]);
    });
});
