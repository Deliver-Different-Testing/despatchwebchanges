/**
 * Shared Test Utilities
 *
 * Centralized utilities to reduce duplication across test files.
 */

import React from 'react';
import { render, RenderOptions, screen } from '@testing-library/react';
import {ThemeProvider, createTheme} from '@mui/material/styles';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';

// Default MUI theme for tests
export const testTheme = createTheme();

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
    withLocalization?: boolean;
    queryClient?: QueryClient;
}

/**
 * Create a wrapper component with common providers
 */
export function createWrapper(options: WrapperOptions = {}) {
    const {
        withTheme = true,
        withQueryClient = false,
        withLocalization = false,
        queryClient,
    } = options;

    const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
        let result = <>{children}</>;

        if (withLocalization) {
            result = (
                <LocalizationProvider dateAdapter={AdapterDayjs}>
                    {result}
                </LocalizationProvider>
            );
        }

        if (withQueryClient) {
            const client = queryClient ?? createTestQueryClient();
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
 * Render with all providers (Theme, QueryClient, Localization)
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
            withLocalization: true,
            queryClient,
        }),
        ...renderOptions,
    });
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
 * Common test for dialog open/close state
 */
export function describeDialogOpenClose(
    renderDialog: (open: boolean) => ReturnType<typeof render>,
) {
    describe('Dialog Open/Close', () => {
        it('renders nothing when not open', () => {
            renderDialog(false);
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });

        it('renders when open', () => {
            renderDialog(true);
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });
    });
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
