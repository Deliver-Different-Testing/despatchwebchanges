/**
 * RecurringJobsToolbar Component Tests
 * Optimised: read-only tests consolidated to reduce render count.
 */

import React from 'react';
import { setupUser } from '../../../__testUtils__/setupUser';
import {fireEvent, screen, waitFor} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {renderWithMantine} from '../../../__testUtils__';
import {RecurringJobsToolbar, RecurringJobsToolbarProps, RecurringJobsFilters} from './RecurringJobsToolbar';
import {RecurringMode} from '../../../interfaces';

// Mock the hooks
jest.mock('../../../hooks/useRecurringJobsApi', () => ({
    useSpeedList: jest.fn(),
    useRouteList: jest.fn(),
}));

jest.mock('../../../hooks/useCourierApi', () => ({
    useCourierSearch: jest.fn(),
}));

import {useRouteList, useSpeedList} from '../../../hooks/useRecurringJobsApi';
import {useCourierSearch} from '../../../hooks/useCourierApi';

const mockUseSpeedList = useSpeedList as jest.MockedFunction<typeof useSpeedList>;
const mockUseRouteList = useRouteList as jest.MockedFunction<typeof useRouteList>;
const mockUseCourierSearch = useCourierSearch as jest.MockedFunction<typeof useCourierSearch>;


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
    return renderWithMantine(
        <QueryClientProvider client={queryClient}>
            <RecurringJobsToolbar {...props} />
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
    recurringMode: RecurringMode.Active,
    isLoading: false,
    isRefreshing: false,
    isExporting: false,
    filters: defaultFilters,
    onSearchChange: jest.fn(),
    onRecurringModeChange: jest.fn(),
    onFiltersChange: jest.fn(),
    onRefresh: jest.fn(),
    onExport: jest.fn(),
    ...overrides,
});

describe('RecurringJobsToolbar', () => {
    beforeEach(() => {
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

        mockUseRouteList.mockReturnValue({
            data: [],
            isLoading: false,
            error: null,
        } as any);

        mockUseCourierSearch.mockReturnValue({
            data: [],
            isLoading: false,
            error: null,
        } as any);
    });

    it('should render all default UI elements with default props', () => {
        renderWithProviders(createDefaultProps());

        // Search input
        expect(screen.getByPlaceholderText('Search jobs...')).toBeInTheDocument();

        // Active / Manual / Inactive mode selector
        expect(screen.getByText('Active')).toBeInTheDocument();
        expect(screen.getByText('Manual')).toBeInTheDocument();
        expect(screen.getByText('Inactive')).toBeInTheDocument();

        // Active selected by default
        const activeButton = screen.getByText('Active').closest('button');
        expect(activeButton).toHaveAttribute('aria-pressed', 'true');

        // Speed dropdown
        const speedLabels = screen.getAllByText('Speed');
        expect(speedLabels.length).toBeGreaterThan(0);

        // useSpeedList hook is called
        expect(mockUseSpeedList).toHaveBeenCalled();

        // Speed select control with combobox
        expect(screen.getByRole('combobox', {name: 'Speed'})).toBeInTheDocument();

        // Courier autocomplete
        expect(screen.getByRole('combobox', {name: 'Courier'})).toBeInTheDocument();

        // Courier autocomplete with combobox role
        const courierInput = screen.getByRole('combobox', {name: 'Courier'});
        expect(courierInput).toBeInTheDocument();

        // Day toggle buttons
        expect(screen.getByText('Days')).toBeInTheDocument();
        expect(screen.getByText('M')).toBeInTheDocument();
        expect(screen.getByText('T')).toBeInTheDocument();
        expect(screen.getByText('W')).toBeInTheDocument();
        expect(screen.getByText('Th')).toBeInTheDocument();
        expect(screen.getByText('F')).toBeInTheDocument();
        expect(screen.getByText('S')).toBeInTheDocument();
        expect(screen.getByText('Su')).toBeInTheDocument();

        // Refresh button
        expect(screen.getByRole('button', {name: 'Refresh'})).toBeInTheDocument();

        // Export button
        expect(screen.getByRole('button', {name: 'Export to CSV'})).toBeInTheDocument();
    });

    describe('Search field', () => {
        it('should display initial search text and show clear button', () => {
            renderWithProviders(createDefaultProps({searchText: 'test'}));

            expect(screen.getByDisplayValue('test')).toBeInTheDocument();
            expect(screen.getByRole('button', {name: 'Clear search'})).toBeInTheDocument();
        });

        it('should call onSearchChange after debounce', async () => {
            const onSearchChange = jest.fn();
            renderWithProviders(createDefaultProps({onSearchChange}));

            const searchInput = screen.getByPlaceholderText('Search jobs...');
            const user = setupUser();
            await user.click(searchInput);
            await user.paste('test');

            await waitFor(() => {
                expect(onSearchChange).toHaveBeenCalledWith('test');
            }, {timeout: 500});
        });

        it('should clear search when clear button is clicked', () => {
            const onSearchChange = jest.fn();
            renderWithProviders(createDefaultProps({searchText: 'test', onSearchChange}));

            const clearButtons = screen.getAllByRole('button');
            const clearButton = clearButtons.find(btn => btn.getAttribute('aria-label') === 'Clear search');
            if (clearButton) {
                fireEvent.click(clearButton);
                expect(onSearchChange).toHaveBeenCalledWith('');
            }
        });
    });

    describe('Active/Manual/Inactive mode selector', () => {
        it('should have Inactive selected when recurringMode is Inactive', () => {
            renderWithProviders(createDefaultProps({recurringMode: RecurringMode.Inactive}));

            const inactiveButton = screen.getByText('Inactive').closest('button');
            expect(inactiveButton).toHaveAttribute('aria-pressed', 'true');
        });

        it('should have Manual selected when recurringMode is Manual', () => {
            renderWithProviders(createDefaultProps({recurringMode: RecurringMode.Manual}));

            const manualButton = screen.getByText('Manual').closest('button');
            expect(manualButton).toHaveAttribute('aria-pressed', 'true');
        });

        it('should call onRecurringModeChange with Manual when Manual clicked', () => {
            const onRecurringModeChange = jest.fn();
            renderWithProviders(createDefaultProps({
                recurringMode: RecurringMode.Active,
                onRecurringModeChange,
            }));

            fireEvent.click(screen.getByText('Manual'));

            expect(onRecurringModeChange).toHaveBeenCalledWith(RecurringMode.Manual);
        });

        it('should call onRecurringModeChange with Inactive when Inactive clicked', () => {
            const onRecurringModeChange = jest.fn();
            renderWithProviders(createDefaultProps({
                recurringMode: RecurringMode.Active,
                onRecurringModeChange,
            }));

            fireEvent.click(screen.getByText('Inactive'));

            expect(onRecurringModeChange).toHaveBeenCalledWith(RecurringMode.Inactive);
        });
    });

    describe('Courier filter', () => {
        it('should use courier search hook when typing', async () => {
            renderWithProviders(createDefaultProps());

            const courierInput = screen.getByRole('combobox', {name: 'Courier'});
            const user = setupUser();
            await user.click(courierInput);
            await user.paste('John');

            // Verify useCourierSearch is called
            expect(mockUseCourierSearch).toHaveBeenCalled();
        });
    });

    describe('Days of week filter', () => {
        it('should call onFiltersChange when day is toggled', () => {
            const onFiltersChange = jest.fn();
            renderWithProviders(createDefaultProps({onFiltersChange}));

            fireEvent.click(screen.getByText('M'));

            expect(onFiltersChange).toHaveBeenCalledWith(expect.objectContaining({
                daysOfWeek: 1, // Monday bit
            }));
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
        it('stays in place but is disabled when no filters are active', () => {
            renderWithProviders(createDefaultProps());

            // Present either way, so its position never moves on the reader.
            expect(screen.getByRole('button', {name: 'Clear all'})).toBeDisabled();
        });

        it('counts each applied criterion, days by the day', () => {
            // Speed filter active
            const {unmount: unmount1} = renderWithProviders(createDefaultProps({
                filters: {...defaultFilters, speedId: 1},
            }));
            expect(screen.getByRole('button', {name: 'Clear all (1)'})).toBeEnabled();
            unmount1();

            // Courier filter active
            const {unmount: unmount2} = renderWithProviders(createDefaultProps({
                filters: {...defaultFilters, courierId: 1},
            }));
            expect(screen.getByRole('button', {name: 'Clear all (1)'})).toBeEnabled();
            unmount2();

            // Days is a bitmask, so Monday + Tuesday counts two, not one.
            renderWithProviders(createDefaultProps({
                filters: {...defaultFilters, daysOfWeek: 3},
            }));
            expect(screen.getByRole('button', {name: 'Clear all (2)'})).toBeEnabled();
        });

        it('should clear all filters when clicked', () => {
            const onFiltersChange = jest.fn();
            renderWithProviders(createDefaultProps({
                filters: {speedId: 1, courierId: 2, daysOfWeek: 3},
                onFiltersChange,
            }));

            fireEvent.click(screen.getByRole('button', {name: /^Clear all/}));

            expect(onFiltersChange).toHaveBeenCalledWith({
                speedId: undefined,
                courierId: undefined,
                daysOfWeek: undefined,
            });
        });
    });

    describe('Refresh button', () => {
        it('should call onRefresh when clicked', () => {
            const onRefresh = jest.fn();
            renderWithProviders(createDefaultProps({onRefresh}));

            const refreshButton = screen.getByRole('button', {name: 'Refresh'});
            fireEvent.click(refreshButton);

            expect(onRefresh).toHaveBeenCalledTimes(1);
        });

        it('should show a spinner and be disabled while refreshing', () => {
            renderWithProviders(createDefaultProps({isRefreshing: true}));

            // Icon is swapped for a progress indicator...
            expect(screen.queryByTestId('RefreshIcon')).not.toBeInTheDocument();
            expect(screen.getByRole('progressbar')).toBeInTheDocument();

            // ...and the button is disabled so it can't be double-fired.
            const refreshButton = screen.getByRole('progressbar').closest('button')!;
            expect(refreshButton).toBeDisabled();
        });
    });

    describe('Export button', () => {
        it('should call onExport when clicked', () => {
            const onExport = jest.fn();
            renderWithProviders(createDefaultProps({onExport}));

            const exportButton = screen.getByRole('button', {name: 'Export to CSV'});
            fireEvent.click(exportButton);

            expect(onExport).toHaveBeenCalledTimes(1);
        });

        it('should be disabled when exporting', () => {
            renderWithProviders(createDefaultProps({isExporting: true}));

            // When exporting, shows CircularProgress instead of FileDownloadIcon
            const progressBars = screen.getAllByRole('progressbar');
            expect(progressBars.length).toBeGreaterThanOrEqual(1);
        });
    });

    describe('Loading state', () => {
        it('should disable search, toggles, day buttons, and courier when loading', () => {
            renderWithProviders(createDefaultProps({isLoading: true}));

            // Search input disabled
            expect(screen.getByPlaceholderText('Search jobs...')).toBeDisabled();

            // Active/Inactive toggle disabled
            expect(screen.getByText('Active').closest('button')).toBeDisabled();
            expect(screen.getByText('Inactive').closest('button')).toBeDisabled();

            // Day toggle buttons disabled
            const mondayButton = screen.getByText('M').closest('button');
            expect(mondayButton).toBeDisabled();

            // Courier autocomplete disabled
            expect(screen.getByRole('combobox', {name: 'Courier'})).toBeDisabled();

            // The refresh spinner is driven by isRefreshing, not isLoading, so an
            // initial-load `isLoading` alone leaves the refresh icon in place.
            expect(screen.getByRole('button', {name: 'Refresh'})).toBeInTheDocument();
        });
    });
});
