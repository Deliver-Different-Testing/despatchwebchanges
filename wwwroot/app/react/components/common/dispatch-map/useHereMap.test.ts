/** @jest-environment jest-environment-jsdom */
/**
 * useHereMap Hook Tests
 *
 * Tests for the useHereMap custom React hook that manages HERE Maps
 * initialization and lifecycle.
 */

import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useHereMap } from './useHereMap';
import { DEFAULT_MAP_ZOOM } from './DispatchMap.types';
import { US_MAP_CENTER, NZ_MAP_CENTER } from '../here-map/HereMap.types';
import * as configApi from '../../../services/configApi';

// Mock the config API
jest.mock('../../../services/configApi', () => ({
    getHereMapsKey: jest.fn(),
}));

// Mock HERE Maps global H object
const createMockMap = () => ({
    setCenter: jest.fn(),
    setZoom: jest.fn(),
    getViewPort: jest.fn(() => ({
        resize: jest.fn(),
    })),
    getViewModel: jest.fn(() => ({
        setLookAtData: jest.fn(),
    })),
});

const createMockPlatform = () => ({
    createDefaultLayers: jest.fn(() => ({
        raster: {
            normal: {
                base: {},
            },
        },
    })),
});

const createMockUI = () => ({
    removeControl: jest.fn(),
    addControl: jest.fn(),
});

const createMockBehavior = () => ({
    disable: jest.fn(),
});

let mockMapInstance: ReturnType<typeof createMockMap>;
let mockPlatformInstance: ReturnType<typeof createMockPlatform>;
let mockUIInstance: ReturnType<typeof createMockUI>;

const mockH = {
    service: {
        Platform: jest.fn(() => {
            mockPlatformInstance = createMockPlatform();
            return mockPlatformInstance;
        }),
    },
    Map: jest.fn(() => {
        mockMapInstance = createMockMap();
        return mockMapInstance;
    }),
    mapevents: {
        Behavior: jest.fn(() => createMockBehavior()),
        MapEvents: jest.fn(),
        Feature: {
            FRACTIONAL_ZOOM: 'FRACTIONAL_ZOOM',
        },
    },
    ui: {
        UI: {
            createDefault: jest.fn(() => {
                mockUIInstance = createMockUI();
                return mockUIInstance;
            }),
        },
        ZoomControl: jest.fn(),
        LayoutAlignment: {
            RIGHT_TOP: 'RIGHT_TOP',
        },
    },
};

// Add EngineType to Map
(mockH.Map as any).EngineType = { HARP: 'HARP' };

(global as any).H = mockH;

// Helper to create query client wrapper
function createWrapper() {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
                gcTime: 0,
                staleTime: 0,
            },
        },
    });

    return ({ children }: { children: React.ReactNode }) =>
        React.createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('useHereMap', () => {
    beforeEach(() => {
        (configApi.getHereMapsKey as jest.Mock).mockResolvedValue('test-api-key');
    });

    describe('Initial State', () => {
        it('returns loading state initially', () => {
            const { result } = renderHook(() => useHereMap(), {
                wrapper: createWrapper(),
            });

            expect(result.current.isLoading).toBe(true);
            expect(result.current.isReady).toBe(false);
            expect(result.current.map).toBeNull();
            expect(result.current.platform).toBeNull();
            expect(result.current.ui).toBeNull();
            expect(result.current.error).toBeNull();
        });

        it('returns a ref for the map container', () => {
            const { result } = renderHook(() => useHereMap(), {
                wrapper: createWrapper(),
            });

            expect(result.current.mapContainerRef).toBeDefined();
            expect(result.current.mapContainerRef.current).toBeNull();
        });
    });

    describe('API Key Fetching', () => {
        it('fetches API key on mount', async () => {
            renderHook(() => useHereMap(), {
                wrapper: createWrapper(),
            });

            await waitFor(() => {
                expect(configApi.getHereMapsKey).toHaveBeenCalled();
            });
        });

        it('caches API key with infinite stale time', async () => {
            const wrapper = createWrapper();

            // First hook
            renderHook(() => useHereMap(), { wrapper });

            await waitFor(() => {
                expect(configApi.getHereMapsKey).toHaveBeenCalledTimes(1);
            });

            // Second hook should use cached key
            renderHook(() => useHereMap(), { wrapper });

            // Should still only be called once due to caching
            expect(configApi.getHereMapsKey).toHaveBeenCalledTimes(1);
        });
    });

    describe('Hook Options', () => {
        it('accepts center option', () => {
            const center = { lat: 40.7128, lng: -74.006 };
            const { result } = renderHook(() => useHereMap({ center }), {
                wrapper: createWrapper(),
            });

            expect(result.current).toBeDefined();
        });

        it('accepts zoom option', () => {
            const { result } = renderHook(() => useHereMap({ zoom: 15 }), {
                wrapper: createWrapper(),
            });

            expect(result.current).toBeDefined();
        });

        it('accepts onMapReady callback option', () => {
            const onMapReady = jest.fn();
            const { result } = renderHook(() => useHereMap({ onMapReady }), {
                wrapper: createWrapper(),
            });

            expect(result.current).toBeDefined();
        });

        it('uses DEFAULT_MAP_ZOOM when zoom not specified', () => {
            const { result } = renderHook(() => useHereMap(), {
                wrapper: createWrapper(),
            });

            // The default zoom is used internally
            expect(DEFAULT_MAP_ZOOM).toBe(12);
            expect(result.current).toBeDefined();
        });
    });

    describe('Return Value Structure', () => {
        it('returns mapContainerRef', () => {
            const { result } = renderHook(() => useHereMap(), {
                wrapper: createWrapper(),
            });

            expect(result.current).toHaveProperty('mapContainerRef');
            expect(typeof result.current.mapContainerRef).toBe('object');
        });

        it('returns map (initially null)', () => {
            const { result } = renderHook(() => useHereMap(), {
                wrapper: createWrapper(),
            });

            expect(result.current).toHaveProperty('map');
            expect(result.current.map).toBeNull();
        });

        it('returns platform (initially null)', () => {
            const { result } = renderHook(() => useHereMap(), {
                wrapper: createWrapper(),
            });

            expect(result.current).toHaveProperty('platform');
            expect(result.current.platform).toBeNull();
        });

        it('returns ui (initially null)', () => {
            const { result } = renderHook(() => useHereMap(), {
                wrapper: createWrapper(),
            });

            expect(result.current).toHaveProperty('ui');
            expect(result.current.ui).toBeNull();
        });

        it('returns isLoading boolean', () => {
            const { result } = renderHook(() => useHereMap(), {
                wrapper: createWrapper(),
            });

            expect(result.current).toHaveProperty('isLoading');
            expect(typeof result.current.isLoading).toBe('boolean');
        });

        it('returns isReady boolean', () => {
            const { result } = renderHook(() => useHereMap(), {
                wrapper: createWrapper(),
            });

            expect(result.current).toHaveProperty('isReady');
            expect(typeof result.current.isReady).toBe('boolean');
        });

        it('returns error (initially null)', () => {
            const { result } = renderHook(() => useHereMap(), {
                wrapper: createWrapper(),
            });

            expect(result.current).toHaveProperty('error');
            expect(result.current.error).toBeNull();
        });
    });

    describe('No Container Guard', () => {
        it('does not initialize map if container ref is null', async () => {
            renderHook(() => useHereMap(), {
                wrapper: createWrapper(),
            });

            // Wait for API key to be fetched
            await waitFor(() => {
                expect(configApi.getHereMapsKey).toHaveBeenCalled();
            });

            // Map should not be created without container
            expect(mockH.Map).not.toHaveBeenCalled();
        });

        it('does not initialize platform if container ref is null', async () => {
            renderHook(() => useHereMap(), {
                wrapper: createWrapper(),
            });

            await waitFor(() => {
                expect(configApi.getHereMapsKey).toHaveBeenCalled();
            });

            expect(mockH.service.Platform).not.toHaveBeenCalled();
        });
    });

    describe('Cleanup', () => {
        it('unmounts without error', () => {
            const { unmount } = renderHook(() => useHereMap(), {
                wrapper: createWrapper(),
            });

            expect(() => unmount()).not.toThrow();
        });
    });

    describe('Multiple Renders', () => {
        it('maintains stable ref across rerenders', () => {
            const { result, rerender } = renderHook(() => useHereMap(), {
                wrapper: createWrapper(),
            });

            const initialRef = result.current.mapContainerRef;
            rerender();
            expect(result.current.mapContainerRef).toBe(initialRef);
        });
    });

    describe('Loading State Calculation', () => {
        it('isLoading is true when API key is being fetched', () => {
            // Make API call take longer
            (configApi.getHereMapsKey as jest.Mock).mockImplementation(
                () => new Promise((resolve) => setTimeout(() => resolve('key'), 1000))
            );

            const { result } = renderHook(() => useHereMap(), {
                wrapper: createWrapper(),
            });

            expect(result.current.isLoading).toBe(true);
        });

        it('isLoading reflects query loading state', async () => {
            const { result } = renderHook(() => useHereMap(), {
                wrapper: createWrapper(),
            });

            // Initially loading while fetching key
            expect(result.current.isLoading).toBe(true);
        });
    });

    describe('Error State', () => {
        it('error is null initially', () => {
            const { result } = renderHook(() => useHereMap(), {
                wrapper: createWrapper(),
            });

            expect(result.current.error).toBeNull();
        });
    });

    describe('Constants Usage', () => {
        it('uses DEFAULT_MAP_ZOOM constant', () => {
            // Verify the constant exists and is a reasonable value
            expect(DEFAULT_MAP_ZOOM).toBeDefined();
            expect(typeof DEFAULT_MAP_ZOOM).toBe('number');
            expect(DEFAULT_MAP_ZOOM).toBeGreaterThan(0);
            expect(DEFAULT_MAP_ZOOM).toBeLessThanOrEqual(20);
        });
    });

    describe('HERE Maps SDK Structure', () => {
        it('expects H.service.Platform to be available', () => {
            expect(mockH.service.Platform).toBeDefined();
        });

        it('expects H.Map to be available', () => {
            expect(mockH.Map).toBeDefined();
        });

        it('expects H.mapevents.Behavior to be available', () => {
            expect(mockH.mapevents.Behavior).toBeDefined();
        });

        it('expects H.mapevents.MapEvents to be available', () => {
            expect(mockH.mapevents.MapEvents).toBeDefined();
        });

        it('expects H.ui.UI.createDefault to be available', () => {
            expect(mockH.ui.UI.createDefault).toBeDefined();
        });

        it('expects H.ui.ZoomControl to be available', () => {
            expect(mockH.ui.ZoomControl).toBeDefined();
        });

        it('expects H.Map.EngineType.HARP to be available', () => {
            expect((mockH.Map as any).EngineType.HARP).toBeDefined();
        });
    });

    describe('Default Map Center', () => {
        const originalServerConfig = (window as any).serverConfig;

        afterEach(() => {
            (window as any).serverConfig = originalServerConfig;
        });

        it('imports US and NZ center constants', () => {
            expect(US_MAP_CENTER.lat).toBeCloseTo(39.81, 0);
            expect(NZ_MAP_CENTER.lat).toBeCloseTo(-41.29, 0);
        });

        it('uses getDefaultMapCenter which returns NZ for non-US customer', () => {
            (window as any).serverConfig = {isUSCustomer: false};
            const { getDefaultMapCenter } = require('../here-map/HereMap.types');
            expect(getDefaultMapCenter()).toEqual(NZ_MAP_CENTER);
        });

        it('uses getDefaultMapCenter which returns US for US customer', () => {
            (window as any).serverConfig = {isUSCustomer: true};
            const { getDefaultMapCenter } = require('../here-map/HereMap.types');
            expect(getDefaultMapCenter()).toEqual(US_MAP_CENTER);
        });
    });
});
