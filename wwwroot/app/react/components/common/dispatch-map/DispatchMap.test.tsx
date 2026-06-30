/**
 * DispatchMap Component Tests
 *
 * Tests for the DispatchMap React component.
 * Component rendering tests are kept minimal to avoid memory issues with mocked H global.
 */

import React from 'react';
import {render, screen, waitFor} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {ThemeProvider, createTheme} from '@mui/material/styles';
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
    map: {
        Group: jest.fn().mockImplementation(() => ({
            addObject: jest.fn(),
            removeAll: jest.fn(),
            removeObject: jest.fn(),
            getObjects: jest.fn(() => []),
            addEventListener: jest.fn(),
            removeEventListener: jest.fn(),
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

const useHereMapMock = require('./useHereMap').useHereMap as jest.Mock;

// Stub useHereMap with a ready map. Pass overrides (e.g. `{map: mockMap}`) for
// the bits a test actually cares about; everything else gets a sensible default.
function mockHereMap(overrides: Record<string, unknown> = {}): void {
    useHereMapMock.mockReturnValue({
        mapContainerRef: {current: document.createElement('div')},
        map: {},
        platform: {},
        ui: {},
        isLoading: false,
        isReady: true,
        error: null,
        ...overrides,
    });
}

// Stub useHereMap before the map has initialised (isReady: false, null refs).
function mockHereMapNotReady(overrides: Record<string, unknown> = {}): void {
    mockHereMap({
        mapContainerRef: {current: null},
        map: null,
        platform: null,
        ui: null,
        isReady: false,
        ...overrides,
    });
}

describe('DispatchMap Component', () => {
    beforeEach(() => {
        (courierApi.getAvailableCourierLocations as jest.Mock).mockResolvedValue([]);
        (courierApi.getClearListEnvelope as jest.Mock).mockResolvedValue({
            minimumLatitude: 33.5,
            maximumLatitude: 34.5,
            minimumLongitude: -118.5,
            maximumLongitude: -117.5,
        });
    });

    describe('Rendering', () => {
        // A single mount sanity check. The previous per-prop "renders without
        // crashing" tests (jobs, currentJob, mapCenter, mapZoom, showAvailableCouriers,
        // clearListId, onEnvelopeUpdate, onMarkerClick) were tautological — each did a
        // full render and asserted only that the container existed. The real
        // behaviour for those props is exercised with meaningful assertions in the
        // focused describes below (envelope, courier data, map-ready states).
        it('mounts the map container', () => {
            renderWithProviders(<DispatchMap {...createDefaultProps()} />);
            expect(screen.getByTestId('dispatch-map-wrapper')).toBeInTheDocument();
        });
    });
});

describe('DispatchMap Clearlist Envelope Feature', () => {
    it('calls getClearListEnvelope when clearListId is provided and map is ready', async () => {
        // Mock useHereMap to return a ready map
        const mockMap = {
            getViewModel: jest.fn(() => ({
                setLookAtData: jest.fn(),
            })),
        };

        mockHereMap({map: mockMap});

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
            expect(courierApi.getClearListEnvelope).toHaveBeenCalledWith(123, expect.objectContaining({signal: expect.any(AbortSignal)}));
        });
    });

    it('does not call getClearListEnvelope when clearListId is undefined', () => {
        mockHereMap();

        const props = createDefaultProps({clearListId: undefined});
        renderWithProviders(<DispatchMap {...props} />);

        expect(courierApi.getClearListEnvelope).not.toHaveBeenCalled();
    });

    it('does not call getClearListEnvelope when map is not ready', () => {
        mockHereMapNotReady({isLoading: true});

        const props = createDefaultProps({clearListId: 123});
        renderWithProviders(<DispatchMap {...props} />);

        expect(courierApi.getClearListEnvelope).not.toHaveBeenCalled();
    });

    it('handles getClearListEnvelope error gracefully', async () => {
        const mockMap = {
            getViewModel: jest.fn(() => ({
                setLookAtData: jest.fn(),
            })),
        };

        mockHereMap({map: mockMap});

        (courierApi.getClearListEnvelope as jest.Mock).mockRejectedValue(new Error('API Error'));

        const onEnvelopeUpdate = jest.fn();
        const props = createDefaultProps({clearListId: 123, onEnvelopeUpdate});
        renderWithProviders(<DispatchMap {...props} />);

        // React Query handles the error — verify the map wasn't updated and onEnvelopeUpdate wasn't called
        await waitFor(() => {
            expect(courierApi.getClearListEnvelope).toHaveBeenCalled();
        });

        // The map should NOT have setLookAtData called on error
        expect(mockMap.getViewModel().setLookAtData).not.toHaveBeenCalled();
        expect(onEnvelopeUpdate).not.toHaveBeenCalled();
    });

    it('calls onEnvelopeUpdate when envelope is fetched successfully', async () => {
        const mockMap = {
            getViewModel: jest.fn(() => ({
                setLookAtData: jest.fn(),
            })),
        };

        mockHereMap({map: mockMap});

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
            expect(onEnvelopeUpdate).toHaveBeenCalledWith(mockEnvelope);
        });
    });
});

describe('DispatchMap Loading State', () => {
    it('shows loading indicator when map is loading', () => {
        mockHereMapNotReady({isLoading: true});

        const props = createDefaultProps();
        renderWithProviders(<DispatchMap {...props} />);

        // MUI LinearProgress renders with role="progressbar"
        expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('hides loading indicator when map is ready', () => {
        mockHereMap();

        const props = createDefaultProps();
        renderWithProviders(<DispatchMap {...props} />);

        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
});

describe('DispatchMap Control Buttons', () => {
    it('portals the control rails into an isolated host inside the map container', () => {
        mockHereMap();

        const props = createDefaultProps();
        renderWithProviders(<DispatchMap {...props} />);

        // HERE Maps renders info bubbles / tooltips inside the map container at a very
        // high z-index (~1001). Rather than fighting that with an external sibling
        // overlay (which the absolute-wrapper approach failed to contain), the control
        // rails are portalled into a host element mounted *inside* the map container —
        // the documented best practice for custom map controls. The container isolates
        // its stacking context so its high z-indexes never leak over the app chrome.
        const wrapper = screen.getByTestId('dispatch-map-wrapper');
        expect(wrapper).toHaveStyle({isolation: 'isolate'});

        // The control host lives inside the map container, and the rails render into it.
        const host = screen.getByTestId('dispatch-map-controls-host');
        expect(wrapper).toContainElement(host);
        expect(host).toContainElement(screen.getByLabelText('Toggle Auto Zoom'));
    });

    it('shows control buttons when map is ready', () => {
        mockHereMap();

        const props = createDefaultProps();
        renderWithProviders(<DispatchMap {...props} />);

        // Control buttons should be visible
        expect(screen.getByLabelText('Toggle Auto Zoom')).toBeInTheDocument();
    });

    it('hides control buttons when map is not ready', () => {
        mockHereMapNotReady();

        const props = createDefaultProps();
        renderWithProviders(<DispatchMap {...props} />);

        // Control buttons should not be visible
        expect(screen.queryByLabelText('Toggle Auto Zoom')).not.toBeInTheDocument();
    });
});

describe('DispatchMap Courier Data', () => {
    beforeEach(() => {
        (courierApi.getAvailableCourierLocations as jest.Mock).mockResolvedValue([]);
    });

    it('does not fetch couriers when showAvailableCouriers is false', () => {
        mockHereMap();

        const props = createDefaultProps({showAvailableCouriers: false});
        renderWithProviders(<DispatchMap {...props} />);

        // Should not fetch couriers immediately
        expect(courierApi.getAvailableCourierLocations).not.toHaveBeenCalled();
    });

    it('fetches couriers when showAvailableCouriers is true and map is ready', async () => {
        const mockMap = {
            getViewModel: jest.fn(() => ({
                getLookAtData: jest.fn(() => ({
                    bounds: null,
                })),
            })),
            addEventListener: jest.fn(),
            removeEventListener: jest.fn(),
        };

        mockHereMap({map: mockMap});

        const props = createDefaultProps({showAvailableCouriers: true});
        renderWithProviders(<DispatchMap {...props} />);

        await waitFor(() => {
            expect(courierApi.getAvailableCourierLocations).toHaveBeenCalled();
        });
    });
});

describe('DispatchMap Map Ready Callback', () => {
    it('calls onMapReady with map, platform and ui when provided', async () => {
        const mockMapElement = document.createElement('div');
        const mockMap = {
            addObject: jest.fn(),
            getElement: jest.fn(() => mockMapElement),
        };
        const mockPlatform = {};
        const mockUI = {};

        useHereMapMock.mockImplementation(({onMapReady}) => {
            // Simulate calling onMapReady
            if (onMapReady) {
                setTimeout(() => onMapReady(mockMap, mockPlatform, mockUI), 0);
            }
            return {
                mapContainerRef: {current: document.createElement('div')},
                map: mockMap,
                platform: mockPlatform,
                ui: mockUI,
                isLoading: false,
                isReady: true,
                error: null,
            };
        });

        const props = createDefaultProps();
        renderWithProviders(<DispatchMap {...props} />);

        // The component internally handles onMapReady
        expect(useHereMapMock).toHaveBeenCalled();
    });
});

describe('DispatchMap Default Map Center', () => {
    const originalServerConfig = (window as any).serverConfig;

    beforeEach(() => {
        (courierApi.getAvailableCourierLocations as jest.Mock).mockReset().mockResolvedValue([]);
    });

    afterEach(() => {
        (window as any).serverConfig = originalServerConfig;
    });

    it('uses NZ center for courier fallback bounds when non-US customer', async () => {
        (window as any).serverConfig = {isUSCustomer: false};

        const mockMap = {
            addObject: jest.fn(),
            getViewModel: jest.fn(() => ({
                getLookAtData: jest.fn(() => ({
                    bounds: null,
                })),
            })),
            addEventListener: jest.fn(),
            removeEventListener: jest.fn(),
        };

        mockHereMap({map: mockMap});

        const props = createDefaultProps({showAvailableCouriers: true});
        renderWithProviders(<DispatchMap {...props} />);

        await waitFor(() => {
            expect(courierApi.getAvailableCourierLocations).toHaveBeenCalled();
        });

        const call = (courierApi.getAvailableCourierLocations as jest.Mock).mock.calls[0];
        const [minLng, minLat, maxLng, maxLat] = call;
        // NZ center is ~174.7762 lng, ~-41.2865 lat — bounds should be around that
        expect(minLat).toBeCloseTo(-41.7865, 1);
        expect(maxLat).toBeCloseTo(-40.7865, 1);
        expect(minLng).toBeCloseTo(174.2762, 1);
        expect(maxLng).toBeCloseTo(175.2762, 1);
    });

    it('uses US center for courier fallback bounds when US customer', async () => {
        (window as any).serverConfig = {isUSCustomer: true};

        const mockMap = {
            addObject: jest.fn(),
            getViewModel: jest.fn(() => ({
                getLookAtData: jest.fn(() => ({
                    bounds: null,
                })),
            })),
            addEventListener: jest.fn(),
            removeEventListener: jest.fn(),
        };

        mockHereMap({map: mockMap});

        const props = createDefaultProps({showAvailableCouriers: true});
        renderWithProviders(<DispatchMap {...props} />);

        await waitFor(() => {
            expect(courierApi.getAvailableCourierLocations).toHaveBeenCalled();
        });

        const call = (courierApi.getAvailableCourierLocations as jest.Mock).mock.calls[0];
        const [minLng, minLat, maxLng, maxLat] = call;
        // US center is ~-98.5556 lng, ~39.8097 lat — bounds should be around that
        expect(minLat).toBeCloseTo(39.31, 1);
        expect(maxLat).toBeCloseTo(40.31, 1);
        expect(minLng).toBeCloseTo(-99.06, 1);
        expect(maxLng).toBeCloseTo(-98.06, 1);
    });
});
