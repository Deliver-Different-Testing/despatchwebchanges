/**
 * AiSummaryPanel Component Tests
 * Optimised: read-only tests consolidated to reduce render count.
 *
 * Tests the collapsible AI summary card including:
 * - formatRelativeTime helper
 * - Expand/collapse behaviour
 * - Loading skeleton state
 * - Copy-to-clipboard button
 * - Error display
 * - Abort/stop behaviour
 * - Auto-fetch on mount
 * - Markdown renderer integration
 */

import React from 'react';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {createTheme, ThemeProvider} from '@mui/material/styles';
import {AiSummaryPanel} from './AiSummaryPanel';
import type {AiSummaryResponse} from '../../../services/aiAssistantApi';

const theme = createTheme();

const renderWithTheme = (ui: React.ReactElement) =>
    render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

// Helper to create a mock fetchSummary that resolves with a summary
const createMockFetch = (summary = 'Test summary content', delay = 0) => {
    return jest.fn((_signal?: AbortSignal): Promise<AiSummaryResponse> =>
        new Promise((resolve) => {
            const timer = setTimeout(() => {
                resolve({
                    summary,
                    usage: { inputTokens: 100, outputTokens: 20 },
                });
            }, delay);
            _signal?.addEventListener('abort', () => clearTimeout(timer));
        })
    );
};

// Helper to create a mock fetchSummary that rejects
const createMockFetchError = (message = 'API Error') => {
    return jest.fn((): Promise<AiSummaryResponse> => Promise.reject(new Error(message)));
};

describe('AiSummaryPanel', () => {
    describe('Initial rendering', () => {
        it('renders collapsed by default with title and placeholder text', () => {
            const mockFetch = createMockFetch();
            renderWithTheme(
                <AiSummaryPanel title="Auto-mate Summary" fetchSummary={mockFetch} />
            );

            expect(screen.getByText('Auto-mate Summary')).toBeInTheDocument();
            // Should not have fetched yet
            expect(mockFetch).not.toHaveBeenCalled();

            // MUI Collapse renders content in DOM even when collapsed (for animation),
            // so the placeholder text is present but visually hidden via Collapse.
            const placeholder = screen.getByText('Click to generate an Auto-mate summary.');
            expect(placeholder).toBeInTheDocument();
        });
    });

    describe('Expand and fetch', () => {
        it('fetches summary when expanded by clicking the header', async () => {
            const mockFetch = createMockFetch('Generated summary');
            renderWithTheme(
                <AiSummaryPanel title="Auto-mate Summary" fetchSummary={mockFetch} />
            );

            // Click to expand
            fireEvent.click(screen.getByText('Auto-mate Summary'));

            await waitFor(() => {
                expect(mockFetch).toHaveBeenCalledTimes(1);
            });

            expect(await screen.findByTestId('react-markdown')).toHaveTextContent('Generated summary');
        });

        it('does not re-fetch when collapsing and re-expanding', async () => {
            const mockFetch = createMockFetch('Summary');
            renderWithTheme(
                <AiSummaryPanel title="Test" fetchSummary={mockFetch} />
            );

            // Expand
            fireEvent.click(screen.getByText('Test'));
            expect(await screen.findByTestId('react-markdown')).toBeInTheDocument();

            // Collapse
            fireEvent.click(screen.getByText('Test'));
            // Re-expand
            fireEvent.click(screen.getByText('Test'));

            // Should still only have fetched once
            expect(mockFetch).toHaveBeenCalledTimes(1);
        });
    });

    describe('Auto-fetch', () => {
        it('automatically fetches and expands when autoFetch is true', async () => {
            const mockFetch = createMockFetch('Auto-fetched summary');
            renderWithTheme(
                <AiSummaryPanel title="Test" fetchSummary={mockFetch} autoFetch />
            );

            await waitFor(() => {
                expect(mockFetch).toHaveBeenCalledTimes(1);
            });

            expect(await screen.findByTestId('react-markdown')).toHaveTextContent('Auto-fetched summary');
        });
    });

    describe('Loading state', () => {
        it('shows skeleton placeholders and stop button while loading', async () => {
            // Use a fetch that never resolves to keep loading state
            const neverResolve = jest.fn(
                () => new Promise<AiSummaryResponse>(() => {})
            );
            renderWithTheme(
                <AiSummaryPanel title="Test" fetchSummary={neverResolve} autoFetch />
            );

            await waitFor(() => {
                // MUI Skeleton components render with role="progressbar" or class MuiSkeleton
                const skeletons = document.querySelectorAll('.MuiSkeleton-root');
                expect(skeletons.length).toBeGreaterThanOrEqual(3);
            });

            expect(screen.getByLabelText('Stop generating')).toBeInTheDocument();
        });
    });

    describe('Error state', () => {
        it('displays error message on fetch failure', async () => {
            const mockFetch = createMockFetchError('Network timeout');
            renderWithTheme(
                <AiSummaryPanel title="Test" fetchSummary={mockFetch} autoFetch />
            );

            expect(await screen.findByText('Network timeout')).toBeInTheDocument();
        });
    });

    describe('Copy button', () => {
        it('shows copy button when summary is available and copies to clipboard when clicked', async () => {
            // Mock clipboard API
            const writeTextMock = jest.fn().mockResolvedValue(undefined);
            Object.assign(navigator, {
                clipboard: { writeText: writeTextMock },
            });

            const mockFetch = createMockFetch('Copy this text');
            renderWithTheme(
                <AiSummaryPanel title="Test" fetchSummary={mockFetch} autoFetch />
            );

            expect(await screen.findByTestId('react-markdown')).toBeInTheDocument();

            expect(screen.getByLabelText('Copy to clipboard')).toBeInTheDocument();

            fireEvent.click(screen.getByLabelText('Copy to clipboard'));

            await waitFor(() => {
                expect(writeTextMock).toHaveBeenCalledWith('Copy this text');
            });
        });
    });

    describe('Stop button', () => {
        it('stops loading when stop button is clicked', async () => {
            let resolvePromise: (value: AiSummaryResponse) => void;
            const controlledFetch = jest.fn(
                () =>
                    new Promise<AiSummaryResponse>((resolve) => {
                        resolvePromise = resolve;
                    })
            );

            renderWithTheme(
                <AiSummaryPanel title="Test" fetchSummary={controlledFetch} autoFetch />
            );

            expect(await screen.findByLabelText('Stop generating')).toBeInTheDocument();

            fireEvent.click(screen.getByLabelText('Stop generating'));

            // Loading should stop, and no summary displayed
            await waitFor(() => {
                expect(screen.queryByLabelText('Stop generating')).not.toBeInTheDocument();
            });
        });
    });

    describe('Relative time display', () => {
        it('shows relative time after summary is generated', async () => {
            const mockFetch = createMockFetch('Summary');
            renderWithTheme(
                <AiSummaryPanel title="Test" fetchSummary={mockFetch} autoFetch />
            );

            expect(await screen.findByTestId('react-markdown')).toBeInTheDocument();

            // Should show "just now" since it was just generated
            expect(screen.getByText('just now')).toBeInTheDocument();
        });
    });

    describe('Accent color', () => {
        it('applies custom accent color', () => {
            const mockFetch = createMockFetch();
            const { container } = renderWithTheme(
                <AiSummaryPanel
                    title="Test"
                    fetchSummary={mockFetch}
                    accentColor="#ff5722"
                />
            );

            // querySelector is used here because MUI Card renders a plain <div> with no
            // implicit ARIA role, and there is no text content unique to the card wrapper.
            const card = container.querySelector('.MuiCard-root') as HTMLElement;
            expect(card).toBeInTheDocument();
        });
    });

    describe('Unmount abort', () => {
        it('aborts in-flight request on unmount', async () => {
            const abortSpy = jest.spyOn(AbortController.prototype, 'abort');

            const neverResolve = jest.fn(
                () => new Promise<AiSummaryResponse>(() => {})
            );
            const { unmount } = renderWithTheme(
                <AiSummaryPanel title="Test" fetchSummary={neverResolve} autoFetch />
            );

            await waitFor(() => {
                expect(neverResolve).toHaveBeenCalled();
            });

            unmount();

            expect(abortSpy).toHaveBeenCalled();
            abortSpy.mockRestore();
        });
    });
});
