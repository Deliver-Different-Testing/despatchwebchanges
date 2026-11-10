/**
 * Vitest test setup (runs before each test file)
 *
 * Configures jest-dom matchers, browser API mocks, and global variables.
 * Keep this file minimal — it runs 155+ times per test run.
 */

import '@testing-library/jest-dom/vitest';
import {configure} from '@testing-library/react';
import {installLegacySessionGlobals} from './legacySessionGlobals';

// waitFor/findBy default to a 1000ms timeout, which is too tight for react-query
// state transitions on a loaded/GC-starved CI worker (a mocked-promise resolution
// that settles in ~13ms locally can exceed 1s under load, flaking isSuccess/isError
// assertions — see useAddressApi.test.tsx, 2026-07-03). Genuine hangs are still
// bounded by the vite.config.ts testTimeout (30s).
configure({asyncUtilTimeout: 5000});

// DOM mocks — only run in jsdom environment (skipped for node-only tests)
if (typeof window !== 'undefined') {
    // Mock window.history for navigation tests
    Object.defineProperty(window, 'history', {
        value: {
            back: vi.fn(),
            forward: vi.fn(),
            go: vi.fn(),
            pushState: vi.fn(),
            replaceState: vi.fn(),
            length: 1,
            state: null,
            scrollRestoration: 'auto'
        },
        writable: true
    });

    // Mock window.matchMedia for MUI components
    Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation(query => ({
            matches: false,
            media: query,
            onchange: null,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
        })),
    });

    // Mantine's Autosize and ScrollArea construct one with `new`; Vitest mocks need a class to support that.
    global.ResizeObserver = class {
        observe = vi.fn();
        unobserve = vi.fn();
        disconnect = vi.fn();
    } as unknown as typeof ResizeObserver;

    // jsdom 30 has no document.fonts; Mantine's Autosize (Textarea autosize) subscribes to it on mount.
    if (!document.fonts) {
        Object.defineProperty(document, 'fonts', {
            configurable: true,
            value: { addEventListener: vi.fn(), removeEventListener: vi.fn() },
        });
    }

    // Mock scrollTo
    window.scrollTo = vi.fn();

    // jsdom does not implement scrollIntoView, and Mantine's Combobox (Select,
    // MultiSelect, Autocomplete, SearchSelect) calls it when it moves the active
    // option — without this every dropdown interaction throws.
    if (!Element.prototype.scrollIntoView) {
        Element.prototype.scrollIntoView = vi.fn();
    }
}

// Session defaults and the window.ContactID-style seeding bridge (see legacySessionGlobals.ts).
installLegacySessionGlobals();

// Suppress unavoidable framework warnings only.
// Application-level errors should be suppressed per-test using
// vi.spyOn(console, 'error').mockImplementation(() => {}) — see suppressConsoleError
// in test/utils/index.tsx for a convenient helper.
const suppressedErrorPrefixes = new Set([
    'Warning: ReactDOM.render is no longer supported',
]);

const originalError = console.error;
console.error = (...args: unknown[]) => {
    if (typeof args[0] === 'string') {
        for (const prefix of suppressedErrorPrefixes) {
            if (args[0].startsWith(prefix)) {
                return;
            }
        }
    }
    originalError.call(console, ...args);
};
