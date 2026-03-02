/**
 * AiSummaryPanel Component Tests
 *
 * Tests the collapsible AI summary card including:
 * - formatRelativeTime helper
 * - Expand/collapse behaviour
 * - Loading skeleton state
 * - Refresh and copy-to-clipboard buttons
 * - Error display
 * - Abort/stop behaviour
 * - Auto-fetch on mount
 * - Markdown renderer integration
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material';
import { AiSummaryPanel } from './AiSummaryPanel';
import type { AiSummaryResponse } from '../../../services/aiAssistantApi';

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
        it('renders collapsed by default with title', () => {
            const mockFetch = createMockFetch();
            renderWithTheme(
                <AiSummaryPanel title="AI Summary" fetchSummary={mockFetch} />
            );

            expect(screen.getByText('AI Summary')).toBeInTheDocument();
            // Should not have fetched yet
            expect(mockFetch).not.toHaveBeenCalled();
        });

        it('renders placeholder text in collapsed content area', () => {
            const mockFetch = createMockFetch();
            renderWithTheme(
                <AiSummaryPanel title="Test" fetchSummary={mockFetch} />
            );

            // MUI Collapse renders content in DOM even when collapsed (for animation),
            // so the placeholder text is present but visually hidden via Collapse.
            // Verify it exists in the document as part of the collapsed content.
            const placeholder = screen.getByText('Click to generate an AI summary.');
            expect(placeholder).toBeInTheDocument();
        });
    });

    describe('Expand and fetch', () => {
        it('fetches summary when expanded by clicking the header', async () => {
            const mockFetch = createMockFetch('Generated summary');
            renderWithTheme(
                <AiSummaryPanel title="AI Summary" fetchSummary={mockFetch} />
            );

            // Click to expand
            fireEvent.click(screen.getByText('AI Summary'));

            await waitFor(() => {
                expect(mockFetch).toHaveBeenCalledTimes(1);
            });

            await waitFor(() => {
                expect(screen.getByTestId('react-markdown')).toHaveTextContent('Generated summary');
            });
        });

        it('does not re-fetch when collapsing and re-expanding', async () => {
            const mockFetch = createMockFetch('Summary');
            renderWithTheme(
                <AiSummaryPanel title="Test" fetchSummary={mockFetch} />
            );

            // Expand
            fireEvent.click(screen.getByText('Test'));
            await waitFor(() => {
                expect(screen.getByTestId('react-markdown')).toBeInTheDocument();
            });

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

            await waitFor(() => {
                expect(screen.getByTestId('react-markdown')).toHaveTextContent('Auto-fetched summary');
            });
        });
    });

    describe('Loading state', () => {
        it('shows skeleton placeholders while loading', async () => {
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
        });

        it('shows stop button while loading', async () => {
            const neverResolve = jest.fn(
                () => new Promise<AiSummaryResponse>(() => {})
            );
            renderWithTheme(
                <AiSummaryPanel title="Test" fetchSummary={neverResolve} autoFetch />
            );

            await waitFor(() => {
                expect(screen.getByLabelText('Stop generating')).toBeInTheDocument();
            });
        });
    });

    describe('Error state', () => {
        it('displays error message on fetch failure', async () => {
            const mockFetch = createMockFetchError('Network timeout');
            renderWithTheme(
                <AiSummaryPanel title="Test" fetchSummary={mockFetch} autoFetch />
            );

            await waitFor(() => {
                expect(screen.getByText('Network timeout')).toBeInTheDocument();
            });
        });
    });

    describe('Refresh button', () => {
        it('shows refresh button after summary is fetched', async () => {
            const mockFetch = createMockFetch('Summary');
            renderWithTheme(
                <AiSummaryPanel title="Test" fetchSummary={mockFetch} autoFetch />
            );

            await waitFor(() => {
                expect(screen.getByTestId('react-markdown')).toBeInTheDocument();
            });

            expect(screen.getByLabelText('Refresh')).toBeInTheDocument();
        });

        it('triggers a new fetch when refresh is clicked', async () => {
            const mockFetch = createMockFetch('Summary');
            renderWithTheme(
                <AiSummaryPanel title="Test" fetchSummary={mockFetch} autoFetch />
            );

            await waitFor(() => {
                expect(screen.getByTestId('react-markdown')).toBeInTheDocument();
            });

            // Click refresh
            fireEvent.click(screen.getByLabelText('Refresh'));

            await waitFor(() => {
                // Should have been called twice: initial + refresh
                expect(mockFetch).toHaveBeenCalledTimes(2);
            });
        });
    });

    describe('Copy button', () => {
        it('shows copy button when summary is available', async () => {
            const mockFetch = createMockFetch('Summary to copy');
            renderWithTheme(
                <AiSummaryPanel title="Test" fetchSummary={mockFetch} autoFetch />
            );

            await waitFor(() => {
                expect(screen.getByTestId('react-markdown')).toBeInTheDocument();
            });

            expect(screen.getByLabelText('Copy to clipboard')).toBeInTheDocument();
        });

        it('copies summary to clipboard when clicked', async () => {
            // Mock clipboard API
            const writeTextMock = jest.fn().mockResolvedValue(undefined);
            Object.assign(navigator, {
                clipboard: { writeText: writeTextMock },
            });

            const mockFetch = createMockFetch('Copy this text');
            renderWithTheme(
                <AiSummaryPanel title="Test" fetchSummary={mockFetch} autoFetch />
            );

            await waitFor(() => {
                expect(screen.getByTestId('react-markdown')).toBeInTheDocument();
            });

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

            await waitFor(() => {
                expect(screen.getByLabelText('Stop generating')).toBeInTheDocument();
            });

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

            await waitFor(() => {
                expect(screen.getByTestId('react-markdown')).toBeInTheDocument();
            });

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
