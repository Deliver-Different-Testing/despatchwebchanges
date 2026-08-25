/**
 * Shared Test Utilities
 *
 * Centralized utilities to reduce duplication across test files.
 */

import React from 'react';
import { render, RenderOptions, screen } from '@testing-library/react';
import {ThemeProvider, createTheme} from '@mui/material/styles';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MantineProvider, type MantineThemeOverride } from '@mantine/core';
import { dfrntTheme, dfrntCssVariablesResolver } from '../theme/dfrntMantineTheme';

/**
 * MUI theme for tests with all enter/exit animations disabled.
 *
 * MUI's Dialog/Menu/Popover/Collapse/Tooltip transitions run on real timers
 * and add hundreds of ms per interaction (userEvent waits for them) without
 * testing anything. Zeroing the durations keeps renders deterministic and
 * fast. Use this anywhere a test mounts transition-heavy MUI surfaces.
 */
export function createTestTheme() {
    return createTheme({
        transitions: {
            // See setup.ts: collapse transition strings to 'none' in addition to
            // zeroing durations.
            create: () => 'none',
            duration: {
                shortest: 0, shorter: 0, short: 0,
                standard: 0, complex: 0,
                enteringScreen: 0, leavingScreen: 0,
            },
        },
        components: {
            // TouchRipple is a timer-driven animation fired on every ButtonBase click.
            MuiButtonBase: {defaultProps: {disableRipple: true}},
            MuiDialog: {defaultProps: {transitionDuration: 0}},
            MuiBackdrop: {defaultProps: {transitionDuration: 0}},
            MuiMenu: {defaultProps: {transitionDuration: 0}},
            MuiPopover: {defaultProps: {transitionDuration: 0}},
            MuiCollapse: {defaultProps: {timeout: 0}},
            MuiTooltip: {defaultProps: {enterDelay: 0, leaveDelay: 0, enterNextDelay: 0}},
        },
    });
}

// Default MUI theme for tests (animations disabled — see createTestTheme).
export const testTheme = createTestTheme();

/**
 * Create a QueryClient configured for testing (no retries, immediate GC)
 */
export function createTestQueryClient(): QueryClient {
    return new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
                gcTime: 0,
                staleTime: 0,
            },
            mutations: {
                retry: false,
            },
        },
    });
}

interface WrapperOptions {
    withTheme?: boolean;
    withQueryClient?: boolean;
    queryClient?: QueryClient;
}

/**
 * Create a wrapper component with common providers
 */
export function createWrapper(options: WrapperOptions = {}) {
    const {
        withTheme = true,
        withQueryClient = false,
        queryClient,
    } = options;

    // One client per wrapper, not one per render — a fresh client on every render drops
    // the cache between re-renders, which is exactly what renderHook assertions read.
    const client = withQueryClient ? queryClient ?? createTestQueryClient() : undefined;

    const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
        let result = <>{children}</>;

        if (client) {
            result = (
                <QueryClientProvider client={client}>
                    {result}
                </QueryClientProvider>
            );
        }

        if (withTheme) {
            result = (
                <ThemeProvider theme={testTheme}>
                    {result}
                </ThemeProvider>
            );
        }

        return result;
    };

    return Wrapper;
}

/**
 * Wrapper with only a QueryClient — what a `renderHook` on a data hook needs.
 */
export function createQueryWrapper(queryClient?: QueryClient) {
    return createWrapper({withTheme: false, withQueryClient: true, queryClient});
}

/**
 * Render with MUI ThemeProvider
 */
export function renderWithTheme(ui: React.ReactElement, options?: Omit<RenderOptions, 'wrapper'>) {
    return render(ui, {
        wrapper: createWrapper({ withTheme: true }),
        ...options,
    });
}

/**
 * Render with ThemeProvider and QueryClientProvider
 */
export function renderWithProviders(
    ui: React.ReactElement,
    options?: Omit<RenderOptions, 'wrapper'> & { queryClient?: QueryClient }
) {
    const { queryClient, ...renderOptions } = options ?? {};
    return render(ui, {
        wrapper: createWrapper({ withTheme: true, withQueryClient: true, queryClient }),
        ...renderOptions,
    });
}

/**
 * Render with all providers (Theme, QueryClient)
 */
export function renderWithAllProviders(
    ui: React.ReactElement,
    options?: Omit<RenderOptions, 'wrapper'> & { queryClient?: QueryClient }
) {
    const { queryClient, ...renderOptions } = options ?? {};
    return render(ui, {
        wrapper: createWrapper({
            withTheme: true,
            withQueryClient: true,
            queryClient,
        }),
        ...renderOptions,
    });
}

/**
 * The Mantine provider as a component, for tests that build their own wrapper
 * element (rather than calling `renderWithMantine`) — typically because they
 * also need `rerender` with the wrapper inline. The drop-in replacement for
 * `<ThemeProvider theme={createTheme()}>`.
 */
export const MantineTestProvider: React.FC<{children: React.ReactNode}> = ({children}) => (
    <MantineProvider theme={dfrntTheme} cssVariablesResolver={dfrntCssVariablesResolver} env="test">
        {children}
    </MantineProvider>
);

/**
 * Render inside the DFRNT Mantine theme provider. The Mantine counterpart to
 * `renderWithTheme` — use it for components migrated off MUI. `forceColorScheme`
 * is unnecessary in tests (light is the default), so this stays minimal.
 *
 * `env` defaults to `'test'`, which strips Mantine's transitions *and its portals*
 * — `OptionalPortal` renders inline in that env. Pass `env: 'default'` when the
 * behaviour under test depends on real portalling (e.g. whether a nested dropdown
 * lands outside its parent popover and trips click-outside).
 */
export function renderWithMantine(
    ui: React.ReactElement,
    options?: Omit<RenderOptions, 'wrapper'> & {theme?: MantineThemeOverride; env?: 'default' | 'test'}
) {
    const {theme = dfrntTheme, env = 'test', ...renderOptions} = options ?? {};
    const Wrapper: React.FC<{children: React.ReactNode}> = ({children}) => (
        <MantineProvider theme={theme} cssVariablesResolver={dfrntCssVariablesResolver} env={env}>
            {children}
        </MantineProvider>
    );
    return render(ui, {wrapper: Wrapper, ...renderOptions});
}

/**
 * Mantine outside, MUI inside — the coexistence order the islands themselves
 * use (`islandTree(<MuiThemeIsland>…)`).
 *
 * For a component still on MUI that renders a migrated Mantine child: MUI
 * silently falls back to its default theme without a provider, but Mantine's
 * `useStyles` **throws**, so the Mantine provider has to be there even when the
 * component under test has no Mantine of its own.
 */
export function renderWithMantineOverMui(
    ui: React.ReactElement,
    options?: Omit<RenderOptions, 'wrapper'> & {queryClient?: QueryClient; withQueryClient?: boolean}
) {
    const {queryClient, withQueryClient = false, ...renderOptions} = options ?? {};
    const client = withQueryClient || queryClient ? (queryClient ?? createTestQueryClient()) : undefined;
    const Wrapper: React.FC<{children: React.ReactNode}> = ({children}) => (
        <MantineProvider theme={dfrntTheme} cssVariablesResolver={dfrntCssVariablesResolver} env="test">
            <ThemeProvider theme={testTheme}>
                {client ? <QueryClientProvider client={client}>{children}</QueryClientProvider> : children}
            </ThemeProvider>
        </MantineProvider>
    );
    return render(ui, {wrapper: Wrapper, ...renderOptions});
}

/**
 * Render inside the Mantine theme + a fresh test QueryClient — the Mantine
 * counterpart to `renderWithProviders`.
 */
export function renderWithMantineProviders(
    ui: React.ReactElement,
    options?: Omit<RenderOptions, 'wrapper'> & { queryClient?: QueryClient; theme?: MantineThemeOverride }
) {
    const { queryClient, theme = dfrntTheme, ...renderOptions } = options ?? {};
    const client = queryClient ?? createTestQueryClient();
    const Wrapper: React.FC<{children: React.ReactNode}> = ({children}) => (
        <MantineProvider theme={theme} cssVariablesResolver={dfrntCssVariablesResolver} env="test">
            <QueryClientProvider client={client}>{children}</QueryClientProvider>
        </MantineProvider>
    );
    return render(ui, {wrapper: Wrapper, ...renderOptions});
}

/**
 * Standard API error for testing error propagation
 */
export const mockApiError = {
    status: 500,
    statusText: 'Internal Server Error',
    message: 'Server error',
};

/**
 * Create a mock API error with custom values
 */
export function createMockApiError(overrides?: Partial<typeof mockApiError>) {
    return { ...mockApiError, ...overrides };
}

/**
 * Helper to test that API errors are propagated correctly
 */
export async function expectErrorPropagation<T>(
    mockFn: jest.Mock,
    apiCall: () => Promise<T>,
    error = mockApiError
): Promise<void> {
    mockFn.mockRejectedValueOnce(error);
    await expect(apiCall()).rejects.toEqual(error);
}

/**
 * Create default props with overrides - generic factory
 */
export function createProps<T extends object>(defaults: T, overrides?: Partial<T>): T {
    return { ...defaults, ...overrides };
}

/**
 * Suppress console.error for the current test scope.
 * Call in beforeEach or at the top of a test that intentionally triggers errors.
 * Returns a spy that can be used for assertions on error calls.
 *
 * @example
 * let errorSpy: jest.SpyInstance;
 * beforeEach(() => { errorSpy = suppressConsoleError(); });
 * afterEach(() => { errorSpy.mockRestore(); });
 */
export function suppressConsoleError(...allowedPrefixes: string[]): jest.SpyInstance {
    return jest.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
        if (allowedPrefixes.length === 0) return;
        const msg = typeof args[0] === 'string' ? args[0] : '';
        if (!allowedPrefixes.some(p => msg.startsWith(p))) {
            // eslint-disable-next-line no-console
            console.warn('[unexpected console.error]', ...args);
        }
    });
}
