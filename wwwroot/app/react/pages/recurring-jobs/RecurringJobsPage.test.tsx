/** @jest-environment jest-environment-jsdom */
/**
 * RecurringJobsPage Component Tests
 *
 * Optimised: tests sharing identical setup consolidated into single renders.
 */

import React from 'react';
import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {createTheme, ThemeProvider} from '@mui/material/styles';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {RecurringJobsPage} from './RecurringJobsPage';
import {RecurringJobsPageProps, PrebookListModel, PaginatedRecurringJobsResponse} from '../../interfaces';
import dayjs from 'dayjs';

// Mock JobDetails to avoid AngularJS dependency chain
jest.mock('../../components/common/job-details/JobDetails', () => ({
    JobDetails: ({config}: { config: { jobId?: number; isRecurringJob: boolean } }) => (
        <div data-testid="job-details" data-job-id={config.jobId ?? ''} data-is-recurring={String(config.isRecurringJob)}>
            JobDetails Mock
        </div>
    ),
}));

// Mock the hooks
jest.mock('../../hooks/useRecurringJobsApi', () => ({
    useRecurringJobsList: jest.fn(),
    useSpeedList: jest.fn(),
}));

jest.mock('../../hooks/useCourierApi', () => ({
    useCourierSearch: jest.fn(),
}));

// Mock the API
jest.mock('../../services/recurringJobsApi', () => ({
    recurringJobsApi: {
        voidPrebookJob: jest.fn(),
        exportToCsv: jest.fn(),
    },
}));

import {useRecurringJobsList, useSpeedList} from '../../hooks/useRecurringJobsApi';
import {useCourierSearch} from '../../hooks/useCourierApi';
import {recurringJobsApi} from '../../services/recurringJobsApi';

const mockUseRecurringJobsList = useRecurringJobsList as jest.MockedFunction<typeof useRecurringJobsList>;
const mockUseSpeedList = useSpeedList as jest.MockedFunction<typeof useSpeedList>;
const mockUseCourierSearch = useCourierSearch as jest.MockedFunction<typeof useCourierSearch>;
const mockRecurringJobsApi = recurringJobsApi as jest.Mocked<typeof recurringJobsApi>;

const theme = createTheme();

const createTestQueryClient = () =>
    new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
            },
        },
    });

const renderWithProviders = (props: RecurringJobsPageProps) => {
    const queryClient = createTestQueryClient();
    return render(
        <QueryClientProvider client={queryClient}>
            <ThemeProvider theme={theme}>
                <RecurringJobsPage {...props} />
            </ThemeProvider>
        </QueryClientProvider>
    );
};

const createMockAddress = (line1: string, full: string) => ({
    addressLine1: line1,
    addressLine2: '',
    addressLine3: '',
    addressLine4: '',
    addressLine5: '',
    addressLine6: '',
    addressLine7: '',
    addressLine8: '',
    fullAddress: full,
});

const createMockJob = (id: number, client: string = 'Test Client'): PrebookListModel => ({
    id,
    booked: dayjs('2024-01-15T10:30:00'),
    nextDueTime: dayjs('2024-01-16T09:00:00'),
    client,
    jobNo: `JOB${id}`,
    clientId: 100 + id,
    courier: 'John Courier',
    speed: 'Standard',
    customJobName: `Job Name ${id}`,
    pickupAddress: createMockAddress('123 Pickup St', '123 Pickup St, London'),
    deliveryAddress: createMockAddress('456 Delivery Ave', '456 Delivery Ave, Manchester'),
});

const createMockResponse = (jobs: PrebookListModel[], total: number = jobs.length): PaginatedRecurringJobsResponse => ({
    items: jobs,
    total,
    page: 1,
    pages: Math.ceil(total / 50),
});

const createDefaultProps = (overrides?: Partial<RecurringJobsPageProps>): RecurringJobsPageProps => ({
    showToast: jest.fn(),
    isUsCustomer: false,
    onAddStop: jest.fn(),
    setRefreshCallback: jest.fn(),
    ...overrides,
});

describe('RecurringJobsPage', () => {
    beforeEach(() => {
        // Default mock implementations
        mockUseRecurringJobsList.mockReturnValue({
            data: createMockResponse([]),
            isLoading: false,
            error: null,
            refetch: jest.fn(),
        } as any);

        mockUseSpeedList.mockReturnValue({
            data: [
                {id: 1, text: 'Standard'},
                {id: 2, text: 'Express'},
            ],
            isLoading: false,
            error: null,
        } as any);

        mockUseCourierSearch.mockReturnValue({
            data: [],
            isLoading: false,
            error: null,
        } as any);

        mockRecurringJobsApi.voidPrebookJob.mockResolvedValue(undefined);
        mockRecurringJobsApi.exportToCsv.mockResolvedValue(undefined);
    });

    // ── Initial render: toolbar, empty state, refresh callback, speed filter, export, refresh (single render) ─
    it('renders toolbar, empty state, speed filter, registers callback, and supports export/refresh', async () => {
        const showToast = jest.fn();
        const setRefreshCallback = jest.fn();
        const refetch = jest.fn();
        mockUseRecurringJobsList.mockReturnValue({
            data: createMockResponse([]),
            isLoading: false,
            error: null,
            refetch,
        } as any);

        renderWithProviders(createDefaultProps({showToast, setRefreshCallback}));

        // Toolbar
        expect(screen.getByPlaceholderText('Search jobs...')).toBeInTheDocument();
        expect(screen.getByText('Active')).toBeInTheDocument();
        expect(screen.getByText('Inactive')).toBeInTheDocument();

        // Empty state
        expect(screen.getByText('No recurring jobs available')).toBeInTheDocument();

        // Refresh callback
        expect(setRefreshCallback).toHaveBeenCalledWith(expect.any(Function));

        // Speed filter
        const speedLabels = screen.getAllByText('Speed');
        const formControl = speedLabels[0].closest('.MuiFormControl-root');
        expect(formControl).toBeInTheDocument();
        const selectButton = formControl?.querySelector('[role="combobox"]');
        expect(selectButton).toBeInTheDocument();

        // Refresh button
        const refreshIcon = screen.getByTestId('RefreshIcon');
        const refreshButton = refreshIcon.closest('button');
        expect(refreshButton).toBeInTheDocument();
        fireEvent.click(refreshButton!);
        await waitFor(() => {
            expect(refetch).toHaveBeenCalled();
        });

        // Export button
        const exportIcon = screen.getByTestId('FileDownloadIcon');
        const exportButton = exportIcon.closest('button');
        expect(exportButton).toBeInTheDocument();
        fireEvent.click(exportButton!);

        await waitFor(() => {
            expect(showToast).toHaveBeenCalledWith('Exporting recurring jobs...', 'info');
        });
        await waitFor(() => {
            expect(mockRecurringJobsApi.exportToCsv).toHaveBeenCalled();
        });
        await waitFor(() => {
            expect(showToast).toHaveBeenCalledWith('Recurring jobs exported successfully', 'success');
        });
    });

    // ── Loading state ───────────────────────────────────────────────
    it('should show loading indicator', () => {
        mockUseRecurringJobsList.mockReturnValue({
            data: undefined,
            isLoading: true,
            error: null,
            refetch: jest.fn(),
        } as any);

        renderWithProviders(createDefaultProps());

        expect(screen.getByText('Loading recurring jobs...')).toBeInTheDocument();
    });

    // ── Job list + selection + Job Details panel ──────────────────────
    it('displays jobs, shows Job Details panel, and updates header on click', () => {
        const jobs = [createMockJob(1, 'ABC Corp'), createMockJob(2, 'XYZ Inc')];
        mockUseRecurringJobsList.mockReturnValue({
            data: createMockResponse(jobs),
            isLoading: false,
            error: null,
            refetch: jest.fn(),
        } as any);

        renderWithProviders(createDefaultProps());

        // Jobs displayed
        expect(screen.getByText('ABC Corp')).toBeInTheDocument();
        expect(screen.getByText('XYZ Inc')).toBeInTheDocument();

        // Job Details panel rendered directly in React (no AngularJS bridge)
        expect(screen.getByText('Job Details')).toBeInTheDocument();

        // Select job → header updates with job ID
        fireEvent.click(screen.getByText('ABC Corp').closest('tr')!);
        expect(screen.getByText(/Job Details - Job #1/)).toBeInTheDocument();
    });

    // ── Void job: open dialog + close with No (single render) ───────
    it('opens void confirmation dialog and closes with No', async () => {
        const jobs = [createMockJob(1)];
        mockUseRecurringJobsList.mockReturnValue({
            data: createMockResponse(jobs),
            isLoading: false,
            error: null,
            refetch: jest.fn(),
        } as any);

        renderWithProviders(createDefaultProps());

        const deleteButton = screen.getByRole('button', {name: /inactivate job/i});
        fireEvent.click(deleteButton);

        expect(screen.getByText('Inactivate Recurring Job')).toBeInTheDocument();
        expect(screen.getByText(/this will inactivate this recurring job/i)).toBeInTheDocument();

        // Close with No
        fireEvent.click(screen.getByText('No'));

        await waitFor(() => {
            expect(screen.queryByText('Inactivate Recurring Job')).not.toBeInTheDocument();
        });
    });

    // ── Void job: confirm with Yes ──────────────────────────────────
    it('calls API and shows toast when void is confirmed', async () => {
        const showToast = jest.fn();
        const refetch = jest.fn();
        const jobs = [createMockJob(1)];
        mockUseRecurringJobsList.mockReturnValue({
            data: createMockResponse(jobs),
            isLoading: false,
            error: null,
            refetch,
        } as any);

        renderWithProviders(createDefaultProps({showToast}));

        const deleteButton = screen.getByRole('button', {name: /inactivate job/i});
        fireEvent.click(deleteButton);

        fireEvent.click(screen.getByText('Yes'));

        await waitFor(() => {
            expect(mockRecurringJobsApi.voidPrebookJob).toHaveBeenCalledWith(1);
        });

        await waitFor(() => {
            expect(showToast).toHaveBeenCalledWith(
                'The recurring job has been successfully inactivated.',
                'success'
            );
        });

        expect(refetch).toHaveBeenCalled();
    });

    // ── Search ──────────────────────────────────────────────────────
    it('should update query when search text changes', async () => {
        jest.useFakeTimers();
        renderWithProviders(createDefaultProps());

        const searchInput = screen.getByPlaceholderText('Search jobs...');
        fireEvent.change(searchInput, {target: {value: 'test search'}});

        act(() => {
            jest.advanceTimersByTime(350);
        });

        const calls = mockUseRecurringJobsList.mock.calls;
        const lastCallWithSearch = calls.find(call => call[0]?.searchText === 'test search');
        expect(lastCallWithSearch).toBeDefined();

        jest.useRealTimers();
    });

    // ── Pagination ──────────────────────────────────────────────────
    it('should update query when page changes', () => {
        const jobs = Array.from({length: 50}, (_, i) => createMockJob(i + 1));
        mockUseRecurringJobsList.mockReturnValue({
            data: createMockResponse(jobs, 100),
            isLoading: false,
            error: null,
            refetch: jest.fn(),
        } as any);

        renderWithProviders(createDefaultProps());

        const nextButton = screen.getByRole('button', {name: /next page/i});
        fireEvent.click(nextButton);

        const calls = mockUseRecurringJobsList.mock.calls;
        const lastCallWithPage2 = calls.find(call => call[0]?.page === 2);
        expect(lastCallWithPage2).toBeDefined();
    });

    // ── Sorting + days filter (single render) ───────────────────────
    it('updates query for sort and days filter changes', () => {
        const jobs = [createMockJob(1)];
        mockUseRecurringJobsList.mockReturnValue({
            data: createMockResponse(jobs),
            isLoading: false,
            error: null,
            refetch: jest.fn(),
        } as any);

        renderWithProviders(createDefaultProps());

        // Sort by Client
        fireEvent.click(screen.getByText('Client'));
        const sortCalls = mockUseRecurringJobsList.mock.calls;
        const lastCallWithSort = sortCalls.find(call =>
            call[0]?.order === 'client' && call[0]?.orderDirection === 'asc'
        );
        expect(lastCallWithSort).toBeDefined();

        // Days filter
        fireEvent.click(screen.getByText('M'));
        const dayCalls = mockUseRecurringJobsList.mock.calls;
        const lastCallWithDays = dayCalls.find(call => call[0]?.daysOfWeek === 1);
        expect(lastCallWithDays).toBeDefined();
    });

    // ── Context menu: open + click item (single render) ─────────────
    it('opens context menu on right-click and calls onAddStop', () => {
        const onAddStop = jest.fn();
        const jobs = [createMockJob(1)];
        mockUseRecurringJobsList.mockReturnValue({
            data: createMockResponse(jobs),
            isLoading: false,
            error: null,
            refetch: jest.fn(),
        } as any);

        renderWithProviders(createDefaultProps({onAddStop}));

        const row = screen.getByText('Test Client').closest('tr')!;
        fireEvent.contextMenu(row);

        expect(screen.getByText('Add Pickup Stop')).toBeInTheDocument();
        expect(screen.getByText('Add Delivery Stop')).toBeInTheDocument();

        fireEvent.click(screen.getByText('Add Pickup Stop'));
        expect(onAddStop).toHaveBeenCalledWith(jobs[0], true);
    });

    // ── Two-column layout with Job Details ───────────────────────────
    it('renders in a two-column layout with Job Details in the right panel', () => {
        const jobs = [createMockJob(1)];
        mockUseRecurringJobsList.mockReturnValue({
            data: createMockResponse(jobs),
            isLoading: false,
            error: null,
            refetch: jest.fn(),
        } as any);

        renderWithProviders(createDefaultProps());

        // Left panel: Filters + Recurring Jobs table
        expect(screen.getByText('Filters')).toBeInTheDocument();
        expect(screen.getByText(/Recurring Jobs/)).toBeInTheDocument();

        // Right panel: Job Details (rendered directly in React, no AngularJS bridge)
        expect(screen.getByText('Job Details')).toBeInTheDocument();
    });

    // ── Job Details card header consistency ──────────────────────────
    it('renders Job Details header with same style as other card headers on the page', () => {
        const jobs = [createMockJob(1)];
        mockUseRecurringJobsList.mockReturnValue({
            data: createMockResponse(jobs),
            isLoading: false,
            error: null,
            refetch: jest.fn(),
        } as any);

        const {container} = renderWithProviders(createDefaultProps());

        // Collect all dense toolbar elements
        const toolbars = container.querySelectorAll('[class*="MuiToolbar-dense"]');
        expect(toolbars.length).toBeGreaterThanOrEqual(3); // Filters + Recurring Jobs + Job Details

        const jobDetailsToolbar = Array.from(toolbars).find(tb =>
            tb.textContent?.includes('Job Details')
        );
        const filtersToolbar = Array.from(toolbars).find(tb =>
            tb.textContent?.includes('Filters')
        );

        expect(jobDetailsToolbar).toBeInTheDocument();
        expect(filtersToolbar).toBeInTheDocument();

        // Both should use the same dense toolbar variant
        expect(jobDetailsToolbar!.className).toContain('MuiToolbar-dense');
        expect(filtersToolbar!.className).toContain('MuiToolbar-dense');
    });

    // ── No onJobSelect prop (bridge removed) ────────────────────────
    it('does not pass selection state through AngularJS bridge', () => {
        mockUseRecurringJobsList.mockReturnValue({
            data: createMockResponse([createMockJob(1)]),
            isLoading: false,
            error: null,
            refetch: jest.fn(),
        } as any);

        // RecurringJobsPageProps no longer includes onJobSelect
        const props = createDefaultProps();
        expect(props).not.toHaveProperty('onJobSelect');

        renderWithProviders(props);

        // Job Details is present (rendered directly, not via AngularJS bridge)
        expect(screen.getByText('Job Details')).toBeInTheDocument();
    });
});
