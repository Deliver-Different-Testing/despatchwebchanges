import React from 'react';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {createTheme, ThemeProvider} from '@mui/material/styles';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {AfterHoursTab} from './AfterHoursTab';
import {AfterHoursPaginated} from '../../../interfaces';
import {useAfterHoursSchedule, useCreateAfterHoursSchedule, useUpdateAfterHoursSchedule, useDeleteAfterHoursSchedule} from '../../../hooks';

jest.mock('../../../hooks', () => ({
    useAfterHoursSchedule: jest.fn(),
    useCreateAfterHoursSchedule: jest.fn(),
    useUpdateAfterHoursSchedule: jest.fn(),
    useDeleteAfterHoursSchedule: jest.fn(),
}));

jest.mock('../../../services/driverManagementApi', () => ({
    driverManagementApi: {
        exportAfterHoursScheduleCsv: jest.fn(),
    },
}));

const mockUseAfterHoursSchedule = useAfterHoursSchedule as jest.MockedFunction<typeof useAfterHoursSchedule>;
const mockUseCreateAfterHoursSchedule = useCreateAfterHoursSchedule as jest.MockedFunction<typeof useCreateAfterHoursSchedule>;
const mockUseUpdateAfterHoursSchedule = useUpdateAfterHoursSchedule as jest.MockedFunction<typeof useUpdateAfterHoursSchedule>;
const mockUseDeleteAfterHoursSchedule = useDeleteAfterHoursSchedule as jest.MockedFunction<typeof useDeleteAfterHoursSchedule>;

const theme = createTheme();
const createTestQueryClient = () => new QueryClient({defaultOptions: {queries: {retry: false}}});

const renderWithProviders = (showToast = jest.fn()) => {
    const queryClient = createTestQueryClient();
    return render(
        <QueryClientProvider client={queryClient}>
            <ThemeProvider theme={theme}>
                <AfterHoursTab showToast={showToast} />
            </ThemeProvider>
        </QueryClientProvider>
    );
};

const createMockData = (): AfterHoursPaginated => ({
    items: [
        {afterHoursScheduleId: 1, courierId: 10, courierName: 'John Smith', courierCode: 'JS001', days: ['Monday', 'Wednesday'], startTime: '2025-01-15T17:00:00Z', endTime: '2025-01-15T21:00:00Z', duration: '4h'},
        {afterHoursScheduleId: 2, courierId: 20, courierName: 'Jane Doe', courierCode: 'JD002', days: ['Tuesday', 'Thursday'], startTime: '2025-01-15T18:00:00Z', endTime: '2025-01-15T22:00:00Z', duration: '4h'},
    ],
    total: 2,
    page: 1,
    pages: 1,
    totalActiveDrivers: 2,
});

const setupMocks = (data?: AfterHoursPaginated, isLoading = false) => {
    mockUseAfterHoursSchedule.mockReturnValue({
        data: data ?? createMockData(),
        isLoading,
        isError: false,
        error: null,
        refetch: jest.fn(),
    } as any);
    mockUseCreateAfterHoursSchedule.mockReturnValue({
        mutateAsync: jest.fn().mockResolvedValue(undefined),
        isLoading: false,
    } as any);
    mockUseUpdateAfterHoursSchedule.mockReturnValue({
        mutateAsync: jest.fn().mockResolvedValue(undefined),
        isLoading: false,
    } as any);
    mockUseDeleteAfterHoursSchedule.mockReturnValue({
        mutateAsync: jest.fn().mockResolvedValue(undefined),
        isLoading: false,
    } as any);
};

describe('AfterHoursTab', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (window as any).ReactEditAfterhoursDialog = {open: jest.fn()};
    });

    afterEach(() => {
        delete (window as any).ReactEditAfterhoursDialog;
    });

    describe('Column headers', () => {
        it('should render all column headers', () => {
            setupMocks();
            renderWithProviders();

            expect(screen.getByText('Driver Name')).toBeInTheDocument();
            expect(screen.getByText('Driver Code')).toBeInTheDocument();
            expect(screen.getByText('Days')).toBeInTheDocument();
            expect(screen.getByText('Start Time')).toBeInTheDocument();
            expect(screen.getByText('End Time')).toBeInTheDocument();
            expect(screen.getByText('Duration')).toBeInTheDocument();
        });
    });

    describe('Stats display', () => {
        it('should display Total Assignments stat', () => {
            setupMocks();
            renderWithProviders();

            expect(screen.getByText('Total Assignments')).toBeInTheDocument();
        });

        it('should display Active Drivers stat', () => {
            setupMocks();
            renderWithProviders();

            expect(screen.getByText('Active Drivers')).toBeInTheDocument();
        });
    });

    describe('Sort clicks', () => {
        it('should update orderBy when Driver Name header is clicked', async () => {
            setupMocks();
            renderWithProviders();

            fireEvent.click(screen.getByText('Driver Name'));

            await waitFor(() => {
                const lastCall = mockUseAfterHoursSchedule.mock.calls[mockUseAfterHoursSchedule.mock.calls.length - 1];
                expect(lastCall[0].orderBy).toBe('courierName');
            });
        });
    });

    describe('Delete confirmation dialog', () => {
        it('should open delete dialog when delete button is clicked', () => {
            setupMocks();
            renderWithProviders();

            // Click first delete button (there should be one per row)
            const deleteButtons = screen.getAllByRole('button', {name: 'Delete'});
            fireEvent.click(deleteButtons[0]);

            expect(screen.getByText('Delete Schedule')).toBeInTheDocument();
            expect(screen.getByText(/Are you sure you want to delete this schedule for John Smith/)).toBeInTheDocument();
        });

        it('should close dialog when Cancel is clicked', async () => {
            setupMocks();
            renderWithProviders();

            const deleteButtons = screen.getAllByRole('button', {name: 'Delete'});
            fireEvent.click(deleteButtons[0]);
            expect(screen.getByText('Delete Schedule')).toBeInTheDocument();

            fireEvent.click(screen.getByRole('button', {name: 'Cancel'}));

            await waitFor(() => {
                expect(screen.queryByText('Delete Schedule')).not.toBeInTheDocument();
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
                totalActiveDrivers: 0,
            });
            renderWithProviders();

            expect(screen.getByText('No After Hours Schedules')).toBeInTheDocument();
            expect(screen.getByText('No after hours schedules match your criteria.')).toBeInTheDocument();
        });
    });
});
