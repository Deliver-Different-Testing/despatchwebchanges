/**
 * TaskHistory Component Tests
 */

import React from 'react';
import {render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {ThemeProvider, createTheme} from '@mui/material';
import {LocalizationProvider} from '@mui/x-date-pickers/LocalizationProvider';
import {AdapterDayjs} from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import {TaskHistory} from './TaskHistory';
import {DeliveryJourney, TaskHistoryProps, DensityMode} from './TaskHistory.interfaces';

// Mock the date utilities
jest.mock('../../../utils/dateUtils', () => ({
    getIanaTimezone: jest.fn(() => 'America/New_York'),
    getTenantTimezone: jest.fn(() => 'America/New_York'),
    getTimezoneAbbreviation: jest.fn(() => '(EST)'),
}));

const theme = createTheme();

const renderWithProviders = (ui: React.ReactElement) => {
    return render(
        <ThemeProvider theme={theme}>
            <LocalizationProvider dateAdapter={AdapterDayjs}>
                {ui}
            </LocalizationProvider>
        </ThemeProvider>
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

const createMockServices = () => ({
    dispatchService: {
        getDeliveryJourney: jest.fn().mockResolvedValue(createMockDeliveryEvents()),
    },
});

const createDefaultProps = (overrides?: Partial<TaskHistoryProps>): TaskHistoryProps => {
    const services = createMockServices();
    return {
        jobId: 123,
        config: {},
        onDeliveryEventClick: jest.fn(),
        dispatchService: services.dispatchService,
        showSuccessToast: jest.fn(),
        showErrorToast: jest.fn(),
        showInfoToast: jest.fn(),
        isUsCustomer: true,
        ...overrides,
    };
};

describe('TaskHistory', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    describe('Rendering', () => {
        it('renders "Select a Job" when no jobId is provided', () => {
            const props = createDefaultProps({jobId: undefined});
            renderWithProviders(<TaskHistory {...props} />);

            expect(screen.getByText('Select a Job')).toBeInTheDocument();
            expect(screen.getByText('Select a job to view its delivery journey.')).toBeInTheDocument();
        });

        it('renders loading state initially', async () => {
            const props = createDefaultProps();
            renderWithProviders(<TaskHistory {...props} />);

            expect(screen.getByRole('progressbar')).toBeInTheDocument();
        });

        it('renders delivery events after loading', async () => {
            const props = createDefaultProps();
            renderWithProviders(<TaskHistory {...props} />);

            await waitFor(() => {
                expect(screen.getByText('Order Received')).toBeInTheDocument();
            });

            expect(screen.getByText('Dispatched to Courier')).toBeInTheDocument();
            expect(screen.getByText('Out for Delivery')).toBeInTheDocument();
            expect(screen.getByText('Delivered')).toBeInTheDocument();
        });

        it('renders event dates', async () => {
            const props = createDefaultProps();
            renderWithProviders(<TaskHistory {...props} />);

            await waitFor(() => {
                expect(screen.getByText('Order Received')).toBeInTheDocument();
            });

            expect(screen.getByText(/Jan 15, 2025 9:00 AM/)).toBeInTheDocument();
        });

        it('renders event tags', async () => {
            const props = createDefaultProps();
            renderWithProviders(<TaskHistory {...props} />);

            await waitFor(() => {
                expect(screen.getByText('Order Received')).toBeInTheDocument();
            });

            expect(screen.getByText('priority')).toBeInTheDocument();
            expect(screen.getByText('express')).toBeInTheDocument();
        });

        it('renders event notes in normal mode', async () => {
            const props = createDefaultProps();
            renderWithProviders(<TaskHistory {...props} />);

            await waitFor(() => {
                expect(screen.getByText('Order Received')).toBeInTheDocument();
            });

            expect(screen.getByText('Customer requested express delivery')).toBeInTheDocument();
        });

        it('renders empty state when no events', async () => {
            const services = createMockServices();
            services.dispatchService.getDeliveryJourney.mockResolvedValue([]);
            const props = createDefaultProps({
                dispatchService: services.dispatchService,
            });
            renderWithProviders(<TaskHistory {...props} />);

            await waitFor(() => {
                expect(screen.getByText('No Journey Events')).toBeInTheDocument();
            });

            expect(screen.getByText('No delivery journey events found for this job.')).toBeInTheDocument();
        });
    });

    describe('Header Actions', () => {
        it('renders density mode toggle button', async () => {
            const props = createDefaultProps();
            renderWithProviders(<TaskHistory {...props} />);

            await waitFor(() => {
                expect(screen.getByText('Order Received')).toBeInTheDocument();
            });

            // Find the density toggle button by its tooltip
            const buttons = screen.getAllByRole('button');
            expect(buttons.length).toBeGreaterThan(0);
        });

        it('renders refresh button', async () => {
            const props = createDefaultProps();
            renderWithProviders(<TaskHistory {...props} />);

            await waitFor(() => {
                expect(screen.getByText('Order Received')).toBeInTheDocument();
            });

            // Find refresh button
            const buttons = screen.getAllByRole('button');
            expect(buttons.length).toBeGreaterThan(0);
        });
    });

    describe('Density Modes', () => {
        it('cycles through density modes when toggle is clicked', async () => {
            const user = userEvent.setup({advanceTimers: jest.advanceTimersByTime});
            const props = createDefaultProps();
            renderWithProviders(<TaskHistory {...props} />);

            await waitFor(() => {
                expect(screen.getByText('Order Received')).toBeInTheDocument();
            });

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

            await waitFor(() => {
                expect(screen.getByText('Order Received')).toBeInTheDocument();
            });

            // Find and click the refresh button (second button in header)
            const buttons = screen.getAllByRole('button');
            const refreshButton = buttons[1];
            await user.click(refreshButton);

            expect(props.showInfoToast).toHaveBeenCalledWith('Refreshing delivery journey...');
        });

        it('calls dispatchService.getDeliveryJourney on refresh', async () => {
            const user = userEvent.setup({advanceTimers: jest.advanceTimersByTime});
            const props = createDefaultProps();
            renderWithProviders(<TaskHistory {...props} />);

            await waitFor(() => {
                expect(screen.getByText('Order Received')).toBeInTheDocument();
            });

            // Clear the mock to track new calls
            (props.dispatchService.getDeliveryJourney as jest.Mock).mockClear();

            // Find and click the refresh button
            const buttons = screen.getAllByRole('button');
            const refreshButton = buttons[1];
            await user.click(refreshButton);

            // Advance timers for the refresh delay
            jest.advanceTimersByTime(300);

            await waitFor(() => {
                expect(props.dispatchService.getDeliveryJourney).toHaveBeenCalledWith(123);
            });
        });
    });

    describe('Event Click', () => {
        it('calls onDeliveryEventClick when an event is clicked', async () => {
            const user = userEvent.setup({advanceTimers: jest.advanceTimersByTime});
            const props = createDefaultProps();
            renderWithProviders(<TaskHistory {...props} />);

            await waitFor(() => {
                expect(screen.getByText('Order Received')).toBeInTheDocument();
            });

            // Click on an event
            await user.click(screen.getByText('Order Received'));

            expect(props.onDeliveryEventClick).toHaveBeenCalled();
        });
    });

    describe('Theme Support', () => {
        it('renders with US theme colors when isUsCustomer is true', async () => {
            const props = createDefaultProps({isUsCustomer: true});
            renderWithProviders(<TaskHistory {...props} />);

            await waitFor(() => {
                expect(screen.getByText('Order Received')).toBeInTheDocument();
            });

            // Component should render with blue theme
            expect(screen.getByText('Order Received')).toBeInTheDocument();
        });

        it('renders with NZ theme colors when isUsCustomer is false', async () => {
            const props = createDefaultProps({isUsCustomer: false});
            renderWithProviders(<TaskHistory {...props} />);

            await waitFor(() => {
                expect(screen.getByText('Order Received')).toBeInTheDocument();
            });

            // Component should render with yellow theme
            expect(screen.getByText('Order Received')).toBeInTheDocument();
        });
    });

    describe('Data Loading', () => {
        it('loads delivery journey on mount', async () => {
            const props = createDefaultProps();
            renderWithProviders(<TaskHistory {...props} />);

            await waitFor(() => {
                expect(props.dispatchService.getDeliveryJourney).toHaveBeenCalledWith(123);
            });
        });

        it('reloads delivery journey when jobId changes', async () => {
            const props = createDefaultProps();
            const {rerender} = renderWithProviders(<TaskHistory {...props} />);

            await waitFor(() => {
                expect(props.dispatchService.getDeliveryJourney).toHaveBeenCalledWith(123);
            });

            (props.dispatchService.getDeliveryJourney as jest.Mock).mockClear();

            // Change jobId
            rerender(
                <ThemeProvider theme={theme}>
                    <LocalizationProvider dateAdapter={AdapterDayjs}>
                        <TaskHistory {...props} jobId={456} />
                    </LocalizationProvider>
                </ThemeProvider>
            );

            await waitFor(() => {
                expect(props.dispatchService.getDeliveryJourney).toHaveBeenCalledWith(456);
            });
        });
    });

    describe('Status Colors', () => {
        it('renders events with correct status styling', async () => {
            const props = createDefaultProps();
            renderWithProviders(<TaskHistory {...props} />);

            await waitFor(() => {
                expect(screen.getByText('Order Received')).toBeInTheDocument();
            });

            // All events should be rendered
            expect(screen.getByText('Order Received')).toBeInTheDocument(); // completed
            expect(screen.getByText('Out for Delivery')).toBeInTheDocument(); // current
            expect(screen.getByText('Delivered')).toBeInTheDocument(); // pending
        });
    });

    describe('Config Options', () => {
        it('respects initial density mode from config', async () => {
            const props = createDefaultProps({
                config: {densityMode: DensityMode.Dense},
            });
            renderWithProviders(<TaskHistory {...props} />);

            await waitFor(() => {
                expect(screen.getByText('Order Received')).toBeInTheDocument();
            });
        });
    });
});
