import React from 'react';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {createTheme, ThemeProvider} from '@mui/material/styles';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {TodayActiveTab} from './TodayActiveTab';
import {TodayActiveDriverPaginated} from '../../../interfaces';
import {useTodayActiveDrivers} from '../../../hooks/useDriverManagementApi';

jest.mock('../../../hooks/useDriverManagementApi', () => ({
    useTodayActiveDrivers: jest.fn(),
}));

jest.mock('../../../services/driverManagementApi', () => ({
    driverManagementApi: {
        exportTodayActiveDriversCsv: jest.fn(),
    },
}));

const mockUseTodayActiveDrivers = useTodayActiveDrivers as jest.MockedFunction<typeof useTodayActiveDrivers>;

const theme = createTheme();
const createTestQueryClient = () => new QueryClient({defaultOptions: {queries: {retry: false}}});

const renderWithProviders = (showToast = jest.fn(), fleetOptions = [{id: 1, text: 'Fleet A'}]) => {
    const queryClient = createTestQueryClient();
    return render(
        <QueryClientProvider client={queryClient}>
            <ThemeProvider theme={theme}>
                <TodayActiveTab showToast={showToast} fleetOptions={fleetOptions} />
            </ThemeProvider>
        </QueryClientProvider>
    );
};

const createMockData = (): TodayActiveDriverPaginated => ({
    items: [
        {courierId: 1, code: 'JS001', name: 'John Smith', fleet: 'Fleet A', loginTime: '2025-01-15T08:00:00Z', logoutTime: undefined, duration: '4h 30m', deliveries: 12, status: 'Active'},
        {courierId: 2, code: 'JD002', name: 'Jane Doe', fleet: 'Fleet B', loginTime: '2025-01-15T09:00:00Z', logoutTime: '2025-01-15T13:00:00Z', duration: '4h 0m', deliveries: 8, status: 'Offline'},
    ],
    total: 2,
    page: 1,
    pages: 1,
    totalActiveDrivers: 1,
    totalDriversActiveToday: 2,
    averageSessionTime: 255,
});

const setupMocks = (data?: TodayActiveDriverPaginated, isLoading = false) => {
    mockUseTodayActiveDrivers.mockReturnValue({
        data: data ?? createMockData(),
        isLoading,
        isError: false,
        error: null,
        refetch: jest.fn(),
    } as any);
};

describe('TodayActiveTab', () => {
    describe('Column headers', () => {
        it('should render all column headers', () => {
            setupMocks();
            renderWithProviders();

            expect(screen.getByText('Code')).toBeInTheDocument();
            expect(screen.getByText('Name')).toBeInTheDocument();
            // 'Fleet' also appears as filter label
            expect(screen.getAllByText('Fleet').length).toBeGreaterThanOrEqual(1);
            expect(screen.getByText('Login Time')).toBeInTheDocument();
            expect(screen.getByText('Logout Time')).toBeInTheDocument();
            expect(screen.getByText('Duration')).toBeInTheDocument();
            expect(screen.getByText('Deliveries')).toBeInTheDocument();
            // 'Status' also appears as filter label
            expect(screen.getAllByText('Status').length).toBeGreaterThanOrEqual(1);
        });
    });

    describe('Stats display', () => {
        it('should display Currently Online stat', () => {
            setupMocks();
            renderWithProviders();

            expect(screen.getByText('Currently Online')).toBeInTheDocument();
        });

        it('should display Total Today stat', () => {
            setupMocks();
            renderWithProviders();

            expect(screen.getByText('Total Today')).toBeInTheDocument();
        });

        it('should display Average Session stat', () => {
            setupMocks();
            renderWithProviders();

            expect(screen.getByText('Average Session')).toBeInTheDocument();
        });
    });

    describe('Sort clicks', () => {
        it('should update orderBy when Name header is clicked', async () => {
            setupMocks();
            renderWithProviders();

            fireEvent.click(screen.getByText('Name'));

            await waitFor(() => {
                const lastCall = mockUseTodayActiveDrivers.mock.calls[mockUseTodayActiveDrivers.mock.calls.length - 1];
                expect(lastCall[0].orderBy).toBe('name');
                expect(lastCall[0].sortDescending).toBe(true);
            });
        });

        it('should update orderBy when Code header is clicked', async () => {
            setupMocks();
            renderWithProviders();

            fireEvent.click(screen.getByText('Code'));

            await waitFor(() => {
                const lastCall = mockUseTodayActiveDrivers.mock.calls[mockUseTodayActiveDrivers.mock.calls.length - 1];
                expect(lastCall[0].orderBy).toBe('code');
            });
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
                totalActiveDrivers: 0, totalDriversActiveToday: 0, averageSessionTime: 0,
            });
            renderWithProviders();

            expect(screen.getByText('No Active Drivers')).toBeInTheDocument();
            expect(screen.getByText('No active drivers match your criteria.')).toBeInTheDocument();
        });
    });
});
