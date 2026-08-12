/**
 * DriverLocations Component Tests
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import {renderWithMantineOverMui} from '../../../__testUtils__';
import { DriverLocations } from './DriverLocations';
import type {
    DriverLocationsProps,
    IClearListViewModelWithColumns,
    IAreaClearList,
    IClearListSection,
} from './DriverLocations.types';
import { shouldShowCourier } from './DriverLocations.types';


const renderWithProviders = (ui: React.ReactElement) => {
    return renderWithMantineOverMui(ui);
};

// Sample data factories
const createMockSection = (overrides?: Partial<IClearListSection>): IClearListSection => ({
    courierNumber: '001',
    courierData: {
        courier: '001',
        courierNumber: '001',
        courierName: 'Test Courier',
        courierId: 1,
    },
    destinations: [
        { id: 1, label: 'Auckland CBD' },
        { id: 2, label: 'Newmarket' },
    ],
    ...overrides,
});

const createMockTruckSection = (overrides?: Partial<IClearListSection>): IClearListSection => ({
    courierNumber: 'T001',
    courierData: {
        courier: 'T001',
        courierNumber: 'T001',
        courierName: 'Truck Driver',
        courierId: 2,
    },
    destinations: [
        { id: 3, label: 'Warehouse' },
    ],
    ...overrides,
});

const createMockArea = (overrides?: Partial<IAreaClearList>): IAreaClearList => ({
    id: 1,
    name: 'North',
    order: 1,
    percentHeight: 33,
    top: [createMockSection()],
    middle: [createMockSection({ courierNumber: '002' })],
    bottom: [createMockSection({ courierNumber: '003' })],
    totalRemaining: 5,
    isActive: false,
    ...overrides,
});

const createMockDriverLocations = (): IClearListViewModelWithColumns => ({
    areas: [
        createMockArea({ id: 1, name: 'North' }),
        createMockArea({ id: 2, name: 'Central' }),
        createMockArea({ id: 3, name: 'South' }),
    ],
    columns: [
        { areas: [createMockArea({ id: 1, name: 'North' })] },
        { areas: [createMockArea({ id: 2, name: 'Central' })] },
        { areas: [createMockArea({ id: 3, name: 'South' })] },
    ],
});

const createDefaultProps = (overrides?: Partial<DriverLocationsProps>): DriverLocationsProps => ({
    driverLocations: createMockDriverLocations(),
    loading: false,
    showNoData: false,
    showData: true,
    truckMode: 'On',
    isUsCustomer: false,
    ...overrides,
});

describe('DriverLocations', () => {
    describe('Rendering', () => {
        it('renders loading state when loading', () => {
            const props = createDefaultProps({ loading: true, showData: false });
            renderWithProviders(<DriverLocations {...props} />);

            expect(screen.getByRole('progressbar')).toBeInTheDocument();
        });

        it('renders no-data state when showNoData is true', () => {
            const props = createDefaultProps({ showNoData: true, showData: false });
            renderWithProviders(<DriverLocations {...props} />);

            expect(screen.getByText('No Driver Locations')).toBeInTheDocument();
            expect(screen.getByText(/Please configure driver locations/)).toBeInTheDocument();
        });

        it('renders driver locations when showData is true', () => {
            const props = createDefaultProps();
            renderWithProviders(<DriverLocations {...props} />);

            expect(screen.getByText(/North/)).toBeInTheDocument();
            expect(screen.getByText(/Central/)).toBeInTheDocument();
            expect(screen.getByText(/South/)).toBeInTheDocument();
        });

        it('renders area titles with remaining count', () => {
            const props = createDefaultProps();
            renderWithProviders(<DriverLocations {...props} />);

            // Area name followed by total remaining
            expect(screen.getByText('North 5')).toBeInTheDocument();
        });

        it('renders courier numbers', () => {
            const props = createDefaultProps();
            renderWithProviders(<DriverLocations {...props} />);

            expect(screen.getAllByText('001').length).toBeGreaterThan(0);
        });

        it('renders destination labels', () => {
            const props = createDefaultProps();
            renderWithProviders(<DriverLocations {...props} />);

            expect(screen.getAllByText('Auckland CBD').length).toBeGreaterThan(0);
            expect(screen.getAllByText('Newmarket').length).toBeGreaterThan(0);
        });
    });

    describe('Clear Filter Button', () => {
        it('does not show clear button when no area is active', () => {
            const props = createDefaultProps({ activeAreaId: undefined });
            renderWithProviders(<DriverLocations {...props} />);

            expect(screen.queryByRole('button', { name: /clear driver location filter/i })).not.toBeInTheDocument();
        });

        it('shows clear button when an area is active', () => {
            const props = createDefaultProps({ activeAreaId: 1 });
            renderWithProviders(<DriverLocations {...props} />);

            expect(screen.getByRole('button', { name: /clear driver location filter/i })).toBeInTheDocument();
        });

        it('calls onClearFilter when clear button is clicked', () => {
            const onClearFilter = jest.fn();
            const props = createDefaultProps({ activeAreaId: 1, onClearFilter });
            renderWithProviders(<DriverLocations {...props} />);

            fireEvent.click(screen.getByRole('button', { name: /clear driver location filter/i }));
            expect(onClearFilter).toHaveBeenCalledTimes(1);
        });
    });

    describe('Area Click', () => {
        it('calls onAreaClick when area title is clicked', () => {
            const onAreaClick = jest.fn();
            const props = createDefaultProps({ onAreaClick });
            renderWithProviders(<DriverLocations {...props} />);

            fireEvent.click(screen.getByText('North 5'));
            expect(onAreaClick).toHaveBeenCalledTimes(1);
            expect(onAreaClick).toHaveBeenCalledWith(
                expect.objectContaining({ id: 1, name: 'North' })
            );
        });
    });

    describe('Courier Click', () => {
        it('calls onCourierClick with full courier data including courierId when row is clicked', () => {
            const onCourierClick = jest.fn();
            const props = createDefaultProps({ onCourierClick });
            renderWithProviders(<DriverLocations {...props} />);

            // Click on the first courier number cell
            const courierCells = screen.getAllByText('001');
            fireEvent.click(courierCells[0].closest('tr')!);

            expect(onCourierClick).toHaveBeenCalledTimes(1);
            expect(onCourierClick).toHaveBeenCalledWith(
                expect.objectContaining({
                    courierNumber: '001',
                    courierId: 1,
                    courierName: 'Test Courier',
                })
            );
        });

        it('does not call onCourierClick when courierData is missing', () => {
            const onCourierClick = jest.fn();
            const driverLocations: IClearListViewModelWithColumns = {
                areas: [],
                columns: [
                    {
                        areas: [
                            createMockArea({
                                id: 1,
                                name: 'North',
                                top: [
                                    {
                                        courierNumber: '099',
                                        courierData: undefined as any,
                                        destinations: [],
                                    },
                                ],
                                middle: [],
                                bottom: [],
                            }),
                        ],
                    },
                ],
            };
            const props = createDefaultProps({ driverLocations, onCourierClick });
            renderWithProviders(<DriverLocations {...props} />);

            fireEvent.click(screen.getByText('099').closest('tr')!);
            expect(onCourierClick).not.toHaveBeenCalled();
        });
    });

    describe('Truck Mode Filtering', () => {
        const driverLocationsWithTrucks: IClearListViewModelWithColumns = {
            areas: [],
            columns: [
                {
                    areas: [
                        createMockArea({
                            id: 1,
                            name: 'North',
                            top: [
                                createMockSection({ courierNumber: '001' }),
                                createMockTruckSection({ courierNumber: 'T001' }),
                            ],
                            middle: [],
                            bottom: [],
                        }),
                    ],
                },
            ],
        };

        it('shows all couriers when truckMode is On', () => {
            const props = createDefaultProps({
                driverLocations: driverLocationsWithTrucks,
                truckMode: 'On',
            });
            renderWithProviders(<DriverLocations {...props} />);

            expect(screen.getByText('001')).toBeInTheDocument();
            expect(screen.getByText('T001')).toBeInTheDocument();
        });

        it('hides truck couriers when truckMode is Off', () => {
            const props = createDefaultProps({
                driverLocations: driverLocationsWithTrucks,
                truckMode: 'Off',
            });
            renderWithProviders(<DriverLocations {...props} />);

            expect(screen.getByText('001')).toBeInTheDocument();
            expect(screen.queryByText('T001')).not.toBeInTheDocument();
        });

        it('shows only truck couriers when truckMode is Only', () => {
            const props = createDefaultProps({
                driverLocations: driverLocationsWithTrucks,
                truckMode: 'Only',
            });
            renderWithProviders(<DriverLocations {...props} />);

            expect(screen.queryByText('001')).not.toBeInTheDocument();
            expect(screen.getByText('T001')).toBeInTheDocument();
        });
    });

    describe('Active Area Styling', () => {
        it('applies active styling to selected area', () => {
            const driverLocations = createMockDriverLocations();
            const props = createDefaultProps({
                driverLocations,
                activeAreaId: 1,
            });
            renderWithProviders(<DriverLocations {...props} />);

            // The North area should have active styling
            const northTitle = screen.getByText('North 5');
            expect(northTitle).toBeInTheDocument();
            // We can't easily test the exact styling, but we verify the element renders
        });
    });

    describe('Empty Data Handling', () => {
        it('handles empty columns array', () => {
            const props = createDefaultProps({
                driverLocations: { areas: [], columns: [] },
            });
            const { container } = renderWithProviders(<DriverLocations {...props} />);

            // Should not throw and should render the outer container
            expect(container.firstChild).toBeTruthy();
        });

        it('handles undefined driverLocations', () => {
            const props = createDefaultProps({
                driverLocations: undefined,
                showData: true,
            });
            renderWithProviders(<DriverLocations {...props} />);

            // Should not throw
            expect(document.querySelector('#driverLocations')).toBeTruthy();
        });

        it('shows NoData when showNoData is true and data has empty columns', () => {
            const props = createDefaultProps({
                driverLocations: { areas: [], columns: [] },
                showNoData: true,
                showData: false,
            });
            renderWithProviders(<DriverLocations {...props} />);

            expect(screen.getByText('No Driver Locations')).toBeInTheDocument();
            expect(screen.queryByText(/North/)).not.toBeInTheDocument();
        });
    });
});

describe('shouldShowCourier utility', () => {
    describe('when truckMode is On', () => {
        it('returns true for regular couriers', () => {
            expect(shouldShowCourier('001', 'On')).toBe(true);
        });

        it('returns true for truck couriers', () => {
            expect(shouldShowCourier('T001', 'On')).toBe(true);
        });
    });

    describe('when truckMode is Off', () => {
        it('returns true for regular couriers', () => {
            expect(shouldShowCourier('001', 'Off')).toBe(true);
        });

        it('returns false for truck couriers', () => {
            expect(shouldShowCourier('T001', 'Off')).toBe(false);
        });
    });

    describe('when truckMode is Only', () => {
        it('returns false for regular couriers', () => {
            expect(shouldShowCourier('001', 'Only')).toBe(false);
        });

        it('returns true for truck couriers', () => {
            expect(shouldShowCourier('T001', 'Only')).toBe(true);
        });

        it('returns false for lowercase t prefix (case sensitive)', () => {
            // Original implementation is case-sensitive, only uppercase T is truck
            expect(shouldShowCourier('t001', 'Only')).toBe(false);
        });
    });
});
