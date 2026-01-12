/**
 * RecurringJobsPage Component Tests
 */

import React from 'react';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {createTheme, ThemeProvider} from '@mui/material';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {RecurringJobsPage} from './RecurringJobsPage';
import {RecurringJobsPageProps, PrebookListModel, PaginatedRecurringJobsResponse} from '../../interfaces';

// Mock the hooks
jest.mock('../../hooks', () => ({
    useRecurringJobsList: jest.fn(),
    useSpeedList: jest.fn(),
    useCourierSearch: jest.fn(),
}));

// Mock the API
jest.mock('../../services/recurringJobsApi', () => ({
    recurringJobsApi: {
        voidPrebookJob: jest.fn(),
        exportToCsv: jest.fn(),
    },
}));

import {useRecurringJobsList, useSpeedList, useCourierSearch} from '../../hooks';
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
    booked: new Date('2024-01-15T10:30:00'),
    nextDueTime: new Date('2024-01-16T09:00:00'),
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
    onJobSelect: jest.fn(),
    setRefreshCallback: jest.fn(),
    ...overrides,
});

describe('RecurringJobsPage', () => {
    beforeEach(() => {
        jest.clearAllMocks();

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

    describe('Initial render', () => {
        it('should render toolbar and table', () => {
            renderWithProviders(createDefaultProps());

            expect(screen.getByPlaceholderText('Search jobs...')).toBeInTheDocument();
            expect(screen.getByText('Active')).toBeInTheDocument();
            expect(screen.getByText('Inactive')).toBeInTheDocument();
        });

        it('should show empty state when no jobs', () => {
            renderWithProviders(createDefaultProps());

            expect(screen.getByText('No recurring jobs available')).toBeInTheDocument();
        });

        it('should register refresh callback', () => {
            const setRefreshCallback = jest.fn();
            renderWithProviders(createDefaultProps({setRefreshCallback}));

            expect(setRefreshCallback).toHaveBeenCalledWith(expect.any(Function));
        });
    });

    describe('Loading state', () => {
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
    });

    describe('Job list display', () => {
        it('should display jobs in table', () => {
            const jobs = [createMockJob(1, 'ABC Corp'), createMockJob(2, 'XYZ Inc')];
            mockUseRecurringJobsList.mockReturnValue({
                data: createMockResponse(jobs),
                isLoading: false,
                error: null,
                refetch: jest.fn(),
            } as any);

            renderWithProviders(createDefaultProps());

            expect(screen.getByText('ABC Corp')).toBeInTheDocument();
            expect(screen.getByText('XYZ Inc')).toBeInTheDocument();
        });
    });

    describe('Job selection', () => {
        it('should call onJobSelect when job row is clicked', () => {
            const onJobSelect = jest.fn();
            const jobs = [createMockJob(1)];
            mockUseRecurringJobsList.mockReturnValue({
                data: createMockResponse(jobs),
                isLoading: false,
                error: null,
                refetch: jest.fn(),
            } as any);

            renderWithProviders(createDefaultProps({onJobSelect}));

            fireEvent.click(screen.getByText('Test Client').closest('tr')!);

            expect(onJobSelect).toHaveBeenCalledWith(1);
        });

        it('should clear selection when switching active filter', () => {
            const onJobSelect = jest.fn();
            const jobs = [createMockJob(1)];
            mockUseRecurringJobsList.mockReturnValue({
                data: createMockResponse(jobs),
                isLoading: false,
                error: null,
                refetch: jest.fn(),
            } as any);

            renderWithProviders(createDefaultProps({onJobSelect}));

            // Select a job first
            fireEvent.click(screen.getByText('Test Client').closest('tr')!);
            expect(onJobSelect).toHaveBeenCalledWith(1);

            // Switch to inactive
            fireEvent.click(screen.getByText('Inactive'));

            expect(onJobSelect).toHaveBeenCalledWith(null);
        });
    });

    describe('Void job', () => {
        it('should open confirmation dialog when delete is clicked', () => {
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
        });

        it('should close dialog when No is clicked', async () => {
            const jobs = [createMockJob(1)];
            mockUseRecurringJobsList.mockReturnValue({
                data: createMockResponse(jobs),
                isLoading: false,
                error: null,
                refetch: jest.fn(),
            } as any);

            renderWithProviders(createDefaultProps());

            // Open dialog
            const deleteButton = screen.getByRole('button', {name: /inactivate job/i});
            fireEvent.click(deleteButton);

            // Verify dialog is open
            expect(screen.getByText('Inactivate Recurring Job')).toBeInTheDocument();

            // Click No
            fireEvent.click(screen.getByText('No'));

            // Wait for dialog to close
            await waitFor(() => {
                expect(screen.queryByText('Inactivate Recurring Job')).not.toBeInTheDocument();
            });
        });

        it('should call API and show toast when Yes is clicked', async () => {
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

            // Open dialog
            const deleteButton = screen.getByRole('button', {name: /inactivate job/i});
            fireEvent.click(deleteButton);

            // Click Yes
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

        it('should show error toast when void fails', async () => {
            const showToast = jest.fn();
            const jobs = [createMockJob(1)];
            mockUseRecurringJobsList.mockReturnValue({
                data: createMockResponse(jobs),
                isLoading: false,
                error: null,
                refetch: jest.fn(),
            } as any);

            mockRecurringJobsApi.voidPrebookJob.mockRejectedValue(new Error('API Error'));

            renderWithProviders(createDefaultProps({showToast}));

            // Open dialog and confirm
            fireEvent.click(screen.getByRole('button', {name: /inactivate job/i}));
            fireEvent.click(screen.getByText('Yes'));

            await waitFor(() => {
                expect(showToast).toHaveBeenCalledWith(
                    'An error occurred while inactivating the recurring job. Please try again.',
                    'error'
                );
            });
        });
    });

    describe('Export', () => {
        it('should call export API and show toast', async () => {
            const showToast = jest.fn();
            renderWithProviders(createDefaultProps({showToast}));

            // Find export button by icon
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

        it('should show error toast when export fails', async () => {
            const showToast = jest.fn();
            mockRecurringJobsApi.exportToCsv.mockRejectedValue(new Error('Export failed'));

            renderWithProviders(createDefaultProps({showToast}));

            // Find export button by icon
            const exportIcon = screen.getByTestId('FileDownloadIcon');
            const exportButton = exportIcon.closest('button');
            fireEvent.click(exportButton!);

            await waitFor(() => {
                expect(showToast).toHaveBeenCalledWith('Failed to export recurring jobs', 'error');
            });
        });
    });

    describe('Refresh', () => {
        it('should call refetch when refresh button is clicked', async () => {
            const refetch = jest.fn();
            mockUseRecurringJobsList.mockReturnValue({
                data: createMockResponse([]),
                isLoading: false,
                error: null,
                refetch,
            } as any);

            renderWithProviders(createDefaultProps());

            // Find the refresh button by its icon's test id
            const refreshIcon = screen.getByTestId('RefreshIcon');
            const refreshButton = refreshIcon.closest('button');
            expect(refreshButton).toBeInTheDocument();
            fireEvent.click(refreshButton!);

            await waitFor(() => {
                expect(refetch).toHaveBeenCalled();
            });
        });
    });

    describe('Search', () => {
        it('should update query when search text changes', async () => {
            renderWithProviders(createDefaultProps());

            const searchInput = screen.getByPlaceholderText('Search jobs...');
            await userEvent.type(searchInput, 'test search');

            await waitFor(() => {
                // Check that the hook was called with searchText
                const calls = mockUseRecurringJobsList.mock.calls;
                const lastCallWithSearch = calls.find(call => call[0]?.searchText === 'test search');
                expect(lastCallWithSearch).toBeDefined();
            }, {timeout: 500});
        });
    });

    describe('Pagination', () => {
        it('should update query when page changes', () => {
            const jobs = Array.from({length: 50}, (_, i) => createMockJob(i + 1));
            mockUseRecurringJobsList.mockReturnValue({
                data: createMockResponse(jobs, 100),
                isLoading: false,
                error: null,
                refetch: jest.fn(),
            } as any);

            renderWithProviders(createDefaultProps());

            // Click next page
            const nextButton = screen.getByRole('button', {name: /next page/i});
            fireEvent.click(nextButton);

            // Check that the hook was called with page 2
            const calls = mockUseRecurringJobsList.mock.calls;
            const lastCallWithPage2 = calls.find(call => call[0]?.page === 2);
            expect(lastCallWithPage2).toBeDefined();
        });
    });

    describe('Sorting', () => {
        it('should update query when sort changes', () => {
            const jobs = [createMockJob(1)];
            mockUseRecurringJobsList.mockReturnValue({
                data: createMockResponse(jobs),
                isLoading: false,
                error: null,
                refetch: jest.fn(),
            } as any);

            renderWithProviders(createDefaultProps());

            // Click on Client column to sort
            fireEvent.click(screen.getByText('Client'));

            // Check that the hook was called with correct sort params
            const calls = mockUseRecurringJobsList.mock.calls;
            const lastCallWithSort = calls.find(call =>
                call[0]?.order === 'client' && call[0]?.orderDirection === 'asc'
            );
            expect(lastCallWithSort).toBeDefined();
        });
    });

    describe('Filters', () => {
        it('should render speed filter', () => {
            renderWithProviders(createDefaultProps());

            // Find speed filter by looking for the form control with Speed label
            const speedLabels = screen.getAllByText('Speed');
            // The first one should be in the toolbar
            const formControl = speedLabels[0].closest('.MuiFormControl-root');
            expect(formControl).toBeInTheDocument();

            // Verify a combobox exists for the filter
            const selectButton = formControl?.querySelector('[role="combobox"]');
            expect(selectButton).toBeInTheDocument();
        });

        it('should update query when days filter changes', () => {
            renderWithProviders(createDefaultProps());

            fireEvent.click(screen.getByText('M'));

            // Check that the hook was called with daysOfWeek set
            const calls = mockUseRecurringJobsList.mock.calls;
            const lastCallWithDays = calls.find(call => call[0]?.daysOfWeek === 1);
            expect(lastCallWithDays).toBeDefined();
        });
    });

    describe('Context menu', () => {
        it('should open context menu on right-click', () => {
            const jobs = [createMockJob(1)];
            mockUseRecurringJobsList.mockReturnValue({
                data: createMockResponse(jobs),
                isLoading: false,
                error: null,
                refetch: jest.fn(),
            } as any);

            renderWithProviders(createDefaultProps());

            const row = screen.getByText('Test Client').closest('tr')!;
            fireEvent.contextMenu(row);

            expect(screen.getByText('Add Pickup Stop')).toBeInTheDocument();
            expect(screen.getByText('Add Delivery Stop')).toBeInTheDocument();
        });

        it('should call onAddStop when menu item is clicked', () => {
            const onAddStop = jest.fn();
            const jobs = [createMockJob(1)];
            mockUseRecurringJobsList.mockReturnValue({
                data: createMockResponse(jobs),
                isLoading: false,
                error: null,
                refetch: jest.fn(),
            } as any);

            renderWithProviders(createDefaultProps({onAddStop}));

            // Open context menu
            const row = screen.getByText('Test Client').closest('tr')!;
            fireEvent.contextMenu(row);

            // Click add pickup stop
            fireEvent.click(screen.getByText('Add Pickup Stop'));

            expect(onAddStop).toHaveBeenCalledWith(jobs[0], true);
        });
    });
});
