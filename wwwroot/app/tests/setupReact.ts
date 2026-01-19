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
// Using Set for O(1) prefix lookups instead of array iteration
const suppressedErrorPrefixes = new Set([
    'Warning: ReactDOM.render is no longer supported',
    'Error loading related jobs',
    'Error loading notes',
    'Error deleting note',
    'Error updating task',
    'Error loading staff',
    'Error reassigning task',
    'Error loading delivery journey',
    'Error loading event types',
    'Export failed',
]);

const originalError = console.error;
console.error = (...args: unknown[]) => {
    if (typeof args[0] === 'string') {
        // Check if error starts with any suppressed prefix (faster than .includes())
        for (const prefix of suppressedErrorPrefixes) {
            if (args[0].startsWith(prefix)) {
                return;
            }
        }
    }
    originalError.call(console, ...args);
};
