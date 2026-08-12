/**
 * Optimised: read-only tests consolidated to reduce render count.
 */
import React from 'react';
import {fireEvent, render, screen} from '@testing-library/react';
import {MantineTestProvider} from '../../../__testUtils__';
import {createTheme, ThemeProvider} from '@mui/material/styles';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {DriverEarningsTab} from './DriverEarningsTab';
import {CourierDailyEarningsPaginated} from '../../../interfaces';
import {useDriverEarnings} from '../../../hooks/useDriverManagementApi';

// Mock the hooks
jest.mock('../../../hooks/useDriverManagementApi', () => ({
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
            <MantineTestProvider><ThemeProvider theme={theme}>
                <DriverEarningsTab showToast={showToast}/>
            </ThemeProvider></MantineTestProvider>
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
    it('should render column headers, stats, and have correct initial sort state', () => {
        setupMocks();
        renderWithProviders();

        // Column headers
        expect(screen.getByText('Name')).toBeInTheDocument();
        expect(screen.getByText('Hours Logged')).toBeInTheDocument();
        expect(screen.getByText('Deliveries')).toBeInTheDocument();
        expect(screen.getByText('Earnings')).toBeInTheDocument();
        expect(screen.getByText('Hourly Rate')).toBeInTheDocument();

        // Stats: totalEarningsToday
        expect(screen.getByText('$150.00')).toBeInTheDocument();
        expect(screen.getByText('Total Earnings Today')).toBeInTheDocument();

        // Stats: averageHourlyRate
        expect(screen.getByText('$18.75')).toBeInTheDocument();
        expect(screen.getByText('Average Hourly Rate')).toBeInTheDocument();

        // Stats: totalActiveDrivers
        expect(screen.getByText('2')).toBeInTheDocument();
        expect(screen.getByText('Active Drivers')).toBeInTheDocument();

        // Stats: totalDeliveriesToday
        expect(screen.getByText('6')).toBeInTheDocument();
        expect(screen.getByText('Total Deliveries')).toBeInTheDocument();

        // Initial state: name as default sort column with asc direction
        const firstCall = mockUseDriverEarnings.mock.calls[0];
        expect(firstCall[0].orderBy).toBe('name');
        expect(firstCall[0].sortDescending).toBe(false);
    });

    it('should set orderBy for each sortable column header click', async () => {
        setupMocks();
        renderWithProviders();

        const lastCall = () =>
            mockUseDriverEarnings.mock.calls[mockUseDriverEarnings.mock.calls.length - 1][0];

        // Click Name (default active asc, toggles to desc)
        fireEvent.click(screen.getByText('Name'));
        expect(lastCall().orderBy).toBe('name');
        expect(lastCall().sortDescending).toBe(true);

        // Click Hours Logged
        fireEvent.click(screen.getByText('Hours Logged'));
        expect(lastCall().orderBy).toBe('hoursLogged');

        // Click Deliveries
        fireEvent.click(screen.getByText('Deliveries'));
        expect(lastCall().orderBy).toBe('deliveries');

        // Click Earnings
        fireEvent.click(screen.getByText('Earnings', {selector: 'span'}));
        expect(lastCall().orderBy).toBe('earnings');

        // Click Hourly Rate
        fireEvent.click(screen.getByText('Hourly Rate'));
        expect(lastCall().orderBy).toBe('hourlyRate');
    });

    it('should toggle direction: first click desc (on active), second click asc, third click desc', async () => {
        setupMocks();
        renderWithProviders();

        const lastCall = () =>
            mockUseDriverEarnings.mock.calls[mockUseDriverEarnings.mock.calls.length - 1][0];

        // Name is default active asc, clicking toggles to desc
        fireEvent.click(screen.getByText('Name'));
        expect(lastCall().orderBy).toBe('name');
        expect(lastCall().sortDescending).toBe(true);

        // Second click → asc
        fireEvent.click(screen.getByText('Name'));
        expect(lastCall().orderBy).toBe('name');
        expect(lastCall().sortDescending).toBe(false);

        // Third click → desc
        fireEvent.click(screen.getByText('Name'));
        expect(lastCall().orderBy).toBe('name');
        expect(lastCall().sortDescending).toBe(true);
    });

    it('should reset page to 1 when sort changes and pass sortDescending correctly', async () => {
        setupMocks();
        renderWithProviders();

        const lastCall = () =>
            mockUseDriverEarnings.mock.calls[mockUseDriverEarnings.mock.calls.length - 1][0];

        // Clicking a different column should reset page to 1
        fireEvent.click(screen.getByText('Hours Logged'));
        expect(lastCall().page).toBe(1);

        // Hours Logged is now active asc → click toggles to desc, verify sortDescending
        fireEvent.click(screen.getByText('Hours Logged'));
        expect(lastCall().sortDescending).toBe(true);
    });

    it('should show loading indicator when isLoading is true', () => {
        setupMocks(undefined, true);
        renderWithProviders();

        expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

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
