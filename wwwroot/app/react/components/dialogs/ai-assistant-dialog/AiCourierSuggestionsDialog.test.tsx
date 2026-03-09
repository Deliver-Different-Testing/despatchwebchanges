/**
 * AiCourierSuggestionsDialog Component Tests
 *
 * Tests the React dialog for AI courier suggestions:
 * - Open/close behaviour
 * - Loading skeleton state
 * - Loaded state with courier cards
 * - Empty couriers state (markdown only)
 * - Error state with retry
 * - Assign flow (click, loading spinner, success + auto-close)
 * - Assign error handling
 */

import React from 'react';
import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {createTheme, ThemeProvider} from '@mui/material';
import {AiCourierSuggestionsDialog} from './AiCourierSuggestionsDialog';
import type {AiCourierSuggestionResponse} from '../../../services/aiAssistantApi';
import {suggestCouriers} from '../../../services/aiAssistantApi';

// Mock the API module
jest.mock('../../../services/aiAssistantApi', () => ({
    suggestCouriers: jest.fn(),
}));

const mockSuggestCouriers = suggestCouriers as jest.MockedFunction<typeof suggestCouriers>;

const theme = createTheme();

const renderWithTheme = (ui: React.ReactElement) =>
    render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

const mockCourierResponse: AiCourierSuggestionResponse = {
    summary: '**Top Pick:** **Jane** — lowest workload\n\n1. **Jane** (C11) — 1 active job\n2. **John** (C10) — 3 active jobs',
    usage: { inputTokens: 250, outputTokens: 40 },
    couriers: [
        { courierId: 10, code: 'C10', firstName: 'John' },
        { courierId: 11, code: 'C11', firstName: 'Jane' },
        { courierId: 12, code: 'C12', firstName: 'Bob' },
    ],
};

const defaultProps = {
    open: true,
    onClose: jest.fn(),
    jobId: 42,
    jobNo: 'J100',
    onAssign: jest.fn().mockResolvedValue(undefined),
};

describe('AiCourierSuggestionsDialog', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    describe('Open/Close', () => {
        it('renders nothing when not open', () => {
            mockSuggestCouriers.mockResolvedValue(mockCourierResponse);
            const { container } = renderWithTheme(
                <AiCourierSuggestionsDialog {...defaultProps} open={false} />
            );
            expect(container.querySelector('.MuiDialog-root')).toBeNull();
        });

        it('renders dialog when open', () => {
            mockSuggestCouriers.mockResolvedValue(mockCourierResponse);
            renderWithTheme(
                <AiCourierSuggestionsDialog {...defaultProps} />
            );
            expect(screen.getByText(/AI Courier Suggestions/)).toBeInTheDocument();
        });

        it('displays job number in header', () => {
            mockSuggestCouriers.mockResolvedValue(mockCourierResponse);
            renderWithTheme(
                <AiCourierSuggestionsDialog {...defaultProps} jobNo="ABC123" />
            );
            expect(screen.getByText(/ABC123/)).toBeInTheDocument();
        });

        it('calls onClose when close button is clicked', async () => {
            mockSuggestCouriers.mockResolvedValue(mockCourierResponse);
            renderWithTheme(
                <AiCourierSuggestionsDialog {...defaultProps} />
            );

            expect(await screen.findByText('Quick Assign')).toBeInTheDocument();

            // Find the X button in the header (first close icon button)
            const closeButtons = screen.getAllByRole('button');
            const headerCloseButton = closeButtons.find(
                (btn) => btn.querySelector('[data-testid="CloseIcon"]') !== null
            );
            expect(headerCloseButton).toBeDefined();
            fireEvent.click(headerCloseButton!);

            expect(defaultProps.onClose).toHaveBeenCalled();
        });

        it('calls onClose when Close button in footer is clicked', async () => {
            mockSuggestCouriers.mockResolvedValue(mockCourierResponse);
            renderWithTheme(
                <AiCourierSuggestionsDialog {...defaultProps} />
            );

            expect(await screen.findByText('Quick Assign')).toBeInTheDocument();

            fireEvent.click(screen.getByText('Close'));
            expect(defaultProps.onClose).toHaveBeenCalled();
        });
    });

    describe('Loading state', () => {
        it('shows skeleton placeholders while loading', () => {
            mockSuggestCouriers.mockReturnValue(new Promise(() => {}));
            renderWithTheme(
                <AiCourierSuggestionsDialog {...defaultProps} />
            );

            const skeletons = document.querySelectorAll('.MuiSkeleton-root');
            expect(skeletons.length).toBeGreaterThanOrEqual(3);
        });

        it('calls suggestCouriers with the correct jobId', () => {
            mockSuggestCouriers.mockReturnValue(new Promise(() => {}));
            renderWithTheme(
                <AiCourierSuggestionsDialog {...defaultProps} jobId={99} />
            );

            expect(mockSuggestCouriers).toHaveBeenCalledWith(99);
        });
    });

    describe('Loaded state with couriers', () => {
        it('renders AI reasoning via markdown', async () => {
            mockSuggestCouriers.mockResolvedValue(mockCourierResponse);
            renderWithTheme(
                <AiCourierSuggestionsDialog {...defaultProps} />
            );

            expect(await screen.findByTestId('react-markdown')).toBeInTheDocument();

            expect(screen.getByTestId('react-markdown')).toHaveTextContent('Top Pick');
        });

        it('renders courier cards with names and codes', async () => {
            mockSuggestCouriers.mockResolvedValue(mockCourierResponse);
            renderWithTheme(
                <AiCourierSuggestionsDialog {...defaultProps} />
            );

            expect(await screen.findByText('John')).toBeInTheDocument();

            expect(screen.getByText('Jane')).toBeInTheDocument();
            expect(screen.getByText('Bob')).toBeInTheDocument();
            expect(screen.getByText('C10')).toBeInTheDocument();
            expect(screen.getByText('C11')).toBeInTheDocument();
            expect(screen.getByText('C12')).toBeInTheDocument();
        });

        it('renders an Assign button for each courier', async () => {
            mockSuggestCouriers.mockResolvedValue(mockCourierResponse);
            renderWithTheme(
                <AiCourierSuggestionsDialog {...defaultProps} />
            );

            expect(await screen.findByText('Quick Assign')).toBeInTheDocument();

            const assignButtons = screen.getAllByText('Assign');
            expect(assignButtons).toHaveLength(3);
        });

        it('shows Quick Assign heading', async () => {
            mockSuggestCouriers.mockResolvedValue(mockCourierResponse);
            renderWithTheme(
                <AiCourierSuggestionsDialog {...defaultProps} />
            );

            expect(await screen.findByText('Quick Assign')).toBeInTheDocument();
        });
    });

    describe('Empty couriers state', () => {
        it('shows info message when no couriers are available', async () => {
            mockSuggestCouriers.mockResolvedValue({
                summary: 'Some AI analysis text',
                usage: { inputTokens: 100, outputTokens: 20 },
                couriers: [],
            });

            renderWithTheme(
                <AiCourierSuggestionsDialog {...defaultProps} />
            );

            expect(await screen.findByTestId('react-markdown')).toBeInTheDocument();

            expect(screen.getByText(/No matched couriers available/)).toBeInTheDocument();
            expect(screen.queryByText('Quick Assign')).not.toBeInTheDocument();
        });

        it('still renders AI markdown when no couriers', async () => {
            mockSuggestCouriers.mockResolvedValue({
                summary: 'Driver analysis without matched couriers',
                usage: { inputTokens: 100, outputTokens: 20 },
                couriers: [],
            });

            renderWithTheme(
                <AiCourierSuggestionsDialog {...defaultProps} />
            );

            expect(await screen.findByTestId('react-markdown')).toHaveTextContent(
                'Driver analysis without matched couriers'
            );
        });
    });

    describe('Error state', () => {
        it('shows error message on fetch failure', async () => {
            mockSuggestCouriers.mockRejectedValue(new Error('Network timeout'));

            renderWithTheme(
                <AiCourierSuggestionsDialog {...defaultProps} />
            );

            expect(await screen.findByText('Network timeout')).toBeInTheDocument();
        });

        it('shows Retry button on error', async () => {
            mockSuggestCouriers.mockRejectedValue(new Error('Server error'));

            renderWithTheme(
                <AiCourierSuggestionsDialog {...defaultProps} />
            );

            expect(await screen.findByText('Retry')).toBeInTheDocument();
        });

        it('retries fetch when Retry button is clicked', async () => {
            mockSuggestCouriers
                .mockRejectedValueOnce(new Error('First failure'))
                .mockResolvedValueOnce(mockCourierResponse);

            renderWithTheme(
                <AiCourierSuggestionsDialog {...defaultProps} />
            );

            expect(await screen.findByText('Retry')).toBeInTheDocument();

            fireEvent.click(screen.getByText('Retry'));

            expect(await screen.findByText('Quick Assign')).toBeInTheDocument();

            expect(mockSuggestCouriers).toHaveBeenCalledTimes(2);
        });
    });

    describe('Assign flow', () => {
        it('calls onAssign with correct courierId when Assign is clicked', async () => {
            mockSuggestCouriers.mockResolvedValue(mockCourierResponse);
            const onAssign = jest.fn().mockResolvedValue(undefined);

            renderWithTheme(
                <AiCourierSuggestionsDialog {...defaultProps} onAssign={onAssign} />
            );

            expect(await screen.findAllByText('Assign')).toHaveLength(3);

            // Click first Assign button (John, courierId: 10)
            fireEvent.click(screen.getAllByText('Assign')[0]);

            await waitFor(() => {
                expect(onAssign).toHaveBeenCalledWith(10);
            });
        });

        it('shows success state after assignment', async () => {
            mockSuggestCouriers.mockResolvedValue(mockCourierResponse);
            const onAssign = jest.fn().mockResolvedValue(undefined);

            renderWithTheme(
                <AiCourierSuggestionsDialog {...defaultProps} onAssign={onAssign} />
            );

            expect(await screen.findAllByText('Assign')).toHaveLength(3);

            fireEvent.click(screen.getAllByText('Assign')[0]);

            expect(await screen.findByText(/Assigned to John/)).toBeInTheDocument();

            expect(screen.getByText(/J100 has been dispatched/)).toBeInTheDocument();
        });

        it('disables all Assign buttons while one is in progress', async () => {
            mockSuggestCouriers.mockResolvedValue(mockCourierResponse);
            // Create a promise that doesn't resolve immediately
            let resolveAssign: () => void;
            const onAssign = jest.fn().mockReturnValue(
                new Promise<void>((resolve) => {
                    resolveAssign = resolve;
                })
            );

            renderWithTheme(
                <AiCourierSuggestionsDialog {...defaultProps} onAssign={onAssign} />
            );

            expect(await screen.findAllByText('Assign')).toHaveLength(3);

            fireEvent.click(screen.getAllByText('Assign')[0]);

            // All remaining Assign buttons should be disabled
            await waitFor(() => {
                const assignButtons = screen.getAllByRole('button').filter(
                    (btn) => btn.textContent === 'Assign'
                );
                assignButtons.forEach((btn) => {
                    expect(btn).toBeDisabled();
                });
            });

            // Resolve to clean up
            await act(async () => {
                resolveAssign!();
            });
        });

        it('auto-closes dialog after successful assignment', async () => {
            mockSuggestCouriers.mockResolvedValue(mockCourierResponse);
            const onClose = jest.fn();
            const onAssign = jest.fn().mockResolvedValue(undefined);

            renderWithTheme(
                <AiCourierSuggestionsDialog
                    {...defaultProps}
                    onClose={onClose}
                    onAssign={onAssign}
                />
            );

            expect(await screen.findAllByText('Assign')).toHaveLength(3);

            fireEvent.click(screen.getAllByText('Assign')[0]);

            expect(await screen.findByText(/Assigned to John/)).toBeInTheDocument();

            // Fast-forward the auto-close timer
            act(() => {
                jest.advanceTimersByTime(1500);
            });

            expect(onClose).toHaveBeenCalled();
        });

        it('does not hide footer during assigned phase', async () => {
            mockSuggestCouriers.mockResolvedValue(mockCourierResponse);
            const onAssign = jest.fn().mockResolvedValue(undefined);

            renderWithTheme(
                <AiCourierSuggestionsDialog {...defaultProps} onAssign={onAssign} />
            );

            expect(await screen.findAllByText('Assign')).toHaveLength(3);

            fireEvent.click(screen.getAllByText('Assign')[0]);

            expect(await screen.findByText(/Assigned to John/)).toBeInTheDocument();

            // The Close button in DialogActions should not be present during assigned state
            expect(screen.queryByText('Close')).not.toBeInTheDocument();
        });
    });

    describe('Assign error handling', () => {
        it('shows error message when assignment fails', async () => {
            mockSuggestCouriers.mockResolvedValue(mockCourierResponse);
            const onAssign = jest.fn().mockRejectedValue(new Error('Allocation failed'));

            renderWithTheme(
                <AiCourierSuggestionsDialog {...defaultProps} onAssign={onAssign} />
            );

            expect(await screen.findAllByText('Assign')).toHaveLength(3);

            fireEvent.click(screen.getAllByText('Assign')[0]);

            expect(await screen.findByText('Allocation failed')).toBeInTheDocument();
        });

        it('re-enables Assign buttons after assignment error', async () => {
            mockSuggestCouriers.mockResolvedValue(mockCourierResponse);
            const onAssign = jest.fn().mockRejectedValue(new Error('Failed'));

            renderWithTheme(
                <AiCourierSuggestionsDialog {...defaultProps} onAssign={onAssign} />
            );

            expect(await screen.findAllByText('Assign')).toHaveLength(3);

            fireEvent.click(screen.getAllByText('Assign')[0]);

            // After error, buttons should be re-enabled
            await waitFor(() => {
                const assignButtons = screen.getAllByText('Assign');
                expect(assignButtons).toHaveLength(3);
                assignButtons.forEach((btn) => {
                    expect(btn.closest('button')).not.toBeDisabled();
                });
            });
        });
    });

    describe('Refetch on reopen', () => {
        it('fetches suggestions when dialog opens', () => {
            mockSuggestCouriers.mockReturnValue(new Promise(() => {}));
            renderWithTheme(
                <AiCourierSuggestionsDialog {...defaultProps} />
            );

            expect(mockSuggestCouriers).toHaveBeenCalledTimes(1);
            expect(mockSuggestCouriers).toHaveBeenCalledWith(42);
        });
    });
});
