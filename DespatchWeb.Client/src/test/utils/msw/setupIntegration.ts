/**
 * MSW Integration Test Setup
 *
 * Import this file in integration tests to set up the MSW server lifecycle.
 * Automatically starts server before tests, resets handlers after each test,
 * and closes server after all tests complete.
 */

import { File as NodeFile } from 'node:buffer';
import { server } from './server';

// MSW parses multipart bodies with Node's undici, which rejects jsdom's File (jest-fixed-jsdom used to swap it in).
Object.assign(globalThis, { File: NodeFile });

// Start server before all tests
beforeAll(() => {
    server.listen({
        onUnhandledFrame: 'error', // Fail on unexpected requests
    });
});

// Reset handlers after each test (clear runtime request handlers)
afterEach(() => {
    server.resetHandlers();
});

// Close server after all tests
afterAll(() => {
    server.close();
});

export { server };
