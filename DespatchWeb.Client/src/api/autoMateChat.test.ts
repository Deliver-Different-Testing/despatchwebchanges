/** @jest-environment node */
import {streamChat} from './autoMateChat';
import {redirectTo} from '../utils/navigation';
import type {AutoMateStreamEvent} from '../types/autoMateChat';

jest.mock('../utils/navigation', () => ({redirectTo: jest.fn()}));

const encoder = new TextEncoder();

const sseResponse = (chunks: string[], init: ResponseInit = {}) =>
    new Response(
        new ReadableStream({
            start(controller) {
                chunks.forEach(chunk => controller.enqueue(encoder.encode(chunk)));
                controller.close();
            },
        }),
        {headers: {'Content-Type': 'text/event-stream'}, ...init},
    );

const request = {messages: [{role: 'user', content: 'Hello'}], pageContext: 'Job search'};

const collect = async (): Promise<AutoMateStreamEvent[]> => {
    const events: AutoMateStreamEvent[] = [];
    for await (const event of streamChat(request, new AbortController().signal)) events.push(event);
    return events;
};

describe('streamChat', () => {
    const fetchMock = jest.fn();

    beforeEach(() => {
        global.fetch = fetchMock;
        fetchMock.mockReset();
    });

    it('posts to /Ai/Chat with the CSRF header and cookies, then parses events split across chunks and stops after done', async () => {
        fetchMock.mockResolvedValue(sseResponse([
            'data: {"type":"text_delta","text":"Hel',
            'lo "}\n\ndata: {"type":"tool_use","toolName":"search"}\n\nnot-sse\ndata: {bad json}\n\n',
            'data: {"type":"done","sources":[{"articleId":"a-1","title":"Booking a job","isFaq":false}]}\n\n',
            'data: {"type":"text_delta","text":"after done"}\n\n',
        ]));

        const events = await collect();

        expect(events).toEqual([
            {type: 'text_delta', text: 'Hello '},
            {type: 'tool_use', toolName: 'search'},
            {type: 'done', sources: [{articleId: 'a-1', title: 'Booking a job', isFaq: false}]},
        ]);
        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe('/Ai/Chat');
        expect(init).toMatchObject({
            method: 'POST',
            credentials: 'include',
            headers: {'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest'},
            body: JSON.stringify(request),
        });
    });

    it('stops after an error event', async () => {
        fetchMock.mockResolvedValue(sseResponse([
            'data: {"type":"error","error":"boom"}\n\ndata: {"type":"text_delta","text":"x"}\n\n',
        ]));

        expect(await collect()).toEqual([{type: 'error', error: 'boom'}]);
    });

    it('redirects to the x-auth-redirect URL on 401, falling back to /', async () => {
        fetchMock.mockResolvedValueOnce(new Response(null, {status: 401, headers: {'x-auth-redirect': '/login?x=1'}}));
        expect(await collect()).toEqual([]);
        expect(redirectTo).toHaveBeenLastCalledWith('/login?x=1');

        fetchMock.mockResolvedValueOnce(new Response(null, {status: 401}));
        await collect();
        expect(redirectTo).toHaveBeenLastCalledWith('/');
    });

    it('surfaces the server error body, with status and 429 fallbacks when there is none', async () => {
        fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({error: 'Chat is not available'}), {status: 403}));
        expect(await collect()).toEqual([{type: 'error', error: 'Chat is not available'}]);

        fetchMock.mockResolvedValueOnce(new Response(null, {status: 429}));
        expect(await collect()).toEqual([{type: 'error', error: 'Too many requests. Wait a moment, then try again.'}]);

        fetchMock.mockResolvedValueOnce(new Response(null, {status: 500}));
        expect(await collect()).toEqual([{type: 'error', error: 'Request failed (500)'}]);
    });
});
