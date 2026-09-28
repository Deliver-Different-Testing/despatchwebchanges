/**
 * Tests for FilterPanel React component
 * Optimised: read-only tests consolidated to reduce render count.
 */

import React from 'react';
import {render, screen, fireEvent, waitFor} from '@testing-library/react';
import {MantineTestProvider} from '../../../__testUtils__';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {FilterPanel} from './FilterPanel';
import type {ISuggestion, DateRange} from '../OverviewPage.interfaces';

jest.mock('../../../services/overviewApi', () => ({
    overviewApi: {
        searchCouriers: jest.fn(),
    },
}));

// The date-range dialog ships as a separate lazy-loaded bundle. FilterPanel must
// ensure that bundle is loaded (which registers window.ReactDateRangeDialog)
// before opening it — otherwise clicking "Select Dates" does nothing.
const mockEnsureDateRangeDialog = jest.fn();
jest.mock('../../../components/common/job-details/hooks/useDialogLoader', () => ({
    useDialogLoader: () => ({
        ensureDateRangeDialog: mockEnsureDateRangeDialog,
    }),
}));


const createTestQueryClient = () =>
    new QueryClient({
        defaultOptions: {queries: {retry: false, gcTime: 0}},
    });

const renderWithProviders = (ui: React.ReactElement) => {
    const queryClient = createTestQueryClient();
    return render(
        <QueryClientProvider client={queryClient}>
            <MantineTestProvider>{ui}</MantineTestProvider>
        </QueryClientProvider>,
    );
};

const mockRegions: ISuggestion[] = [
    {id: 1, text: 'London'},
    {id: 2, text: 'Manchester'},
    {id: 3, text: 'Birmingham'},
];

const mockSpeeds: ISuggestion[] = [
    {id: 1, text: 'Same Day'},
    {id: 2, text: 'Next Day'},
];

const defaultProps = {
    regions: mockRegions,
    regionsLoading: false,
    selectedRegionIds: new Set<number>(),
    allRegionsSelected: false,
    onToggleRegion: jest.fn(),
    onToggleAllRegions: jest.fn(),
    speeds: mockSpeeds,
    speedsLoading: false,
    selectedSpeedIds: new Set<number>(),
    allSpeedsSelected: false,
    onToggleSpeed: jest.fn(),
    onToggleAllSpeeds: jest.fn(),
    selectedCouriers: [] as ISuggestion[],
    onAddCourier: jest.fn(),
    onRemoveCourier: jest.fn(),
    dateRange: {} as DateRange,
    onDateRangeChange: jest.fn(),
    onClearAll: jest.fn(),
};

describe('FilterPanel', () => {
    it('renders all default sections, headers, checkboxes, and controls', () => {
        renderWithProviders(<FilterPanel {...defaultProps} />);

        // Quick Filters header
        expect(screen.getByText('Quick Filters')).toBeInTheDocument();

        // Date Range section
        expect(screen.getByText('Date range')).toBeInTheDocument();
        expect(screen.getByText('Select dates')).toBeInTheDocument();

        // Regions section — a field label above its options, not a header bar.
        expect(screen.getByText('Regions')).toBeInTheDocument();
        expect(screen.getByText('London')).toBeInTheDocument();
        expect(screen.getByText('Manchester')).toBeInTheDocument();
        expect(screen.getByText('Birmingham')).toBeInTheDocument();

        // Speeds section
        expect(screen.getByText('Speeds')).toBeInTheDocument();
        expect(screen.getByText('Same Day')).toBeInTheDocument();
        expect(screen.getByText('Next Day')).toBeInTheDocument();

        // Couriers section — the same ChipsAutocomplete job search uses.
        expect(screen.getByText('Couriers')).toBeInTheDocument();
        // ChipsAutocomplete is a MultiSelect, so its input is a combobox — the
        // same handle its own test uses.
        expect(screen.getByRole('combobox')).toBeInTheDocument();

        // Regions and Speeds each carry their own select-all beside the label.
        expect(screen.getAllByText('Select all')).toHaveLength(2);
    });

    it('reports how many options each multi-select group has chosen', () => {
        renderWithProviders(
            <FilterPanel
                {...defaultProps}
                selectedRegionIds={new Set([1, 2])}
                selectedSpeedIds={new Set([1])}
                selectedCouriers={[{id: 7, text: 'Courier A'}]}
            />,
        );

        // The count sits beside its own label, so scope each assertion to the
        // group rather than trusting document order.
        const countFor = (label: string) =>
            screen.getByText(label).parentElement?.textContent?.replace(label, '');

        expect(countFor('Regions')).toBe('2');
        expect(countFor('Speeds')).toBe('1');
        expect(countFor('Couriers')).toBe('1');
    });

    it('shows no count on a group with nothing chosen', () => {
        renderWithProviders(<FilterPanel {...defaultProps} />);

        expect(screen.getByText('Regions').parentElement?.textContent).toBe('Regions');
    });

    describe('Clear all', () => {
        it('stays in place but is disabled when nothing is applied', () => {
            renderWithProviders(<FilterPanel {...defaultProps} />);

            // Present either way, so its position never moves on the reader.
            expect(screen.getByRole('button', {name: 'Clear all'})).toBeDisabled();
        });

        it('counts every applied criterion and clears them', () => {
            const onClearAll = jest.fn();
            renderWithProviders(
                <FilterPanel
                    {...defaultProps}
                    onClearAll={onClearAll}
                    dateRange={{start: new Date('2024-01-15')}}
                    selectedRegionIds={new Set([1, 2])}
                    selectedSpeedIds={new Set([1])}
                    selectedCouriers={[{id: 7, text: 'Courier A'}]}
                />,
            );

            // 1 date + 2 regions + 1 speed + 1 courier.
            const clearAll = screen.getByRole('button', {name: 'Clear all (5)'});
            expect(clearAll).toBeEnabled();

            fireEvent.click(clearAll);
            expect(onClearAll).toHaveBeenCalledTimes(1);
        });
    });

    describe('Date Range section', () => {
        it('shows formatted date range when dates are set', () => {
            renderWithProviders(
                <FilterPanel
                    {...defaultProps}
                    dateRange={{
                        start: new Date('2024-01-15'),
                        end: new Date('2024-01-31'),
                    }}
                />,
            );

            expect(screen.getByText(/Jan 15, 2024/)).toBeInTheDocument();
            expect(screen.getByText(/Jan 31, 2024/)).toBeInTheDocument();
        });

        describe('opening the dialog', () => {
            const mockOpen = jest.fn();

            beforeEach(() => {
                mockEnsureDateRangeDialog.mockReset();
                mockOpen.mockReset();
                delete (window as {ReactDateRangeDialog?: unknown}).ReactDateRangeDialog;
                // Loading the bundle registers the global — mirror that side effect.
                mockEnsureDateRangeDialog.mockImplementation(async () => {
                    (window as {ReactDateRangeDialog?: unknown}).ReactDateRangeDialog = {open: mockOpen};
                });
            });

            it('loads the dialog bundle then opens it and applies the result', async () => {
                mockOpen.mockResolvedValue({
                    start: new Date('2024-02-01'),
                    end: new Date('2024-02-05'),
                });
                const onDateRangeChange = jest.fn();
                renderWithProviders(
                    <FilterPanel {...defaultProps} onDateRangeChange={onDateRangeChange} />,
                );

                fireEvent.click(screen.getByText('Select dates'));

                await waitFor(() => expect(mockEnsureDateRangeDialog).toHaveBeenCalled());
                await waitFor(() => expect(mockOpen).toHaveBeenCalled());
                await waitFor(() =>
                    expect(onDateRangeChange).toHaveBeenCalledWith({
                        start: new Date('2024-02-01'),
                        end: new Date('2024-02-05'),
                    }),
                );
            });

            it('does not change the range when the dialog is cancelled', async () => {
                mockOpen.mockResolvedValue(null);
                const onDateRangeChange = jest.fn();
                renderWithProviders(
                    <FilterPanel {...defaultProps} onDateRangeChange={onDateRangeChange} />,
                );

                fireEvent.click(screen.getByText('Select dates'));

                await waitFor(() => expect(mockOpen).toHaveBeenCalled());
                expect(onDateRangeChange).not.toHaveBeenCalled();
            });
        });
    });

    describe('Regions section', () => {
        it('shows loading indicator when regions loading', () => {
            renderWithProviders(<FilterPanel {...defaultProps} regionsLoading />);

            expect(screen.getByRole('progressbar')).toBeInTheDocument();
            // Regions should not be visible while loading
            expect(screen.queryByText('London')).not.toBeInTheDocument();
        });

        it('shows empty state when no regions', () => {
            renderWithProviders(<FilterPanel {...defaultProps} regions={[]} />);
            expect(screen.getByText('No regions found')).toBeInTheDocument();
        });

        it('calls onToggleRegion when checkbox clicked', () => {
            renderWithProviders(<FilterPanel {...defaultProps} />);

            const londonCheckbox = screen.getByRole('checkbox', {name: 'London'});
            fireEvent.click(londonCheckbox);

            expect(defaultProps.onToggleRegion).toHaveBeenCalledWith(1);
        });

        it('shows Unselect All when all regions selected', () => {
            renderWithProviders(<FilterPanel {...defaultProps} allRegionsSelected />);
            expect(screen.getByText('Unselect all')).toBeInTheDocument();
        });

        it('calls onToggleAllRegions when Select All clicked', () => {
            // Set allSpeedsSelected so speeds shows "Unselect All", leaving only regions with "Select All"
            renderWithProviders(<FilterPanel {...defaultProps} allSpeedsSelected />);

            const selectAllCheckbox = screen.getByRole('checkbox', {name: 'Select all regions'});
            fireEvent.click(selectAllCheckbox);

            expect(defaultProps.onToggleAllRegions).toHaveBeenCalled();
        });

        it('checks selected region checkboxes', () => {
            renderWithProviders(
                <FilterPanel {...defaultProps} selectedRegionIds={new Set([1, 3])} />,
            );

            const londonCheckbox = screen.getByRole('checkbox', {name: 'London'});
            const manchesterCheckbox = screen.getByRole('checkbox', {name: 'Manchester'});
            const birminghamCheckbox = screen.getByRole('checkbox', {name: 'Birmingham'});

            expect(londonCheckbox).toBeChecked();
            expect(manchesterCheckbox).not.toBeChecked();
            expect(birminghamCheckbox).toBeChecked();
        });
    });

    describe('Speeds section', () => {
        it('shows empty state when no speeds', () => {
            renderWithProviders(<FilterPanel {...defaultProps} speeds={[]} />);
            expect(screen.getByText('No speeds found')).toBeInTheDocument();
        });

        it('calls onToggleSpeed when checkbox clicked', () => {
            renderWithProviders(<FilterPanel {...defaultProps} />);

            const sameDayCheckbox = screen.getByRole('checkbox', {name: 'Same Day'});
            fireEvent.click(sameDayCheckbox);

            expect(defaultProps.onToggleSpeed).toHaveBeenCalledWith(1);
        });
    });

    describe('Couriers section', () => {
        it('renders selected courier chips', () => {
            renderWithProviders(
                <FilterPanel
                    {...defaultProps}
                    selectedCouriers={[
                        {id: 1, text: 'Courier A'},
                        {id: 2, text: 'Courier B'},
                    ]}
                />,
            );

            expect(screen.getByText('Courier A')).toBeInTheDocument();
            expect(screen.getByText('Courier B')).toBeInTheDocument();
        });

        it('calls onRemoveCourier when chip delete clicked', () => {
            renderWithProviders(
                <FilterPanel
                    {...defaultProps}
                    selectedCouriers={[{id: 1, text: 'Courier A'}]}
                />,
            );

            // Mantine marks a Pill's remove button aria-hidden by design, so its
            // class is the only handle — the same one ChipsAutocomplete's own test
            // uses. The keyboard path (Backspace) is covered there too.
            const deleteButton = document.querySelector<HTMLElement>('.mantine-Pill-remove')!;
            fireEvent.click(deleteButton);

            expect(defaultProps.onRemoveCourier).toHaveBeenCalledWith(1);
        });
    });
});
