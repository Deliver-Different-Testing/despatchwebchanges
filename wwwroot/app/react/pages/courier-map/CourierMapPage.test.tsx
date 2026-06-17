/**
 * CourierMapPage Component Tests
 *
 * Tests for the CourierMapPage React component.
 */

import React from 'react';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {createTheme, ThemeProvider} from '@mui/material/styles';
import {CourierMapPage} from './CourierMapPage';
import type {CourierMapPageProps} from './CourierMapPage.types';
import * as courierApi from '../../services/courierApi';

// Mock the courier API
jest.mock('../../services/courierApi', () => ({
    getAvailableCourierLocations: jest.fn(),
    getAllFleetOptions: jest.fn(),
}));

// Mock useCourierMap hook
jest.mock('./useCourierMap', () => ({
    useCourierMap: jest.fn(() => ({
        mapContainerRef: {current: document.createElement('div')},
        isInitialized: true,
        map: null,
        platform: null,
        defaultLayers: null,
        updateCouriers: jest.fn(),
        centerOnCourier: jest.fn(),
        returnToOverview: jest.fn(),
    })),
}));

const theme = createTheme();

function createTestQueryClient(): QueryClient {
    return new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
                gcTime: 0,
                staleTime: 0,
            },
        },
    });
}

const renderWithProviders = (ui: React.ReactElement, queryClient?: QueryClient) => {
    const client = queryClient ?? createTestQueryClient();
    return render(
        <QueryClientProvider client={client}>
            <ThemeProvider theme={theme}>{ui}</ThemeProvider>
        </QueryClientProvider>
    );
};

interface CourierMapPageInternalProps extends CourierMapPageProps {
    apiKey: string | null;
}

const createDefaultProps = (overrides?: Partial<CourierMapPageInternalProps>): CourierMapPageInternalProps => ({
    isUsCustomer: true,
    mapCenter: {lat: 39.8097343, lng: -98.5556199},
    apiKey: 'test-api-key',
    ...overrides,
});

const mockCouriers = [
    {
        courierId: 1,
        courierInitials: 'JS',
        courierName: 'John Smith',
        firstName: 'John',
        lastName: 'Smith',
        latitude: 40.7128,
        longitude: -74.006,
        jobCount: 3,
        totalJobs: 3,
        overdueJobCount: 0,
        isUrgentArmy: false,
        code: 'JS001',
    },
    {
        courierId: 2,
        courierInitials: 'JD',
        courierName: 'Jane Doe',
        firstName: 'Jane',
        lastName: 'Doe',
        latitude: 34.0522,
        longitude: -118.2437,
        jobCount: 1,
        totalJobs: 1,
        overdueJobCount: 1,
        isUrgentArmy: true,
        code: 'JD001',
    },
];

const mockFleetOptions = [
    {id: 32, text: 'UA Auckland'},
    {id: 34, text: 'UA Wellington'},
    {id: 39, text: 'Regional'},
    {id: 66, text: 'Auckland Cool'},
];

describe('CourierMapPage Component', () => {
    beforeEach(() => {
        (courierApi.getAvailableCourierLocations as jest.Mock).mockResolvedValue(mockCouriers);
        (courierApi.getAllFleetOptions as jest.Mock).mockResolvedValue(mockFleetOptions);
    });

    describe('Rendering', () => {
        it('renders without crashing', () => {
            const props = createDefaultProps();
            const {container} = renderWithProviders(<CourierMapPage {...props} />);
            expect(container).toBeInTheDocument();
        });

        it('renders map container', () => {
            const props = createDefaultProps();
            const {container} = renderWithProviders(<CourierMapPage {...props} />);
            // The component renders a div container - check container has children
            expect(container.firstChild).toBeInTheDocument();
        });

        it('renders drivers panel', async () => {
            const props = createDefaultProps();
            renderWithProviders(<CourierMapPage {...props} />);

            expect(await screen.findByText(/Drivers/i)).toBeInTheDocument();
        });

        it('renders map controls', () => {
            const props = createDefaultProps();
            renderWithProviders(<CourierMapPage {...props} />);

            // Should have fit-all and refresh buttons
            expect(screen.getByLabelText('Return to overview')).toBeInTheDocument();
            expect(screen.getByLabelText('Refresh data')).toBeInTheDocument();
        });

        it('has a single refresh control (no duplicate in the drivers panel)', () => {
            const props = createDefaultProps();
            renderWithProviders(<CourierMapPage {...props} />);

            // Refresh now lives only in the map controls; the drivers panel header
            // no longer carries its own (previously duplicate) refresh button.
            const refreshButtons = screen.getAllByRole('button', {name: /refresh/i});
            expect(refreshButtons).toHaveLength(1);
            expect(refreshButtons[0]).toHaveAccessibleName('Refresh data');
        });

        it('renders the shared zoom/layer rail once the map is ready', () => {
            const useCourierMapMock = require('./useCourierMap').useCourierMap as jest.Mock;
            useCourierMapMock.mockReturnValue({
                mapContainerRef: {current: document.createElement('div')},
                isInitialized: true,
                map: {getZoom: jest.fn(() => 5), setZoom: jest.fn()},
                platform: {},
                defaultLayers: {},
                updateCouriers: jest.fn(),
                centerOnCourier: jest.fn(),
                returnToOverview: jest.fn(),
            });

            const props = createDefaultProps();
            renderWithProviders(<CourierMapPage {...props} />);

            // MapZoomViewControls (shared with the dispatch map) provides MUI zoom buttons
            expect(screen.getByLabelText('Zoom in')).toBeInTheDocument();
            expect(screen.getByLabelText('Zoom out')).toBeInTheDocument();
        });
    });

    describe('Props', () => {
        it('accepts isUsCustomer prop', () => {
            const props = createDefaultProps({isUsCustomer: true});
            const {container} = renderWithProviders(<CourierMapPage {...props} />);
            expect(container).toBeInTheDocument();
        });

        it('accepts mapCenter prop', () => {
            const props = createDefaultProps({mapCenter: {lat: 40.7128, lng: -74.006}});
            const {container} = renderWithProviders(<CourierMapPage {...props} />);
            expect(container).toBeInTheDocument();
        });

        it('accepts apiKey prop', () => {
            const props = createDefaultProps({apiKey: 'custom-api-key'});
            const {container} = renderWithProviders(<CourierMapPage {...props} />);
            expect(container).toBeInTheDocument();
        });

        it('renders with null apiKey', () => {
            const props = createDefaultProps({apiKey: null});
            const {container} = renderWithProviders(<CourierMapPage {...props} />);
            expect(container).toBeInTheDocument();
        });
    });

    describe('API Integration', () => {
        it('fetches courier locations on mount', async () => {
            const props = createDefaultProps();
            renderWithProviders(<CourierMapPage {...props} />);

            await waitFor(() => {
                expect(courierApi.getAvailableCourierLocations).toHaveBeenCalled();
            });
        });

        it('uses US bounds when isUsCustomer is true', async () => {
            const props = createDefaultProps({isUsCustomer: true});
            renderWithProviders(<CourierMapPage {...props} />);

            await waitFor(() => {
                expect(courierApi.getAvailableCourierLocations).toHaveBeenCalledWith(
                    -125, // minLng
                    24, // minLat
                    -65, // maxLng
                    50, // maxLat
                    [] // courierFleetIds — none selected
                );
            });
        });

        it('uses NZ bounds when isUsCustomer is false', async () => {
            const props = createDefaultProps({isUsCustomer: false});
            renderWithProviders(<CourierMapPage {...props} />);

            await waitFor(() => {
                expect(courierApi.getAvailableCourierLocations).toHaveBeenCalledWith(
                    165, // minLng
                    -47, // minLat
                    180, // maxLng
                    -34, // maxLat
                    [] // courierFleetIds — none selected
                );
            });
        });

        it('fetches fleet options on mount', async () => {
            const props = createDefaultProps();
            renderWithProviders(<CourierMapPage {...props} />);

            await waitFor(() => {
                expect(courierApi.getAllFleetOptions).toHaveBeenCalled();
            });
        });
    });

    describe('Drivers Panel Interaction', () => {
        it('can toggle panel visibility', async () => {
            const props = createDefaultProps();
            renderWithProviders(<CourierMapPage {...props} />);

            // Find toggle button (chevron)
            const toggleButton = screen.getByLabelText(/toggle drivers panel/i);

            fireEvent.click(toggleButton);

            // Panel should be hidden (implementation specific)
            await waitFor(() => {
                expect(toggleButton).toBeInTheDocument();
            });
        });

        it('filters drivers by search term', async () => {
            const props = createDefaultProps();
            renderWithProviders(<CourierMapPage {...props} />);

            const searchInput = screen.getByPlaceholderText(/search by name or code/i);

            fireEvent.change(searchInput, {target: {value: 'John'}});

            // Search input should update
            expect(searchInput).toHaveValue('John');
        });
    });

    describe('Map Controls Interaction', () => {
        it('calls returnToOverview when fit-all button is clicked', async () => {
            const mockReturnToOverview = jest.fn();
            const useCourierMapMock = require('./useCourierMap').useCourierMap as jest.Mock;
            useCourierMapMock.mockReturnValue({
                mapContainerRef: {current: document.createElement('div')},
                isInitialized: true,
                updateCouriers: jest.fn(),
                centerOnCourier: jest.fn(),
                returnToOverview: mockReturnToOverview,
            });

            const props = createDefaultProps();
            renderWithProviders(<CourierMapPage {...props} />);

            const fitAllButton = screen.getByLabelText('Return to overview');
            fireEvent.click(fitAllButton);

            expect(mockReturnToOverview).toHaveBeenCalled();
        });

        it('refresh button is clickable', async () => {
            const props = createDefaultProps();
            renderWithProviders(<CourierMapPage {...props} />);

            // Initial fetch
            await waitFor(() => {
                expect(courierApi.getAvailableCourierLocations).toHaveBeenCalled();
            });

            const refreshButton = screen.getByLabelText('Refresh data');
            // Button should be present and clickable
            expect(refreshButton).toBeInTheDocument();
            fireEvent.click(refreshButton);
            // The click shouldn't throw
        });
    });

    describe('Driver Click Handling', () => {
        it('calls centerOnCourier when a driver is clicked', async () => {
            const mockCenterOnCourier = jest.fn();
            const useCourierMapMock = require('./useCourierMap').useCourierMap as jest.Mock;
            useCourierMapMock.mockReturnValue({
                mapContainerRef: {current: document.createElement('div')},
                isInitialized: true,
                updateCouriers: jest.fn(),
                centerOnCourier: mockCenterOnCourier,
                returnToOverview: jest.fn(),
            });

            const props = createDefaultProps();
            renderWithProviders(<CourierMapPage {...props} />);

            // Wait for couriers to load
            expect(await screen.findByText(/John Smith/i)).toBeInTheDocument();

            // Click on a driver in the list
            fireEvent.click(screen.getByText(/John Smith/i));

            expect(mockCenterOnCourier).toHaveBeenCalledWith(
                expect.objectContaining({courierId: 1})
            );
        });
    });

    describe('Fleet Selector', () => {
        it('renders fleet selector with "All fleets" placeholder by default', async () => {
            const props = createDefaultProps();
            renderWithProviders(<CourierMapPage {...props} />);

            expect(await screen.findByPlaceholderText('All fleets')).toBeInTheDocument();
        });

        it('passes selected fleet ids to the locations API when a fleet is chosen', async () => {
            const props = createDefaultProps({isUsCustomer: false});
            renderWithProviders(<CourierMapPage {...props} />);

            // Wait for the panel to render and fleet options to load
            const fleetInput = await screen.findByLabelText('Filter by fleet');

            // Open the dropdown (Autocomplete opens on ArrowDown) and pick "UA Wellington"
            fleetInput.focus();
            fireEvent.keyDown(fleetInput, {key: 'ArrowDown'});
            const option = await screen.findByRole('option', {name: 'UA Wellington'});
            fireEvent.click(option);

            await waitFor(() => {
                expect(courierApi.getAvailableCourierLocations).toHaveBeenLastCalledWith(
                    165,
                    -47,
                    180,
                    -34,
                    [34]
                );
            });
        });
    });

    describe('Courier Filtering', () => {
        it('filters out couriers with null coordinates', async () => {
            const couriersWithInvalid = [
                ...mockCouriers,
                {
                    courierId: 3,
                    courierInitials: 'XX',
                    firstName: 'Invalid',
                    lastName: 'Courier',
                    latitude: null,
                    longitude: null,
                    jobCount: 0,
                    overdueJobCount: 0,
                    isUrgentArmy: false,
                },
            ];
            (courierApi.getAvailableCourierLocations as jest.Mock).mockResolvedValue(
                couriersWithInvalid
            );

            const mockUpdateCouriers = jest.fn();
            const useCourierMapMock = require('./useCourierMap').useCourierMap as jest.Mock;
            useCourierMapMock.mockReturnValue({
                mapContainerRef: {current: document.createElement('div')},
                isInitialized: true,
                updateCouriers: mockUpdateCouriers,
                centerOnCourier: jest.fn(),
                returnToOverview: jest.fn(),
            });

            const props = createDefaultProps();
            renderWithProviders(<CourierMapPage {...props} />);

            await waitFor(() => {
                // updateCouriers should only receive valid couriers (2, not 3)
                expect(mockUpdateCouriers).toHaveBeenCalledWith(
                    expect.arrayContaining([
                        expect.objectContaining({courierId: 1}),
                        expect.objectContaining({courierId: 2}),
                    ])
                );
            });

            // Should not include the invalid courier
            const calls = mockUpdateCouriers.mock.calls;
            const lastCall = calls[calls.length - 1][0];
            expect(lastCall.length).toBe(2);
        });
    });
});
