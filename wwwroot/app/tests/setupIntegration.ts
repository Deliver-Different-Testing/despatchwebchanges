/**
 * Integration Test Setup
 *
 * Polyfills required for MSW 2.x in Jest jsdom environment.
 * MSW requires fetch APIs (Request, Response, Headers, fetch) which aren't
 * available in jsdom by default.
 *
 * Node 18+ has native fetch, but jsdom doesn't expose it. We use the Node
 * built-in web APIs directly via require() for synchronous loading.
 */

import { TextEncoder, TextDecoder } from 'util';
import { MessageChannel, MessagePort } from 'worker_threads';

// Polyfill TextEncoder/TextDecoder
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder as typeof global.TextDecoder;

// Polyfill MessageChannel/MessagePort from worker_threads
global.MessageChannel = MessageChannel as unknown as typeof global.MessageChannel;
global.MessagePort = MessagePort as unknown as typeof global.MessagePort;

// Polyfill ReadableStream from Node's web streams (synchronous require)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const webStreams = require('stream/web');
global.ReadableStream = webStreams.ReadableStream;
global.TransformStream = webStreams.TransformStream;
global.WritableStream = webStreams.WritableStream;

// Now import undici after ReadableStream is available
// eslint-disable-next-line @typescript-eslint/no-require-imports
const undici = require('undici');

global.fetch = undici.fetch;
global.Headers = undici.Headers;
global.Request = undici.Request;
global.Response = undici.Response;
global.FormData = undici.FormData;

// Polyfill BroadcastChannel (used by MSW for cross-tab communication)
class BroadcastChannelPolyfill {
    name: string;
    constructor(name: string) {
        this.name = name;
    }
    postMessage(_message: unknown) {}
    close() {}
    addEventListener(_type: string, _listener: EventListener) {}
    removeEventListener(_type: string, _listener: EventListener) {}
    onmessage: ((ev: MessageEvent) => void) | null = null;
    onmessageerror: ((ev: MessageEvent) => void) | null = null;
    dispatchEvent(_event: Event): boolean { return true; }
}

global.BroadcastChannel = BroadcastChannelPolyfill as unknown as typeof BroadcastChannel;
