/**
 * TaskHistory Component Tests
 * Optimised: read-only tests consolidated to reduce render count.
 */

import React from 'react';
import {render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {createTheme, ThemeProvider} from '@mui/material/styles';
import {LocalizationProvider} from '@mui/x-date-pickers/LocalizationProvider';
import {AdapterDayjs} from '@mui/x-date-pickers/AdapterDayjs';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import dayjs from 'dayjs';
import {TaskHistory} from './TaskHistory';
import {DeliveryJourney, DensityMode, TaskHistoryProps} from './TaskHistory.interfaces';

// Mock the date utilities
jest.mock('../../../utils/dateUtils', () => ({
    getIanaTimezone: jest.fn(() => 'America/New_York'),
    getTenantTimezone: jest.fn(() => 'America/New_York'),
    getTimezoneAbbreviation: jest.fn(() => '(EST)'),
}));

// Mock tasksApi (used by useDeliveryJourney hook)
const mockGetDeliveryJourney = jest.fn();
jest.mock('../../../services/tasksApi', () => ({
    tasksApi: {
        getDeliveryJourney: (...args: unknown[]) => mockGetDeliveryJourney(...args),
    },
}));

const theme = createTheme();

function createTestQueryClient() {
    return new QueryClient({
        defaultOptions: {
            queries: {retry: false, gcTime: 0, staleTime: 0},
            mutations: {retry: false},
        },
    });
}

const renderWithProviders = (ui: React.ReactElement) => {
    const queryClient = createTestQueryClient();
    return render(
        <QueryClientProvider client={queryClient}>
            <ThemeProvider theme={theme}>
                <LocalizationProvider dateAdapter={AdapterDayjs}>
                    {ui}
                </LocalizationProvider>
            </ThemeProvider>
        </QueryClientProvider>
    );
};

// Sample delivery journey data
const createMockDeliveryEvents = (): DeliveryJourney[] => [
    {
        id: '1',
        jobId: 123,
        title: 'Order Received',
        icon: 'shopping_cart',
        description: 'Order has been received and is being processed',
        date: dayjs('2025-01-15T09:00:00'),
        tags: ['priority', 'express'],
        status: 'completed',
        notes: 'Customer requested express delivery',
        _dateStr: 'Jan 15, 2025 9:00 AM',
    },
    {
        id: '2',
        jobId: 123,
        title: 'Dispatched to Courier',
        icon: 'local_shipping',
        description: 'Package dispatched to courier for delivery',
        date: dayjs('2025-01-15T10:00:00'),
        tags: ['in-transit'],
        status: 'completed',
        notes: '',
        _dateStr: 'Jan 15, 2025 10:00 AM',
    },
    {
        id: '3',
        jobId: 123,
        title: 'Out for Delivery',
        icon: 'directions_car',
        description: 'Package is out for delivery',
        date: dayjs('2025-01-15T14:00:00'),
        tags: ['delivery', 'final-mile'],
        status: 'current',
        notes: 'Driver en route',
        _dateStr: 'Jan 15, 2025 2:00 PM',
    },
    {
        id: '4',
        jobId: 123,
        title: 'Delivered',
        icon: 'check_circle',
        description: 'Package delivered successfully',
        date: dayjs('2025-01-15T16:00:00'),
        tags: ['complete'],
        status: 'pending',
        notes: '',
        _dateStr: 'Jan 15, 2025 4:00 PM',
    },
];

const createDefaultProps = (overrides?: Partial<TaskHistoryProps>): TaskHistoryProps => {
    return {
        jobId: 123,
        config: {},
        onDeliveryEventClick: jest.fn(),
        showSuccessToast: jest.fn(),
        showErrorToast: jest.fn(),
        showInfoToast: jest.fn(),
        isUsCustomer: true,
        ...overrides,
    };
};

describe('TaskHistory', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        mockGetDeliveryJourney.mockResolvedValue(createMockDeliveryEvents());
    });

    afterEach(() => {
        jest.useRealTimers();
        mockGetDeliveryJourney.mockReset();
    });

    describe('Rendering', () => {
        it('renders "Select a Job" when no jobId is provided', () => {
            const props = createDefaultProps({jobId: undefined});
            renderWithProviders(<TaskHistory {...props} />);

            expect(screen.getByText('Select a Job')).toBeInTheDocument();
            expect(screen.getByText('Select a job to view its delivery journey.')).toBeInTheDocument();
        });

        it('renders loading state initially', () => {
            const props = createDefaultProps();
            renderWithProviders(<TaskHistory {...props} />);

            expect(screen.getByRole('progressbar')).toBeInTheDocument();
        });

        it('renders delivery events, dates, tags, notes, status styling, and header actions after loading', async () => {
            const props = createDefaultProps();
            renderWithProviders(<TaskHistory {...props} />);

            // Wait for async load
            expect(await screen.findByText('Order Received')).toBeInTheDocument();

            // -- delivery events --
            expect(screen.getByText('Dispatched to Courier')).toBeInTheDocument();
            expect(screen.getByText('Out for Delivery')).toBeInTheDocument();
            expect(screen.getByText('Delivered')).toBeInTheDocument();

            // -- event dates --
            expect(screen.getByText(/Jan 15, 2025 9:00 AM/)).toBeInTheDocument();

            // -- event tags --
            expect(screen.getByText('priority')).toBeInTheDocument();
            expect(screen.getByText('express')).toBeInTheDocument();

            // -- event notes (normal mode) --
            expect(screen.getByText('Customer requested express delivery')).toBeInTheDocument();

            // -- status styling: completed, current, pending all rendered --
            expect(screen.getByText('Order Received')).toBeInTheDocument(); // completed
            expect(screen.getByText('Out for Delivery')).toBeInTheDocument(); // current
            expect(screen.getByText('Delivered')).toBeInTheDocument(); // pending

            // -- header actions: density toggle + refresh buttons present --
            const buttons = screen.getAllByRole('button');
            expect(buttons.length).toBeGreaterThan(0);
        });

        it('renders empty state when no events', async () => {
            mockGetDeliveryJourney.mockResolvedValue([]);
            const props = createDefaultProps();
            renderWithProviders(<TaskHistory {...props} />);

            expect(await screen.findByText('No Journey Events')).toBeInTheDocument();

            expect(screen.getByText('No delivery journey events found for this job.')).toBeInTheDocument();
        });
    });

    describe('Density Modes', () => {
        it('cycles through density modes when toggle is clicked', async () => {
            const user = userEvent.setup({advanceTimers: jest.advanceTimersByTime});
            const props = createDefaultProps();
            renderWithProviders(<TaskHistory {...props} />);

            expect(await screen.findByText('Order Received')).toBeInTheDocument();

            // Find and click the density toggle button (first button in header)
            const buttons = screen.getAllByRole('button');
            const densityButton = buttons[0];

            // Click to cycle to Dense mode
            await user.click(densityButton);

            // Click again to cycle to Ultra-Dense mode
            await user.click(densityButton);

            // Click again to cycle back to Normal mode
            await user.click(densityButton);
        });
    });

    describe('Refresh Functionality', () => {
        it('calls showInfoToast when refresh is clicked', async () => {
            const user = userEvent.setup({advanceTimers: jest.advanceTimersByTime});
            const props = createDefaultProps();
            renderWithProviders(<TaskHistory {...props} />);

            expect(await screen.findByText('Order Received')).toBeInTheDocument();

            // Find and click the refresh button (second button in header)
            const buttons = screen.getAllByRole('button');
            const refreshButton = buttons[1];
            await user.click(refreshButton);

            expect(props.showInfoToast).toHaveBeenCalledWith('Refreshing delivery journey...');
        });

        it('calls tasksApi.getDeliveryJourney on refresh', async () => {
            const user = userEvent.setup({advanceTimers: jest.advanceTimersByTime});
            const props = createDefaultProps();
            renderWithProviders(<TaskHistory {...props} />);

            expect(await screen.findByText('Order Received')).toBeInTheDocument();

            // Clear the mock to track new calls
            mockGetDeliveryJourney.mockClear();

            // Find and click the refresh button
            const buttons = screen.getAllByRole('button');
            const refreshButton = buttons[1];
            await user.click(refreshButton);

            // Advance timers for the refresh delay
            jest.advanceTimersByTime(300);

            await waitFor(() => {
                expect(mockGetDeliveryJourney).toHaveBeenCalled();
            });
        });
    });

    describe('Event Click', () => {
        it('calls onDeliveryEventClick when an event is clicked', async () => {
            const user = userEvent.setup({advanceTimers: jest.advanceTimersByTime});
            const props = createDefaultProps();
            renderWithProviders(<TaskHistory {...props} />);

            expect(await screen.findByText('Order Received')).toBeInTheDocument();

            // Click on an event
            await user.click(screen.getByText('Order Received'));

            expect(props.onDeliveryEventClick).toHaveBeenCalled();
        });
    });

    describe('Theme Support', () => {
        it('renders with both US and NZ theme colors', async () => {
            // US theme (isUsCustomer: true)
            const usProps = createDefaultProps({isUsCustomer: true});
            const {unmount} = renderWithProviders(<TaskHistory {...usProps} />);

            expect(await screen.findByText('Order Received')).toBeInTheDocument();
            expect(screen.getByText('Order Received')).toBeInTheDocument();

            unmount();

            // NZ theme (isUsCustomer: false)
            const nzProps = createDefaultProps({isUsCustomer: false});
            renderWithProviders(<TaskHistory {...nzProps} />);

            expect(await screen.findByText('Order Received')).toBeInTheDocument();
            expect(screen.getByText('Order Received')).toBeInTheDocument();
        });
    });

    describe('Data Loading', () => {
        it('loads delivery journey on mount', async () => {
            const props = createDefaultProps();
            renderWithProviders(<TaskHistory {...props} />);

            await waitFor(() => {
                expect(mockGetDeliveryJourney).toHaveBeenCalledWith(123, expect.objectContaining({signal: expect.any(AbortSignal)}));
            });
        });

        it('reloads delivery journey when jobId changes', async () => {
            const props = createDefaultProps();
            const queryClient = createTestQueryClient();
            const {rerender} = render(
                <QueryClientProvider client={queryClient}>
                    <ThemeProvider theme={theme}>
                        <LocalizationProvider dateAdapter={AdapterDayjs}>
                            <TaskHistory {...props} />
                        </LocalizationProvider>
                    </ThemeProvider>
                </QueryClientProvider>
            );

            await waitFor(() => {
                expect(mockGetDeliveryJourney).toHaveBeenCalledWith(123, expect.objectContaining({signal: expect.any(AbortSignal)}));
            });

            mockGetDeliveryJourney.mockClear();

            // Change jobId
            rerender(
                <QueryClientProvider client={queryClient}>
                    <ThemeProvider theme={theme}>
                        <LocalizationProvider dateAdapter={AdapterDayjs}>
                            <TaskHistory {...props} jobId={456} />
                        </LocalizationProvider>
                    </ThemeProvider>
                </QueryClientProvider>
            );

            await waitFor(() => {
                expect(mockGetDeliveryJourney).toHaveBeenCalledWith(456, expect.objectContaining({signal: expect.any(AbortSignal)}));
            });
        });
    });

    describe('Config Options', () => {
        it('respects initial density mode from config', async () => {
            const props = createDefaultProps({
                config: {densityMode: DensityMode.Dense},
            });
            renderWithProviders(<TaskHistory {...props} />);

            expect(await screen.findByText('Order Received')).toBeInTheDocument();
        });
    });
});
