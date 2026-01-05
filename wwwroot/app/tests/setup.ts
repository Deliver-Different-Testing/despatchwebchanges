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

// Global test utilities
export {};
