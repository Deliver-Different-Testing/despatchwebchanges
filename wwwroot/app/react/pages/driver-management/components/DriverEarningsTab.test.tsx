import React from 'react';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {createTheme, ThemeProvider} from '@mui/material/styles';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {DriverEarningsTab} from './DriverEarningsTab';
import {CourierDailyEarningsPaginated} from '../../../interfaces';
import {useDriverEarnings} from '../../../hooks';

// Mock the hooks
jest.mock('../../../hooks', () => ({
    useDriverEarnings: jest.fn(),
}));

// Mock the API
jest.mock('../../../services/driverManagementApi', () => ({
    driverManagementApi: {
        exportDriverEarningsCsv: jest.fn(),
    },
}));

const mockUseDriverEarnings = useDriverEarnings as jest.MockedFunction<typeof useDriverEarnings>;

const theme = createTheme();

const createTestQueryClient = () =>
    new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
            },
        },
    });

const renderWithProviders = (showToast = jest.fn()) => {
    const queryClient = createTestQueryClient();
    return render(
        <QueryClientProvider client={queryClient}>
            <ThemeProvider theme={theme}>
                <DriverEarningsTab showToast={showToast}/>
            </ThemeProvider>
        </QueryClientProvider>
    );
};

const createMockData = (): CourierDailyEarningsPaginated => ({
    items: [
        {courierId: 1, name: 'Alice Brown', hoursLogged: 480, deliveries: 1, earnings: 100, hourlyRate: 12.5},
        {courierId: 2, name: 'Mike Carter', hoursLogged: 120, deliveries: 5, earnings: 50, hourlyRate: 25},
    ],
    total: 2,
    page: 1,
    pages: 1,
    totalEarningsToday: 150,
    averageHourlyRate: 18.75,
    totalActiveDrivers: 2,
    totalDeliveriesToday: 6,
});

const setupMocks = (data?: CourierDailyEarningsPaginated, isLoading = false) => {
    mockUseDriverEarnings.mockReturnValue({
        data: data ?? createMockData(),
        isLoading,
        isError: false,
        error: null,
        refetch: jest.fn(),
    } as any);
};

describe('DriverEarningsTab', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Column headers', () => {
        it('should render all column headers', () => {
            setupMocks();
            renderWithProviders();

            expect(screen.getByText('Name')).toBeInTheDocument();
            expect(screen.getByText('Hours Logged')).toBeInTheDocument();
            expect(screen.getByText('Deliveries')).toBeInTheDocument();
            expect(screen.getByText('Earnings')).toBeInTheDocument();
            expect(screen.getByText('Hourly Rate')).toBeInTheDocument();
        });
    });

    describe('Sort clicks', () => {
        it('should set orderBy to name when Name header is clicked', async () => {
            setupMocks();
            renderWithProviders();

            // Name is default active asc, clicking toggles to desc
            fireEvent.click(screen.getByText('Name'));

            await waitFor(() => {
                const lastCall = mockUseDriverEarnings.mock.calls[mockUseDriverEarnings.mock.calls.length - 1];
                expect(lastCall[0].orderBy).toBe('name');
                expect(lastCall[0].sortDescending).toBe(true);
            });
        });

        it('should set orderBy to hoursLogged when Hours Logged header is clicked', async () => {
            setupMocks();
            renderWithProviders();

            fireEvent.click(screen.getByText('Hours Logged'));

            await waitFor(() => {
                const lastCall = mockUseDriverEarnings.mock.calls[mockUseDriverEarnings.mock.calls.length - 1];
                expect(lastCall[0].orderBy).toBe('hoursLogged');
            });
        });

        it('should set orderBy to deliveries when Deliveries header is clicked', async () => {
            setupMocks();
            renderWithProviders();

            fireEvent.click(screen.getByText('Deliveries'));

            await waitFor(() => {
                const lastCall = mockUseDriverEarnings.mock.calls[mockUseDriverEarnings.mock.calls.length - 1];
                expect(lastCall[0].orderBy).toBe('deliveries');
            });
        });

        it('should set orderBy to earnings when Earnings header is clicked', async () => {
            setupMocks();
            renderWithProviders();

            fireEvent.click(screen.getByText('Earnings', {selector: 'span'}));

            await waitFor(() => {
                const lastCall = mockUseDriverEarnings.mock.calls[mockUseDriverEarnings.mock.calls.length - 1];
                expect(lastCall[0].orderBy).toBe('earnings');
            });
        });

        it('should set orderBy to hourlyRate when Hourly Rate header is clicked', async () => {
            setupMocks();
            renderWithProviders();

            fireEvent.click(screen.getByText('Hourly Rate'));

            await waitFor(() => {
                const lastCall = mockUseDriverEarnings.mock.calls[mockUseDriverEarnings.mock.calls.length - 1];
                expect(lastCall[0].orderBy).toBe('hourlyRate');
            });
        });
    });

    describe('Direction toggle', () => {
        it('should toggle direction: first click desc (on active), second click asc, third click desc', async () => {
            setupMocks();
            renderWithProviders();

            // Name is default active asc, clicking toggles to desc
            fireEvent.click(screen.getByText('Name'));

            await waitFor(() => {
                const lastCall = mockUseDriverEarnings.mock.calls[mockUseDriverEarnings.mock.calls.length - 1];
                expect(lastCall[0].orderBy).toBe('name');
                expect(lastCall[0].sortDescending).toBe(true);
            });

            // Second click → asc
            fireEvent.click(screen.getByText('Name'));

            await waitFor(() => {
                const lastCall = mockUseDriverEarnings.mock.calls[mockUseDriverEarnings.mock.calls.length - 1];
                expect(lastCall[0].orderBy).toBe('name');
                expect(lastCall[0].sortDescending).toBe(false);
            });

            // Third click → desc
            fireEvent.click(screen.getByText('Name'));

            await waitFor(() => {
                const lastCall = mockUseDriverEarnings.mock.calls[mockUseDriverEarnings.mock.calls.length - 1];
                expect(lastCall[0].orderBy).toBe('name');
                expect(lastCall[0].sortDescending).toBe(true);
            });
        });
    });

    describe('Query state', () => {
        it('should reset page to 1 when sort changes', async () => {
            setupMocks();
            renderWithProviders();

            fireEvent.click(screen.getByText('Hours Logged'));

            await waitFor(() => {
                const lastCall = mockUseDriverEarnings.mock.calls[mockUseDriverEarnings.mock.calls.length - 1];
                expect(lastCall[0].page).toBe(1);
            });
        });

        it('should pass sortDescending correctly', async () => {
            setupMocks();
            renderWithProviders();

            // Name is active asc → click toggles to desc
            fireEvent.click(screen.getByText('Name'));

            await waitFor(() => {
                const lastCall = mockUseDriverEarnings.mock.calls[mockUseDriverEarnings.mock.calls.length - 1];
                expect(lastCall[0].sortDescending).toBe(true);
            });
        });
    });

    describe('Initial state', () => {
        it('should have name as the default sort column with asc direction', () => {
            setupMocks();
            renderWithProviders();

            const firstCall = mockUseDriverEarnings.mock.calls[0];
            expect(firstCall[0].orderBy).toBe('name');
            expect(firstCall[0].sortDescending).toBe(false);
        });
    });

    describe('Stats display', () => {
        it('should display totalEarningsToday', () => {
            setupMocks();
            renderWithProviders();

            expect(screen.getByText('$150.00')).toBeInTheDocument();
            expect(screen.getByText('Total Earnings Today')).toBeInTheDocument();
        });

        it('should display averageHourlyRate', () => {
            setupMocks();
            renderWithProviders();

            expect(screen.getByText('$18.75')).toBeInTheDocument();
            expect(screen.getByText('Average Hourly Rate')).toBeInTheDocument();
        });

        it('should display totalActiveDrivers', () => {
            setupMocks();
            renderWithProviders();

            expect(screen.getByText('2')).toBeInTheDocument();
            expect(screen.getByText('Active Drivers')).toBeInTheDocument();
        });

        it('should display totalDeliveriesToday', () => {
            setupMocks();
            renderWithProviders();

            expect(screen.getByText('6')).toBeInTheDocument();
            expect(screen.getByText('Total Deliveries')).toBeInTheDocument();
        });
    });

    describe('Loading state', () => {
        it('should show loading indicator when isLoading is true', () => {
            setupMocks(undefined, true);
            renderWithProviders();

            expect(screen.getByText('Loading...')).toBeInTheDocument();
        });
    });

    describe('Empty state', () => {
        it('should show empty message when no items', () => {
            setupMocks({
                items: [], total: 0, page: 1, pages: 0,
                totalEarningsToday: 0, averageHourlyRate: 0,
                totalActiveDrivers: 0, totalDeliveriesToday: 0,
            });
            renderWithProviders();

            expect(screen.getByText('No Earnings Data')).toBeInTheDocument();
            expect(screen.getByText('No earnings data matches your criteria.')).toBeInTheDocument();
        });
    });
});
