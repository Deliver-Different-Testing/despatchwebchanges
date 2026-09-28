/**
 * MSW Integration Test Setup
 *
 * Import this file in integration tests to set up the MSW server lifecycle.
 * Automatically starts server before tests, resets handlers after each test,
 * and closes server after all tests complete.
 */

import { server } from './server';

// Start server before all tests
beforeAll(() => {
    server.listen({
        onUnhandledRequest: 'error', // Fail on unexpected requests
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
