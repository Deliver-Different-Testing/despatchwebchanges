/**
 * useHereMap Hook
 *
 * Manages HERE Maps initialization and lifecycle for the dispatch map.
 */

import React, { useRef, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../../query';
import { getHereMapsKey } from '../../../services/configApi';
import { DEFAULT_MAP_ZOOM } from './DispatchMap.types';
import { getDefaultMapCenter } from '../here-map/HereMap.types';

declare const H: any;

interface UseHereMapOptions {
    center?: { lat: number; lng: number };
    zoom?: number;
    onMapReady?: (map: any, platform: any, ui: any) => void;
}

interface UseHereMapReturn {
    mapContainerRef: React.RefObject<HTMLDivElement | null>;
    map: any | null;
    platform: any | null;
    ui: any | null;
    isLoading: boolean;
    isReady: boolean;
    error: Error | null;
}

export function useHereMap({
    center,
    zoom = DEFAULT_MAP_ZOOM,
    onMapReady,
}: UseHereMapOptions = {}): UseHereMapReturn {
    const mapContainerRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<any | null>(null);
    const platformRef = useRef<any | null>(null);
    const uiRef = useRef<any | null>(null);
    const [isReady, setIsReady] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    // Use refs for callbacks and initial values to keep init effect stable
    const onMapReadyRef = useRef(onMapReady);
    onMapReadyRef.current = onMapReady;
    const centerRef = useRef(center);
    centerRef.current = center;

    // Fetch API key
    const { data: apiKey, isLoading: isLoadingKey } = useQuery({
        queryKey: queryKeys.hereMaps.apiKey,
        queryFn: getHereMapsKey,
        staleTime: Infinity,
        gcTime: Infinity,
    });

    // Initialize map when API key and container are ready
    useEffect(() => {
        if (!apiKey || !mapContainerRef.current || mapRef.current) {
            return;
        }

        let isMounted = true;

        const initMap = async () => {
            try {
                // Initialize platform
                const platform = new H.service.Platform({
                    apikey: apiKey,
                });

                if (!isMounted || !mapContainerRef.current) return;

                const defaultCenter = centerRef.current || getDefaultMapCenter();
                const engineType = H.Map.EngineType['HARP'];

                // Initialize the default map layers with HARP engine
                const defaultLayers = platform.createDefaultLayers({ engineType });

                // Create map instance using raster base layer (no labels/place names)
                const map = new H.Map(
                    mapContainerRef.current,
                    defaultLayers.raster.normal.base,
                    {
                        zoom: zoom,
                        center: defaultCenter,
                        engineType: engineType,
                    }
                );

                // Add map behavior (pan/zoom)
                const behavior = new H.mapevents.Behavior(
                    new H.mapevents.MapEvents(map)
                );

                // Add UI components
                const ui = H.ui.UI.createDefault(map, defaultLayers);

                // Configure zoom control
                ui.removeControl('zoom');
                behavior.disable(H.mapevents.Behavior.Feature.FRACTIONAL_ZOOM);
                const zoomControl = new H.ui.ZoomControl({ fractionalZoom: false });
                ui.addControl('zoom', zoomControl, H.ui.LayoutAlignment.RIGHT_TOP);

                platformRef.current = platform;
                mapRef.current = map;
                uiRef.current = ui;
                setIsReady(true);

                if (onMapReadyRef.current) {
                    onMapReadyRef.current(map, platform, ui);
                }
            } catch (err) {
                if (isMounted) {
                    setError(
                        err instanceof Error ? err : new Error('Failed to initialize map')
                    );
                }
            }
        };

        initMap();

        return () => {
            isMounted = false;
        };
    }, [apiKey]); // eslint-disable-line react-hooks/exhaustive-deps -- center/zoom have their own effects; onMapReady uses ref

    // Handle window resize
    useEffect(() => {
        if (!mapRef.current) return;

        const handleResize = () => mapRef.current?.getViewPort().resize();
        window.addEventListener('resize', handleResize, { passive: true });

        return () => {
            window.removeEventListener('resize', handleResize);
        };
    }, [isReady]);

    // Dispose map on unmount
    useEffect(() => {
        return () => {
            if (mapRef.current) {
                try {
                    mapRef.current.dispose();
                } catch {
                    // Ignore disposal errors during cleanup
                }
                mapRef.current = null;
            }
            platformRef.current = null;
            uiRef.current = null;
        };
    }, []);

    // Update center when prop changes
    useEffect(() => {
        if (mapRef.current && center) {
            mapRef.current.setCenter(center);
        }
    }, [center]);

    // Update zoom when prop changes
    useEffect(() => {
        if (mapRef.current && zoom) {
            mapRef.current.setZoom(zoom);
        }
    }, [zoom]);

    return {
        mapContainerRef,
        map: mapRef.current,
        platform: platformRef.current,
        ui: uiRef.current,
        isLoading: isLoadingKey || (!isReady && !error),
        isReady,
        error,
    };
}
