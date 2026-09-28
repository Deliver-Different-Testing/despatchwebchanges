/**
 * Fails fast on any real network request from a unit test.
 *
 * jsdom will happily issue a live XHR when a service module is left unmocked,
 * which silently costs seconds per test and 404s against whatever is listening
 * on the dev host. Throwing in `open` turns that into an instant, named error.
 *
 * Loaded only by jest.config.js. The integration suite deliberately omits it:
 * there MSW intercepts XHR and answers requests, and it already fails on
 * unhandled ones via `onUnhandledRequest: 'error'`.
 */
if (typeof window !== 'undefined') {
    window.XMLHttpRequest.prototype.open = function (method: string, url: string) {
        throw new Error(
            `Unmocked network request: ${method} ${url}. Unit tests must not hit the ` +
            `network — mock the service module with jest.mock(), or move the test to ` +
            `the integration suite (jest.integration.config.js) where MSW handles it.`,
        );
    } as typeof XMLHttpRequest.prototype.open;
}

export {};
