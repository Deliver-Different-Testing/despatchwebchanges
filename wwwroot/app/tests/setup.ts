/**
 * Jest test setup for AngularJS components
 * Provides mocks for common AngularJS services
 */

// Mock window.history for navigation tests
Object.defineProperty(window, 'history', {
    value: {
        back: jest.fn(),
        forward: jest.fn(),
        go: jest.fn(),
        pushState: jest.fn(),
        replaceState: jest.fn(),
        length: 1,
        state: null,
        scrollRestoration: 'auto'
    },
    writable: true
});

// Global variables declared in cshtml templates at runtime
// Must be defined before modules that use them at top-level scope
(global as unknown as Window).ContactID = 0;
(global as unknown as Window).FirstName = 'Test';
(global as unknown as Window).TimeZone = 'Europe/London';

// Global test utilities
export {};
