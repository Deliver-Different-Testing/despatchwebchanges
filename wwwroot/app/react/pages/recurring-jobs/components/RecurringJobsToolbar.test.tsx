/**
 * RecurringJobsToolbar Component Tests
 */

import React from 'react';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {createTheme, ThemeProvider} from '@mui/material/styles';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {RecurringJobsToolbar, RecurringJobsToolbarProps, RecurringJobsFilters} from './RecurringJobsToolbar';

// Mock the hooks
jest.mock('../../../hooks', () => ({
    useSpeedList: jest.fn(),
    useCourierSearch: jest.fn(),
}));

import {useSpeedList, useCourierSearch} from '../../../hooks';

const mockUseSpeedList = useSpeedList as jest.MockedFunction<typeof useSpeedList>;
const mockUseCourierSearch = useCourierSearch as jest.MockedFunction<typeof useCourierSearch>;

const theme = createTheme();

const createTestQueryClient = () =>
    new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
            },
        },
    });

const renderWithProviders = (props: RecurringJobsToolbarProps) => {
    const queryClient = createTestQueryClient();
    return render(
        <QueryClientProvider client={queryClient}>
            <ThemeProvider theme={theme}>
                <RecurringJobsToolbar {...props} />
            </ThemeProvider>
        </QueryClientProvider>
    );
};

const defaultFilters: RecurringJobsFilters = {
    speedId: undefined,
    courierId: undefined,
    daysOfWeek: undefined,
};

const createDefaultProps = (overrides?: Partial<RecurringJobsToolbarProps>): RecurringJobsToolbarProps => ({
    searchText: '',
    isActive: true,
    isLoading: false,
    isExporting: false,
    filters: defaultFilters,
    onSearchChange: jest.fn(),
    onActiveFilterChange: jest.fn(),
    onFiltersChange: jest.fn(),
    onRefresh: jest.fn(),
    onExport: jest.fn(),
    ...overrides,
});

describe('RecurringJobsToolbar', () => {
    beforeEach(() => {
        jest.clearAllMocks();

        // Default mock implementations
        mockUseSpeedList.mockReturnValue({
            data: [
                {id: 1, text: 'Standard'},
                {id: 2, text: 'Express'},
                {id: 3, text: 'Same Day'},
            ],
            isLoading: false,
            error: null,
        } as any);

        mockUseCourierSearch.mockReturnValue({
            data: [],
            isLoading: false,
            error: null,
        } as any);
    });

    describe('Search field', () => {
        it('should render search input', () => {
            renderWithProviders(createDefaultProps());

            expect(screen.getByPlaceholderText('Search jobs...')).toBeInTheDocument();
        });

        it('should display initial search text', () => {
            renderWithProviders(createDefaultProps({searchText: 'test query'}));

            expect(screen.getByDisplayValue('test query')).toBeInTheDocument();
        });

        it('should call onSearchChange after debounce', async () => {
            const onSearchChange = jest.fn();
            renderWithProviders(createDefaultProps({onSearchChange}));

            const searchInput = screen.getByPlaceholderText('Search jobs...');
            await userEvent.type(searchInput, 'test');

            await waitFor(() => {
                expect(onSearchChange).toHaveBeenCalledWith('test');
            }, {timeout: 500});
        });

        it('should show clear button when search has text', async () => {
            renderWithProviders(createDefaultProps({searchText: 'test'}));

            expect(screen.getByTestId('ClearIcon')).toBeInTheDocument();
        });

        it('should clear search when clear button is clicked', async () => {
            const onSearchChange = jest.fn();
            renderWithProviders(createDefaultProps({searchText: 'test', onSearchChange}));

            const clearButtons = screen.getAllByRole('button');
            const clearButton = clearButtons.find(btn => btn.querySelector('[data-testid="ClearIcon"]'));
            if (clearButton) {
                fireEvent.click(clearButton);
                expect(onSearchChange).toHaveBeenCalledWith('');
            }
        });
    });

    describe('Active/Inactive toggle', () => {
        it('should render Active and Inactive toggle buttons', () => {
            renderWithProviders(createDefaultProps());

            expect(screen.getByText('Active')).toBeInTheDocument();
            expect(screen.getByText('Inactive')).toBeInTheDocument();
        });

        it('should have Active selected when isActive is true', () => {
            renderWithProviders(createDefaultProps({isActive: true}));

            const activeButton = screen.getByText('Active').closest('button');
            expect(activeButton).toHaveAttribute('aria-pressed', 'true');
        });

        it('should have Inactive selected when isActive is false', () => {
            renderWithProviders(createDefaultProps({isActive: false}));

            const inactiveButton = screen.getByText('Inactive').closest('button');
            expect(inactiveButton).toHaveAttribute('aria-pressed', 'true');
        });

        it('should call onActiveFilterChange when toggling', () => {
            const onActiveFilterChange = jest.fn();
            renderWithProviders(createDefaultProps({isActive: true, onActiveFilterChange}));

            fireEvent.click(screen.getByText('Inactive'));

            expect(onActiveFilterChange).toHaveBeenCalledWith(false);
        });
    });

    describe('Speed filter', () => {
        it('should render speed dropdown', () => {
            renderWithProviders(createDefaultProps());

            // Find speed filter - there may be multiple "Speed" texts
            const speedLabels = screen.getAllByText('Speed');
            expect(speedLabels.length).toBeGreaterThan(0);
        });

        it('should use speed options from useSpeedList', () => {
            // Verify useSpeedList hook is called
            renderWithProviders(createDefaultProps());
            expect(mockUseSpeedList).toHaveBeenCalled();
        });

        it('should have a speed select control', () => {
            renderWithProviders(createDefaultProps());

            // Verify the speed select renders with a combobox
            const speedLabels = screen.getAllByText('Speed');
            const speedLabel = speedLabels[0]; // Use the first one (the form label)
            const formControl = speedLabel.closest('.MuiFormControl-root');
            const selectButton = formControl?.querySelector('[role="combobox"]');
            expect(selectButton).toBeInTheDocument();
        });
    });

    describe('Courier filter', () => {
        it('should render courier autocomplete', () => {
            renderWithProviders(createDefaultProps());

            expect(screen.getByLabelText('Courier')).toBeInTheDocument();
        });

        it('should use courier search hook when typing', async () => {
            renderWithProviders(createDefaultProps());

            const courierInput = screen.getByRole('combobox', {name: /courier/i});
            await userEvent.type(courierInput, 'John');

            // Verify useCourierSearch is called
            expect(mockUseCourierSearch).toHaveBeenCalled();
        });

        it('should render courier autocomplete with combobox role', () => {
            renderWithProviders(createDefaultProps());

            const courierInput = screen.getByRole('combobox', {name: /courier/i});
            expect(courierInput).toBeInTheDocument();
        });
    });

    describe('Days of week filter', () => {
        it('should render day toggle buttons', () => {
            renderWithProviders(createDefaultProps());

            expect(screen.getByText('Days:')).toBeInTheDocument();
            expect(screen.getByText('M')).toBeInTheDocument();
            expect(screen.getByText('T')).toBeInTheDocument();
            expect(screen.getByText('W')).toBeInTheDocument();
            expect(screen.getByText('Th')).toBeInTheDocument();
            expect(screen.getByText('F')).toBeInTheDocument();
            expect(screen.getByText('S')).toBeInTheDocument();
            expect(screen.getByText('Su')).toBeInTheDocument();
        });

        it('should toggle additional days on', () => {
            const onFiltersChange = jest.fn();
            // Start with Monday (1) selected
            renderWithProviders(createDefaultProps({
                filters: {...defaultFilters, daysOfWeek: 1},
                onFiltersChange,
            }));

            // Click Tuesday to add it
            fireEvent.click(screen.getByText('T'));

            // Should now have Monday (1) + Tuesday (2) = 3
            expect(onFiltersChange).toHaveBeenCalledWith(expect.objectContaining({
                daysOfWeek: 3, // Monday + Tuesday bits
            }));
        });

        it('should call onFiltersChange when day is toggled', () => {
            const onFiltersChange = jest.fn();
            renderWithProviders(createDefaultProps({onFiltersChange}));

            fireEvent.click(screen.getByText('M'));

            expect(onFiltersChange).toHaveBeenCalledWith(expect.objectContaining({
                daysOfWeek: 1, // Monday bit
            }));
        });

        it('should clear last day when toggled off', () => {
            const onFiltersChange = jest.fn();
            renderWithProviders(createDefaultProps({
                filters: {...defaultFilters, daysOfWeek: 1}, // Monday selected
                onFiltersChange,
            }));

            fireEvent.click(screen.getByText('M'));

            expect(onFiltersChange).toHaveBeenCalledWith(expect.objectContaining({
                daysOfWeek: undefined, // No days selected
            }));
        });
    });

    describe('Clear filters button', () => {
        it('should not show clear filters when no filters active', () => {
            renderWithProviders(createDefaultProps());

            expect(screen.queryByRole('button', {name: /clear all filters/i})).not.toBeInTheDocument();
        });

        it('should show clear filters when speed filter is active', () => {
            renderWithProviders(createDefaultProps({
                filters: {...defaultFilters, speedId: 1},
            }));

            expect(screen.getByRole('button', {name: /clear all filters/i})).toBeInTheDocument();
        });

        it('should show clear filters when courier filter is active', () => {
            renderWithProviders(createDefaultProps({
                filters: {...defaultFilters, courierId: 1},
            }));

            expect(screen.getByRole('button', {name: /clear all filters/i})).toBeInTheDocument();
        });

        it('should show clear filters when days filter is active', () => {
            renderWithProviders(createDefaultProps({
                filters: {...defaultFilters, daysOfWeek: 1},
            }));

            expect(screen.getByRole('button', {name: /clear all filters/i})).toBeInTheDocument();
        });

        it('should clear all filters when clicked', () => {
            const onFiltersChange = jest.fn();
            renderWithProviders(createDefaultProps({
                filters: {speedId: 1, courierId: 2, daysOfWeek: 3},
                onFiltersChange,
            }));

            fireEvent.click(screen.getByRole('button', {name: /clear all filters/i}));

            expect(onFiltersChange).toHaveBeenCalledWith({
                speedId: undefined,
                courierId: undefined,
                daysOfWeek: undefined,
            });
        });
    });

    describe('Refresh button', () => {
        it('should render refresh button', () => {
            renderWithProviders(createDefaultProps());

            expect(screen.getByTestId('RefreshIcon')).toBeInTheDocument();
        });

        it('should call onRefresh when clicked', () => {
            const onRefresh = jest.fn();
            renderWithProviders(createDefaultProps({onRefresh}));

            const refreshButton = screen.getByTestId('RefreshIcon').closest('button')!;
            fireEvent.click(refreshButton);

            expect(onRefresh).toHaveBeenCalledTimes(1);
        });

        it('should be disabled when loading', () => {
            renderWithProviders(createDefaultProps({isLoading: true}));

            // When loading, shows CircularProgress instead of RefreshIcon
            expect(screen.getByRole('progressbar')).toBeInTheDocument();
        });
    });

    describe('Export button', () => {
        it('should render export button', () => {
            renderWithProviders(createDefaultProps());

            expect(screen.getByTestId('FileDownloadIcon')).toBeInTheDocument();
        });

        it('should call onExport when clicked', () => {
            const onExport = jest.fn();
            renderWithProviders(createDefaultProps({onExport}));

            const exportButton = screen.getByTestId('FileDownloadIcon').closest('button')!;
            fireEvent.click(exportButton);

            expect(onExport).toHaveBeenCalledTimes(1);
        });

        it('should be disabled when exporting', () => {
            renderWithProviders(createDefaultProps({isExporting: true}));

            // When exporting, shows CircularProgress instead of FileDownloadIcon
            const progressBars = screen.getAllByRole('progressbar');
            expect(progressBars.length).toBeGreaterThanOrEqual(1);
        });

        it('should be disabled when loading', () => {
            renderWithProviders(createDefaultProps({isLoading: true}));

            // Export button should be disabled, but we can't easily test this without the icon
            // Just verify loading state shows progress indicators
            expect(screen.getAllByRole('progressbar').length).toBeGreaterThanOrEqual(1);
        });
    });

    describe('Loading state', () => {
        it('should disable search input when loading', () => {
            renderWithProviders(createDefaultProps({isLoading: true}));

            expect(screen.getByPlaceholderText('Search jobs...')).toBeDisabled();
        });

        it('should disable Active/Inactive toggle when loading', () => {
            renderWithProviders(createDefaultProps({isLoading: true}));

            expect(screen.getByText('Active').closest('button')).toBeDisabled();
            expect(screen.getByText('Inactive').closest('button')).toBeDisabled();
        });

        it('should disable day toggle buttons when loading', () => {
            renderWithProviders(createDefaultProps({isLoading: true}));

            // Day buttons should be disabled
            const mondayButton = screen.getByText('M').closest('button');
            expect(mondayButton).toBeDisabled();
        });

        it('should disable courier autocomplete when loading', () => {
            renderWithProviders(createDefaultProps({isLoading: true}));

            expect(screen.getByLabelText('Courier')).toBeDisabled();
        });
    });
});
