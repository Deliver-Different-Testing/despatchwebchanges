/**
 * React Test Setup
 *
 * Configures jest-dom matchers for React component testing.
 */

import '@testing-library/jest-dom';

// Mock window.matchMedia for MUI components
Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
    })),
});

// Mock ResizeObserver for MUI components
global.ResizeObserver = jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
}));

// Mock scrollTo
window.scrollTo = jest.fn();

// Suppress React 18 act() warnings and expected test errors
// These are error messages that are expected during error handling tests
const suppressedErrorPatterns = [
    'Warning: ReactDOM.render is no longer supported',
    'Warning: An update to',
    'MUI: You are providing a disabled',
    'Error loading related jobs',
    'Error loading notes',
    'Error deleting note',
    'Error updating task',
    'Error updating task date',
    'Error loading staff',
    'Error reassigning task',
    'Error inactivating recurring job',
    'Error loading delivery journey',
    'Error loading event types',
    'Export failed',
];

const originalError = console.error;
console.error = (...args) => {
    const message = args[0] instanceof Error ? args[0].message : String(args[0]);
    if (
        message &&
        suppressedErrorPatterns.some(pattern => message.includes(pattern))
    ) {
        return;
    }
    originalError.call(console, ...args);
};
