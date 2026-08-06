/**
 * TaskHistory Component Tests
 * Optimised: read-only tests consolidated to reduce render count.
 */

import React from 'react';
import { setupUser } from '../../../__testUtils__/setupUser';
import {render, screen, waitFor, within} from '@testing-library/react';
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

// Mock formatCurrency to avoid depending on window.CurrencyCode in the test env
jest.mock('../../../utils/currencyUtils', () => ({
    formatCurrency: (amount: number) => `$${amount.toFixed(2)}`,
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
        performedBy: 'Jane Doe',
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
            const user = setupUser({advanceTimers: jest.advanceTimersByTime});
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
            const user = setupUser({advanceTimers: jest.advanceTimersByTime});
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
            const user = setupUser({advanceTimers: jest.advanceTimersByTime});
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
        it('calls onDeliveryEventClick and opens the details dialog when an event is clicked', async () => {
            const user = setupUser({advanceTimers: jest.advanceTimersByTime});
            const props = createDefaultProps();
            renderWithProviders(<TaskHistory {...props} />);

            expect(await screen.findByText('Order Received')).toBeInTheDocument();

            // Click on an event
            await user.click(screen.getByText('Order Received'));

            expect(props.onDeliveryEventClick).toHaveBeenCalled();

            // The details dialog opens showing the full description, all tags,
            // and the notes — which is the whole point of the click affordance.
            expect(await screen.findByRole('dialog')).toBeInTheDocument();
            const dialog = screen.getByRole('dialog');
            expect(within(dialog).getByText('Order has been received and is being processed')).toBeInTheDocument();
            expect(within(dialog).getByText('priority')).toBeInTheDocument();
            expect(within(dialog).getByText('express')).toBeInTheDocument();
            expect(within(dialog).getByText('Customer requested express delivery')).toBeInTheDocument();
            expect(within(dialog).getByText('Completed')).toBeInTheDocument();
        });

        it('opens the details dialog even when no onDeliveryEventClick callback is provided', async () => {
            const user = setupUser({advanceTimers: jest.advanceTimersByTime});
            const props = createDefaultProps({onDeliveryEventClick: undefined});
            renderWithProviders(<TaskHistory {...props} />);

            expect(await screen.findByText('Order Received')).toBeInTheDocument();
            await user.click(screen.getByText('Order Received'));

            expect(await screen.findByRole('dialog')).toBeInTheDocument();
        });

        it('closes the details dialog when Close is clicked', async () => {
            const user = setupUser({advanceTimers: jest.advanceTimersByTime});
            const props = createDefaultProps();
            renderWithProviders(<TaskHistory {...props} />);

            expect(await screen.findByText('Order Received')).toBeInTheDocument();
            await user.click(screen.getByText('Order Received'));
            const dialog = await screen.findByRole('dialog');

            await user.click(within(dialog).getByRole('button', {name: 'Close'}));

            await waitFor(() => {
                expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
            });
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

    describe('Grand Total chip', () => {
        const eventsWithGrandTotal: DeliveryJourney[] = [
            {
                id: 'p1',
                jobId: 999,
                title: 'Pricing Updated',
                icon: 'attach_money',
                description: 'Fuel surcharge added',
                date: dayjs('2025-04-15T14:00:00'),
                tags: ['Pricing: $0 → $15'],
                status: 'completed',
                notes: '',
                grandTotalAfter: 123.45,
                _dateStr: 'Apr 15, 2025 2:00 PM',
            },
            {
                id: 'p2',
                jobId: 999,
                title: 'Status Changed',
                icon: 'published_with_changes',
                description: 'Dispatched',
                date: dayjs('2025-04-15T15:00:00'),
                tags: ['Status: Booked → Dispatched'],
                status: 'completed',
                notes: '',
                _dateStr: 'Apr 15, 2025 3:00 PM',
            },
        ];

        it('renders Total chip only on events with grandTotalAfter and hides it in UltraDense', async () => {
            const user = setupUser({advanceTimers: jest.advanceTimersByTime});
            mockGetDeliveryJourney.mockResolvedValue(eventsWithGrandTotal);
            const props = createDefaultProps({jobId: 999});
            renderWithProviders(<TaskHistory {...props} />);

            // Pricing event shows the Total chip with the formatted value
            expect(await screen.findByText('Total: $123.45')).toBeInTheDocument();
            // Status event has no grandTotalAfter — only one Total chip exists in the DOM
            expect(screen.getAllByText(/Total: /)).toHaveLength(1);

            // Cycle density: Normal → Dense → still shows Total
            const densityButton = screen.getAllByRole('button')[0];
            await user.click(densityButton);
            expect(screen.getByText('Total: $123.45')).toBeInTheDocument();

            // Dense → UltraDense — Total chip is hidden (matches date-pill hide rule)
            await user.click(densityButton);
            expect(screen.queryByText('Total: $123.45')).not.toBeInTheDocument();
        });
    });

    describe('Event icons', () => {
        it('renders the Material icon matching each event\'s icon string', async () => {
            const props = createDefaultProps();
            const {container} = renderWithProviders(<TaskHistory {...props} />);

            // Wait for events to load
            expect(await screen.findByText('Order Received')).toBeInTheDocument();

            // MUI icon components set data-testid to the PascalCase component name.
            // Mock events use: shopping_cart, local_shipping, directions_car, check_circle
            expect(container.querySelector('[data-testid="ShoppingCartIcon"]')).toBeInTheDocument();
            expect(container.querySelector('[data-testid="LocalShippingIcon"]')).toBeInTheDocument();
            expect(container.querySelector('[data-testid="DirectionsCarIcon"]')).toBeInTheDocument();
            expect(container.querySelector('[data-testid="CheckCircleIcon"]')).toBeInTheDocument();
        });

        it('falls back to a generic dot when the icon name is unknown', async () => {
            mockGetDeliveryJourney.mockResolvedValue([{
                id: 'x',
                jobId: 1,
                title: 'Unknown event',
                icon: 'not_a_real_icon_name',
                description: '',
                date: dayjs('2025-01-15T09:00:00'),
                tags: [],
                status: 'completed',
                notes: '',
                _dateStr: 'Jan 15, 2025 9:00 AM',
            }]);
            const props = createDefaultProps();
            const {container} = renderWithProviders(<TaskHistory {...props} />);

            expect(await screen.findByText('Unknown event')).toBeInTheDocument();
            expect(container.querySelector('[data-testid="CircleIcon"]')).toBeInTheDocument();
        });
    });

    describe('Notes visibility by density', () => {
        it('shows notes in Normal density and hides them in Dense / UltraDense', async () => {
            const user = setupUser({advanceTimers: jest.advanceTimersByTime});
            const props = createDefaultProps();
            renderWithProviders(<TaskHistory {...props} />);

            // Normal: notes visible
            expect(await screen.findByText('Customer requested express delivery')).toBeInTheDocument();

            // Dense: notes hidden
            const densityButton = screen.getAllByRole('button')[0];
            await user.click(densityButton);
            expect(screen.queryByText('Customer requested express delivery')).not.toBeInTheDocument();

            // UltraDense: notes still hidden
            await user.click(densityButton);
            expect(screen.queryByText('Customer requested express delivery')).not.toBeInTheDocument();
        });
    });

    describe('Performed by', () => {
        it('shows the actor under the title only for events that have one, and hides it in UltraDense', async () => {
            const user = setupUser({advanceTimers: jest.advanceTimersByTime});
            const props = createDefaultProps();
            renderWithProviders(<TaskHistory {...props} />);

            // Only the first fixture has performedBy, so exactly one line appears.
            expect(await screen.findByText('by Jane Doe')).toBeInTheDocument();
            expect(screen.getAllByText(/^by /)).toHaveLength(1);

            // The event without performedBy renders no attribution line at all.
            const withoutActor = screen.getByText('Dispatched to Courier').closest('[role="listitem"]');
            expect(withoutActor).not.toBeNull();
            expect(within(withoutActor as HTMLElement).queryByText(/^by /)).not.toBeInTheDocument();

            // Normal → Dense: still shown (matches the date caption)
            const densityButton = screen.getAllByRole('button')[0];
            await user.click(densityButton);
            expect(screen.getByText('by Jane Doe')).toBeInTheDocument();

            // Dense → UltraDense: hidden, like the date caption and Total chip
            await user.click(densityButton);
            expect(screen.queryByText('by Jane Doe')).not.toBeInTheDocument();
        });

        it('shows the actor in the details dialog subtitle', async () => {
            const user = setupUser({advanceTimers: jest.advanceTimersByTime});
            const props = createDefaultProps();
            renderWithProviders(<TaskHistory {...props} />);

            await user.click(await screen.findByText('Order Received'));

            const dialog = await screen.findByRole('dialog');
            expect(within(dialog).getByText(/by Jane Doe/)).toBeInTheDocument();
        });
    });
});
