/**
 * Jest test setup (runs before each test file)
 *
 * Configures jest-dom matchers, browser API mocks, and global variables.
 * Keep this file minimal — it runs 155+ times per test run.
 */

import '@testing-library/jest-dom';
import {configure} from '@testing-library/react';

// waitFor/findBy default to a 1000ms timeout, which is too tight for react-query
// state transitions on a loaded/GC-starved CI worker (a mocked-promise resolution
// that settles in ~13ms locally can exceed 1s under load, flaking isSuccess/isError
// assertions — see useAddressApi.test.tsx, 2026-07-03). Genuine hangs are still
// bounded by jest.config.js testTimeout (30s).
configure({asyncUtilTimeout: 5000});

// Disable MUI enter/exit animations globally in tests. Dialog/Menu/Popover/
// Collapse/Tooltip transitions run on real timers and add hundreds of ms per
// interaction (act/userEvent wait for them to settle) without testing
// anything. Patching createTheme reaches every theme — including the many
// per-file `createTheme()` calls — by deep-merging zero-duration transitions
// and instant component defaults on top of whatever options the caller passes.
jest.mock('@mui/material/styles', () => {
    const actual = jest.requireActual('@mui/material/styles');
    const noAnimationOverrides = {
        transitions: {
            // Zero durations AND collapse the transition CSS string to 'none' so no
            // transition property is emitted at all (durations alone still leave the
            // property present, which some MUI surfaces schedule timers around).
            create: () => 'none',
            duration: {
                shortest: 0, shorter: 0, short: 0,
                standard: 0, complex: 0,
                enteringScreen: 0, leavingScreen: 0,
            },
        },
        components: {
            // TouchRipple is a timer-driven animation fired on every ButtonBase click
            // (Button/IconButton/MenuItem/Tab/...). Disabling it removes that per-click
            // cost across the whole suite.
            MuiButtonBase: {defaultProps: {disableRipple: true}},
            MuiDialog: {defaultProps: {transitionDuration: 0}},
            MuiBackdrop: {defaultProps: {transitionDuration: 0}},
            MuiMenu: {defaultProps: {transitionDuration: 0}},
            MuiPopover: {defaultProps: {transitionDuration: 0}},
            MuiCollapse: {defaultProps: {timeout: 0}},
            MuiTooltip: {defaultProps: {enterDelay: 0, leaveDelay: 0, enterNextDelay: 0}},
        },
    };
    return {
        ...actual,
        __esModule: true,
        createTheme: (...args: unknown[]) =>
            actual.createTheme(...(args.length ? args : [{}]), noAnimationOverrides),
    };
});

// DOM mocks — only run in jsdom environment (skipped for node-only tests)
if (typeof window !== 'undefined') {
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

    // jsdom does not implement scrollIntoView, and Mantine's Combobox (Select,
    // MultiSelect, Autocomplete, SearchSelect) calls it when it moves the active
    // option — without this every dropdown interaction throws.
    if (!Element.prototype.scrollIntoView) {
        Element.prototype.scrollIntoView = jest.fn();
    }
}

// Global variables declared in cshtml templates at runtime
// Must be defined before modules that use them at top-level scope
(global as unknown as Window).ContactID = 0;
(global as unknown as Window).FirstName = 'Test';
(global as unknown as Window).TimeZone = 'Europe/London';

// Suppress unavoidable framework warnings only.
// Application-level errors should be suppressed per-test using
// jest.spyOn(console, 'error').mockImplementation() — see suppressConsoleError
// in __testUtils__/index.tsx for a convenient helper.
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
