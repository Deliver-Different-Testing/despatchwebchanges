/**
 * AfterHoursTab Component Tests
 * Optimised: read-only tests consolidated to reduce render count.
 */

import type {MockedFunction} from 'vitest';
import React from 'react';
import {fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import {MantineTestProvider} from '../../../test/utils';
import {createTestQueryClient} from '../../../test/utils';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {AfterHoursTab} from './AfterHoursTab';
import {AfterHoursPaginated} from '../../../types';
import {useAfterHoursSchedule, useCreateAfterHoursSchedule, useUpdateAfterHoursSchedule, useDeleteAfterHoursSchedule} from '../../../hooks/useDriverManagementApi';
import {testDialogs} from '../../../components/dialogs/testDialogRegistry';
import {itShowsLoadingIndicator, itShowsRetryableErrorState} from './driverTabLoadStates.testHelpers';
vi.mock('../../../components/dialogs/dialogRegistry', async () => (await import('../../../components/dialogs/testDialogRegistry')).createDialogRegistryMock());

vi.mock('../../../hooks/useDriverManagementApi', () => ({
    useAfterHoursSchedule: vi.fn(),
    useCreateAfterHoursSchedule: vi.fn(),
    useUpdateAfterHoursSchedule: vi.fn(),
    useDeleteAfterHoursSchedule: vi.fn(),
}));

vi.mock('../../../api/driverManagementApi', () => ({
    driverManagementApi: {
        exportAfterHoursScheduleCsv: vi.fn(),
    },
}));

const mockUseAfterHoursSchedule = useAfterHoursSchedule as MockedFunction<typeof useAfterHoursSchedule>;
const mockUseCreateAfterHoursSchedule = useCreateAfterHoursSchedule as MockedFunction<typeof useCreateAfterHoursSchedule>;
const mockUseUpdateAfterHoursSchedule = useUpdateAfterHoursSchedule as MockedFunction<typeof useUpdateAfterHoursSchedule>;
const mockUseDeleteAfterHoursSchedule = useDeleteAfterHoursSchedule as MockedFunction<typeof useDeleteAfterHoursSchedule>;

const renderWithProviders = (showToast = vi.fn()) => {
    const queryClient = createTestQueryClient();
    return render(
        <QueryClientProvider client={queryClient}>
            <MantineTestProvider>
                <AfterHoursTab showToast={showToast} />
            </MantineTestProvider>
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

const refetch = vi.fn();

const setupMocks = (data?: AfterHoursPaginated, isLoading = false, isError = false) => {
    mockUseAfterHoursSchedule.mockReturnValue({
        data: isError ? undefined : data ?? createMockData(),
        isLoading,
        isError,
        error: null,
        refetch,
    } as any);
    mockUseCreateAfterHoursSchedule.mockReturnValue({
        mutateAsync: vi.fn().mockResolvedValue(undefined),
        isLoading: false,
    } as any);
    mockUseUpdateAfterHoursSchedule.mockReturnValue({
        mutateAsync: vi.fn().mockResolvedValue(undefined),
        isLoading: false,
    } as any);
    mockUseDeleteAfterHoursSchedule.mockReturnValue({
        mutateAsync: vi.fn().mockResolvedValue(undefined),
        isLoading: false,
    } as any);
};

describe('AfterHoursTab', () => {
    beforeEach(() => {
        testDialogs.EditAfterhours = {open: vi.fn()};
    });

    afterEach(() => {
        delete testDialogs.EditAfterhours;
    });

    it('should render all column headers and stats display', () => {
        setupMocks();
        renderWithProviders();

        // Column headers
        expect(screen.getByText('Driver name')).toBeInTheDocument();
        expect(screen.getByText('Driver code')).toBeInTheDocument();
        expect(screen.getByText('Days')).toBeInTheDocument();
        expect(screen.getByText('Start time')).toBeInTheDocument();
        expect(screen.getByText('End time')).toBeInTheDocument();
        expect(screen.getByText('Duration')).toBeInTheDocument();

        // Stats display
        expect(screen.getByText('Total assignments')).toBeInTheDocument();
        expect(screen.getByText('Active drivers')).toBeInTheDocument();
    });

    it('starts sorted by courierName and sends the contract sort keys', () => {
        setupMocks();
        renderWithProviders();

        const lastCall = () => mockUseAfterHoursSchedule.mock.calls[mockUseAfterHoursSchedule.mock.calls.length - 1][0];
        expect(lastCall().orderBy).toBe('courierName');
        expect(lastCall().sortDescending).toBe(false);

        for (const [label, key] of [['Driver code', 'courierCode'], ['Days', 'days'], ['Start time', 'startTime'], ['End time', 'endTime'], ['Duration', 'duration']] as const) {
            fireEvent.click(screen.getByText(label));
            expect(lastCall().orderBy).toBe(key);
        }
        fireEvent.click(screen.getByText('Driver name'));
        expect(lastCall().orderBy).toBe('courierName');
    });

    it('opens the delete dialog and closes it on Cancel', async () => {
        setupMocks();
        renderWithProviders();

        // The row action and the dialog's confirm share a name, so the row button
        // is taken from the table and the dialog asserted by its own role.
        fireEvent.click(screen.getAllByRole('button', {name: 'Delete schedule'})[0]);

        expect(await screen.findByRole('dialog')).toBeInTheDocument();
        // Scoped to the dialog: the driver's name is also in the row behind it.
        const dialog = within(screen.getByRole('dialog'));
        expect(dialog.getByText(/Delete this schedule for/)).toBeInTheDocument();
        expect(dialog.getByText('John Smith')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', {name: 'Cancel'}));

        await waitFor(() => {
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });
    });

    describe('Loading state', () => {
        itShowsLoadingIndicator(setupMocks, renderWithProviders);
    });

    describe('Empty state', () => {
        it('should show empty message when no items', () => {
            setupMocks({
                items: [], total: 0, page: 1, pages: 0,
                totalActiveDrivers: 0,
            });
            renderWithProviders();

            expect(screen.getByText('No after hours schedules')).toBeInTheDocument();
            expect(screen.getByText('Add a schedule to roster drivers outside normal hours.')).toBeInTheDocument();
        });

        itShowsRetryableErrorState(setupMocks, renderWithProviders, refetch, "Couldn't load schedules");
    });
});
