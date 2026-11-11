import type {MockedFunction} from 'vitest';
import React from 'react';
import {fireEvent, render, screen} from '@testing-library/react';
import {MantineTestProvider} from '../../../test/utils';
import {createTestQueryClient} from '../../../test/utils';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {DriverEarningsTab} from './DriverEarningsTab';
import {CourierDailyEarningsPaginated} from '../../../types';
import {useDriverEarnings} from '../../../hooks/useDriverManagementApi';

// Mock the hooks
vi.mock('../../../hooks/useDriverManagementApi', () => ({
    useDriverEarnings: vi.fn(),
}));

// Mock the API
vi.mock('../../../api/driverManagementApi', () => ({
    driverManagementApi: {
        exportDriverEarningsCsv: vi.fn(),
    },
}));

const mockUseDriverEarnings = useDriverEarnings as MockedFunction<typeof useDriverEarnings>;


const renderWithProviders = (showToast = vi.fn()) => {
    const queryClient = createTestQueryClient();
    return render(
        <QueryClientProvider client={queryClient}>
            <MantineTestProvider>
                <DriverEarningsTab showToast={showToast}/>
            </MantineTestProvider>
        </QueryClientProvider>
    );
};

const createMockData = (): CourierDailyEarningsPaginated => ({
    items: [
        {courierId: 1, name: 'Alice Brown', minutesLogged: 450, deliveries: 1, earnings: 100, hourlyRate: 12.5},
        {courierId: 2, name: 'Mike Carter', minutesLogged: 0, deliveries: 5, earnings: 50, hourlyRate: 25},
    ],
    total: 2,
    page: 1,
    pages: 1,
    totalEarningsToday: 150,
    averageHourlyRate: 18.75,
    totalActiveDrivers: 2,
    totalDeliveriesToday: 6,
});

const refetch = vi.fn();

const setupMocks = (data?: CourierDailyEarningsPaginated, isLoading = false, isError = false) => {
    mockUseDriverEarnings.mockReturnValue({
        data: isError ? undefined : data ?? createMockData(),
        isLoading,
        isError,
        error: null,
        refetch,
    } as any);
};

describe('DriverEarningsTab', () => {
    it('should render column headers, stats, and have correct initial sort state', () => {
        setupMocks();
        renderWithProviders();

        // Column headers
        expect(screen.getByText('Name')).toBeInTheDocument();
        expect(screen.getByText('Hours')).toBeInTheDocument();
        expect(screen.getByText('Deliveries')).toBeInTheDocument();
        expect(screen.getByText('Earnings')).toBeInTheDocument();
        expect(screen.getByText('Hourly rate')).toBeInTheDocument();

        // minutesLogged renders as hours and minutes
        expect(screen.getByText('7h 30m')).toBeInTheDocument();
        expect(screen.getByText('0m')).toBeInTheDocument();

        // Stats: totalEarningsToday
        expect(screen.getByText('$150.00')).toBeInTheDocument();
        expect(screen.getByText('Total earnings today')).toBeInTheDocument();

        // Stats: averageHourlyRate
        expect(screen.getByText('$18.75')).toBeInTheDocument();
        expect(screen.getByText('Average hourly rate')).toBeInTheDocument();

        // Stats: totalActiveDrivers
        expect(screen.getByText('2')).toBeInTheDocument();
        expect(screen.getByText('Active drivers')).toBeInTheDocument();

        // Stats: totalDeliveriesToday
        expect(screen.getByText('6')).toBeInTheDocument();
        expect(screen.getByText('Total deliveries')).toBeInTheDocument();

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

        // Click Hours logged
        fireEvent.click(screen.getByText('Hours'));
        expect(lastCall().orderBy).toBe('minutesLogged');

        // Click Deliveries
        fireEvent.click(screen.getByText('Deliveries'));
        expect(lastCall().orderBy).toBe('deliveries');

        // Click Earnings
        fireEvent.click(screen.getByText('Earnings', {selector: 'span'}));
        expect(lastCall().orderBy).toBe('earnings');

        // Click Hourly rate
        fireEvent.click(screen.getByText('Hourly rate'));
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
        fireEvent.click(screen.getByText('Hours'));
        expect(lastCall().page).toBe(1);

        // Hours logged is now active asc → click toggles to desc, verify sortDescending
        fireEvent.click(screen.getByText('Hours'));
        expect(lastCall().sortDescending).toBe(true);
    });

    it('should show loading indicator when isLoading is true', () => {
        setupMocks(undefined, true);
        renderWithProviders();

        expect(screen.getByText('Loading…')).toBeInTheDocument();
    });

    it('should show empty message when no items', () => {
        setupMocks({
            items: [], total: 0, page: 1, pages: 0,
            totalEarningsToday: 0, averageHourlyRate: 0,
            totalActiveDrivers: 0, totalDeliveriesToday: 0,
        });
        renderWithProviders();

        expect(screen.getByText('No earnings data')).toBeInTheDocument();
        expect(screen.getByText('No driver earnings recorded yet today.')).toBeInTheDocument();
    });

    it('should show a retryable error state when the load fails', () => {
        setupMocks(undefined, false, true);
        renderWithProviders();

        expect(screen.getByText("Couldn't load earnings")).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', {name: 'Try again'}));
        expect(refetch).toHaveBeenCalled();
    });
});
