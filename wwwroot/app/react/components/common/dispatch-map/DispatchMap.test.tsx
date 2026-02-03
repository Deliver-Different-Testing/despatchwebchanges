/**
 * DispatchMap Component Tests
 *
 * Tests for the DispatchMap React component.
 * Component rendering tests are kept minimal to avoid memory issues with mocked H global.
 */

import React from 'react';
import {render, screen, waitFor} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {ThemeProvider, createTheme} from '@mui/material';
import {DispatchMap} from './DispatchMap';
import type {DispatchMapProps, ClearListEnvelopeData} from './DispatchMap.types';
import * as courierApi from '../../../services/courierApi';

// Mock the courier API
jest.mock('../../../services/courierApi', () => ({
    getAvailableCourierLocations: jest.fn(),
    getClearListEnvelope: jest.fn(),
}));

// Mock H global for HERE Maps
const mockH = {
    geo: {
        Rect: jest.fn().mockImplementation((top, left, bottom, right) => ({
            top,
            left,
            bottom,
            right,
        })),
    },
};
(global as any).H = mockH;

// Mock useHereMap hook to avoid HERE Maps SDK dependency
jest.mock('./useHereMap', () => ({
    useHereMap: jest.fn(() => ({
        mapContainerRef: {current: null},
        map: null,
        platform: null,
        ui: null,
        isLoading: false,
        isReady: false,
        error: null,
    })),
}));

// Mock useMapPreferences hook
jest.mock('./useMapPreferences', () => ({
    useMapPreferences: jest.fn(() => ({
        controlState: {
            autoZoomEnabled: true,
            couriersOnlyEnabled: false,
            urgentArmyOnlyEnabled: false,
            couriersLargeViewEnabled: false,
        },
        toggleAutoZoom: jest.fn(),
        toggleCouriersOnly: jest.fn(),
        toggleUrgentArmyOnly: jest.fn(),
        toggleCouriersLargeView: jest.fn(),
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

const createDefaultProps = (overrides?: Partial<DispatchMapProps>): DispatchMapProps => ({
    jobs: [],
    showAvailableCouriers: false,
    ...overrides,
});

describe('DispatchMap Component', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (courierApi.getAvailableCourierLocations as jest.Mock).mockResolvedValue([]);
        (courierApi.getClearListEnvelope as jest.Mock).mockResolvedValue({
            minimumLatitude: 33.5,
            maximumLatitude: 34.5,
            minimumLongitude: -118.5,
            maximumLongitude: -117.5,
        });
    });

    describe('Rendering', () => {
        it('renders without crashing', () => {
            const props = createDefaultProps();
            const {container} = renderWithProviders(<DispatchMap {...props} />);
            expect(container).toBeInTheDocument();
        });

        it('renders map container', () => {
            const props = createDefaultProps();
            const {container} = renderWithProviders(<DispatchMap {...props} />);
            // The component renders a Box which creates a div - check container has children
            expect(container.firstChild).toBeInTheDocument();
        });

        it('renders with jobs prop', () => {
            const mockJobs = [
                {
                    jobId: 1,
                    pickupAddress: {latitude: 40.7128, longitude: -74.006},
                    deliveryAddress: {latitude: 40.7589, longitude: -73.9851},
                },
            ];
            const props = createDefaultProps({jobs: mockJobs as any});
            const {container} = renderWithProviders(<DispatchMap {...props} />);
            expect(container).toBeInTheDocument();
        });

        it('renders with currentJob prop', () => {
            const currentJob = {
                jobId: 1,
                pickupAddress: {latitude: 40.7128, longitude: -74.006},
                deliveryAddress: {latitude: 40.7589, longitude: -73.9851},
            };
            const props = createDefaultProps({currentJob: currentJob as any});
            const {container} = renderWithProviders(<DispatchMap {...props} />);
            expect(container).toBeInTheDocument();
        });

        it('renders with mapCenter prop', () => {
            const props = createDefaultProps({mapCenter: {lat: 40.7128, lng: -74.006}});
            const {container} = renderWithProviders(<DispatchMap {...props} />);
            expect(container).toBeInTheDocument();
        });

        it('renders with mapZoom prop', () => {
            const props = createDefaultProps({mapZoom: 15});
            const {container} = renderWithProviders(<DispatchMap {...props} />);
            expect(container).toBeInTheDocument();
        });
    });

    describe('Props', () => {
        it('accepts showAvailableCouriers prop', () => {
            const props = createDefaultProps({showAvailableCouriers: true});
            const {container} = renderWithProviders(<DispatchMap {...props} />);
            expect(container).toBeInTheDocument();
        });

        it('accepts clearListId prop', () => {
            const props = createDefaultProps({clearListId: 123});
            const {container} = renderWithProviders(<DispatchMap {...props} />);
            expect(container).toBeInTheDocument();
        });

        it('accepts onEnvelopeUpdate callback prop', () => {
            const onEnvelopeUpdate = jest.fn();
            const props = createDefaultProps({onEnvelopeUpdate});
            const {container} = renderWithProviders(<DispatchMap {...props} />);
            expect(container).toBeInTheDocument();
        });

        it('accepts onMarkerClick callback prop', () => {
            const onMarkerClick = jest.fn();
            const props = createDefaultProps({onMarkerClick});
            const {container} = renderWithProviders(<DispatchMap {...props} />);
            expect(container).toBeInTheDocument();
        });
    });
});

describe('DispatchMap Clearlist Envelope Feature', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('calls getClearListEnvelope when clearListId is provided and map is ready', async () => {
        // Mock useHereMap to return a ready map
        const mockMap = {
            getViewModel: jest.fn(() => ({
                setLookAtData: jest.fn(),
            })),
        };

        const useHereMapMock = require('./useHereMap').useHereMap as jest.Mock;
        useHereMapMock.mockReturnValue({
            mapContainerRef: {current: document.createElement('div')},
            map: mockMap,
            platform: {},
            ui: {},
            isLoading: false,
            isReady: true,
            error: null,
        });

        const mockEnvelope: ClearListEnvelopeData = {
            minimumLatitude: 33.5,
            maximumLatitude: 34.5,
            minimumLongitude: -118.5,
            maximumLongitude: -117.5,
        };
        (courierApi.getClearListEnvelope as jest.Mock).mockResolvedValue(mockEnvelope);

        const onEnvelopeUpdate = jest.fn();
        const props = createDefaultProps({
            clearListId: 123,
            onEnvelopeUpdate,
        });

        renderWithProviders(<DispatchMap {...props} />);

        await waitFor(() => {
            expect(courierApi.getClearListEnvelope).toHaveBeenCalledWith(123);
        });
    });

    it('does not call getClearListEnvelope when clearListId is undefined', () => {
        const useHereMapMock = require('./useHereMap').useHereMap as jest.Mock;
        useHereMapMock.mockReturnValue({
            mapContainerRef: {current: document.createElement('div')},
            map: {},
            platform: {},
            ui: {},
            isLoading: false,
            isReady: true,
            error: null,
        });

        const props = createDefaultProps({clearListId: undefined});
        renderWithProviders(<DispatchMap {...props} />);

        expect(courierApi.getClearListEnvelope).not.toHaveBeenCalled();
    });

    it('does not call getClearListEnvelope when map is not ready', () => {
        const useHereMapMock = require('./useHereMap').useHereMap as jest.Mock;
        useHereMapMock.mockReturnValue({
            mapContainerRef: {current: null},
            map: null,
            platform: null,
            ui: null,
            isLoading: true,
            isReady: false,
            error: null,
        });

        const props = createDefaultProps({clearListId: 123});
        renderWithProviders(<DispatchMap {...props} />);

        expect(courierApi.getClearListEnvelope).not.toHaveBeenCalled();
    });
});
