/**
 * Tests for FilterPanel React component
 * Optimised: read-only tests consolidated to reduce render count.
 */

import React from 'react';
import {render, screen, fireEvent} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {ThemeProvider, createTheme} from '@mui/material/styles';
import {FilterPanel} from './FilterPanel';
import type {ISuggestion, DateRange} from '../OverviewPage.interfaces';

jest.mock('../../../services/overviewApi', () => ({
    overviewApi: {
        searchCouriers: jest.fn(),
    },
}));

const theme = createTheme();

const createTestQueryClient = () =>
    new QueryClient({
        defaultOptions: {queries: {retry: false, gcTime: 0}},
    });

const renderWithProviders = (ui: React.ReactElement) => {
    const queryClient = createTestQueryClient();
    return render(
        <QueryClientProvider client={queryClient}>
            <ThemeProvider theme={theme}>{ui}</ThemeProvider>
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
};

describe('FilterPanel', () => {
    it('renders all default sections, headers, checkboxes, and controls', () => {
        renderWithProviders(<FilterPanel {...defaultProps} />);

        // Quick Filters header
        expect(screen.getByText('Quick Filters')).toBeInTheDocument();

        // Date Range section
        expect(screen.getByText('Date Range')).toBeInTheDocument();
        expect(screen.getByText('Select Dates')).toBeInTheDocument();

        // Regions section
        expect(screen.getByText('Regions')).toBeInTheDocument();
        expect(screen.getByText('London')).toBeInTheDocument();
        expect(screen.getByText('Manchester')).toBeInTheDocument();
        expect(screen.getByText('Birmingham')).toBeInTheDocument();

        // Speeds section
        expect(screen.getByText('Speeds')).toBeInTheDocument();
        expect(screen.getByText('Same Day')).toBeInTheDocument();
        expect(screen.getByText('Next Day')).toBeInTheDocument();

        // Couriers section
        expect(screen.getByText('Couriers')).toBeInTheDocument();
        expect(screen.getByLabelText('Search couriers...')).toBeInTheDocument();

        // Select All / Unselect All toggle
        const selectAlls = screen.getAllByText('Select All');
        expect(selectAlls.length).toBeGreaterThanOrEqual(1);
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

            const londonCheckbox = screen.getByText('London').closest('label')!.querySelector('input')!;
            fireEvent.click(londonCheckbox);

            expect(defaultProps.onToggleRegion).toHaveBeenCalledWith(1);
        });

        it('shows Unselect All when all regions selected', () => {
            renderWithProviders(<FilterPanel {...defaultProps} allRegionsSelected />);
            expect(screen.getByText('Unselect All')).toBeInTheDocument();
        });

        it('calls onToggleAllRegions when Select All clicked', () => {
            // Set allSpeedsSelected so speeds shows "Unselect All", leaving only regions with "Select All"
            renderWithProviders(<FilterPanel {...defaultProps} allSpeedsSelected />);

            const selectAllCheckbox = screen.getByText('Select All').closest('label')!.querySelector('input')!;
            fireEvent.click(selectAllCheckbox);

            expect(defaultProps.onToggleAllRegions).toHaveBeenCalled();
        });

        it('checks selected region checkboxes', () => {
            renderWithProviders(
                <FilterPanel {...defaultProps} selectedRegionIds={new Set([1, 3])} />,
            );

            const londonCheckbox = screen.getByText('London').closest('label')!.querySelector('input')!;
            const manchesterCheckbox = screen.getByText('Manchester').closest('label')!.querySelector('input')!;
            const birminghamCheckbox = screen.getByText('Birmingham').closest('label')!.querySelector('input')!;

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

            const sameDayCheckbox = screen.getByText('Same Day').closest('label')!.querySelector('input')!;
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

            const chip = screen.getByText('Courier A').closest('.MuiChip-root')!;
            const deleteButton = chip.querySelector('.MuiChip-deleteIcon')!;
            fireEvent.click(deleteButton);

            expect(defaultProps.onRemoveCourier).toHaveBeenCalledWith(1);
        });
    });
});
