import type {MockedFunction} from 'vitest';
import React from 'react';
import {fireEvent, render, screen} from '@testing-library/react';
import {MantineTestProvider} from '../../../test/utils';
import {createTestQueryClient} from '../../../test/utils';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {TodayActiveTab} from './TodayActiveTab';
import {TodayActiveDriverPaginated} from '../../../types';
import {useTodayActiveDrivers} from '../../../hooks/useDriverManagementApi';
import {itShowsLoadingIndicator, itShowsRetryableErrorState} from './driverTabLoadStates.testHelpers';

vi.mock('../../../hooks/useDriverManagementApi', () => ({
    useTodayActiveDrivers: vi.fn(),
}));

vi.mock('../../../api/driverManagementApi', () => ({
    driverManagementApi: {
        exportTodayActiveDriversCsv: vi.fn(),
    },
}));

const mockUseTodayActiveDrivers = useTodayActiveDrivers as MockedFunction<typeof useTodayActiveDrivers>;

const renderWithProviders = (showToast = vi.fn(), fleetOptions = [{id: 1, text: 'Fleet A'}]) => {
    const queryClient = createTestQueryClient();
    return render(
        <QueryClientProvider client={queryClient}>
            <MantineTestProvider>
                <TodayActiveTab showToast={showToast} fleetOptions={fleetOptions} />
            </MantineTestProvider>
        </QueryClientProvider>
    );
};

const createMockData = (): TodayActiveDriverPaginated => ({
    items: [
        {courierId: 1, code: 'JS001', name: 'John Smith', fleet: 'Fleet A', loginTime: '2025-01-15T08:00:00Z', logoutTime: undefined, duration: '4h 30m', deliveries: 12, status: 'Active'},
        {courierId: 2, code: 'JD002', name: 'Jane Doe', fleet: 'Fleet B', loginTime: '2025-01-15T09:00:00Z', logoutTime: '2025-01-15T13:00:00Z', duration: '4h 0m', deliveries: 8, status: 'Inactive'},
    ],
    total: 2,
    page: 1,
    pages: 1,
    totalActiveDrivers: 1,
    totalDriversActiveToday: 2,
    averageSessionTime: 255,
});

const refetch = vi.fn();

const setupMocks = (data?: TodayActiveDriverPaginated, isLoading = false, isError = false) => {
    mockUseTodayActiveDrivers.mockReturnValue({
        data: isError ? undefined : data ?? createMockData(),
        isLoading,
        isError,
        error: null,
        refetch,
    } as any);
};

describe('TodayActiveTab', () => {
    it('renders all column headers and the stats summary', () => {
        setupMocks();
        renderWithProviders();

        expect(screen.getByText('Code')).toBeInTheDocument();
        expect(screen.getByText('Name')).toBeInTheDocument();
        // 'Fleet' also appears as filter label
        expect(screen.getAllByText('Fleet').length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText('Login time')).toBeInTheDocument();
        expect(screen.getByText('Logout time')).toBeInTheDocument();
        expect(screen.getByText('Duration')).toBeInTheDocument();
        expect(screen.getByText('Deliveries')).toBeInTheDocument();
        // 'Status' also appears as filter label
        expect(screen.getAllByText('Status').length).toBeGreaterThanOrEqual(1);

        expect(screen.getByText('Currently online')).toBeInTheDocument();
        expect(screen.getByText('Total today')).toBeInTheDocument();
        expect(screen.getByText('Average session')).toBeInTheDocument();
        expect(screen.getByText('4h 15m')).toBeInTheDocument();
        expect(screen.queryByText('On break')).not.toBeInTheDocument();
    });

    it('sends contract status values, no location, and contract sort keys', () => {
        setupMocks();
        renderWithProviders();

        const lastCall = () => mockUseTodayActiveDrivers.mock.calls[mockUseTodayActiveDrivers.mock.calls.length - 1];
        expect(lastCall()[1]).toEqual({status: 'all', fleet: 0});

        for (const [label, key] of [['Login time', 'loginTime'], ['Logout time', 'logoutTime'], ['Duration', 'duration'], ['Deliveries', 'deliveries'], ['Fleet', 'fleet']] as const) {
            fireEvent.click(screen.getByText(label, {selector: 'span'}));
            expect(lastCall()[0].orderBy).toBe(key);
        }
    });

    it('rounds the average session before splitting hours and minutes', () => {
        setupMocks({...createMockData(), averageSessionTime: 119.7});
        renderWithProviders();

        expect(screen.getByText('2h 0m')).toBeInTheDocument();
    });

    it('updates orderBy and direction when sortable headers are clicked', () => {
        setupMocks();
        renderWithProviders();

        const lastCall = () =>
            mockUseTodayActiveDrivers.mock.calls[mockUseTodayActiveDrivers.mock.calls.length - 1][0];

        fireEvent.click(screen.getByText('Name'));
        expect(lastCall().orderBy).toBe('name');
        expect(lastCall().sortDescending).toBe(true);

        fireEvent.click(screen.getByText('Code'));
        expect(lastCall().orderBy).toBe('code');
    });

    itShowsLoadingIndicator(setupMocks, renderWithProviders);

    it('should show empty message when no items', () => {
        setupMocks({
            items: [], total: 0, page: 1, pages: 0,
            totalActiveDrivers: 0, totalDriversActiveToday: 0, averageSessionTime: 0,
        });
        renderWithProviders();

        expect(screen.getByText('No drivers logged in today')).toBeInTheDocument();
    });

    itShowsRetryableErrorState(setupMocks, renderWithProviders, refetch, "Couldn't load drivers");
});
