/**
 * useCourierMap Hook
 *
 * Manages the HERE Map lifecycle for the courier map component.
 * Handles initialization, marker management, and view control.
 */

import { useRef, useEffect, useState, useCallback } from 'react';
import { useMantineTheme } from '@mantine/core';
import type { IAvailableCourierPosition } from '../../../interfaces/courier.interface';
import type { UseCourierMapReturn } from './CourierMapPage.types';
import { DEFAULT_ZOOM, OVERVIEW_ZOOM, getMarkerColors } from './CourierMapPage.types';
import { initPlatform, createMap } from '../../components/common/here-map/hereMapUtils';
import { CourierMarkerManager } from './CourierMarkerManager';
import type { CourierMapDisplaySettings } from './CourierMapDisplaySettings';

interface UseCourierMapOptions {
    apiKey: string | null;
    isUsCustomer: boolean;
    mapCenter: { lat: number; lng: number };
    displaySettings: CourierMapDisplaySettings;
    /** Called when a courier's flag is tapped directly on the map. */
    onMarkerTap?: (driver: IAvailableCourierPosition) => void;
}

/** The user's custom single-color pair, or undefined to use the default blue. */
function customSingleColor(settings: CourierMapDisplaySettings): { bg: string; text: string } | undefined {
    return settings.singleColor && settings.singleTextColor
        ? { bg: settings.singleColor, text: settings.singleTextColor }
        : undefined;
}

export function useCourierMap({
    apiKey,
    isUsCustomer,
    mapCenter,
    displaySettings,
    onMarkerTap,
}: UseCourierMapOptions): UseCourierMapReturn {
    const theme = useMantineTheme();
    const themeRef = useRef(theme);
    themeRef.current = theme;
    const displaySettingsRef = useRef(displaySettings);
    displaySettingsRef.current = displaySettings;
    const onMarkerTapRef = useRef(onMarkerTap);
    onMarkerTapRef.current = onMarkerTap;
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<any>(null);
    const platformRef = useRef<any>(null);
    const defaultLayersRef = useRef<any>(null);
    const markerManagerRef = useRef<CourierMarkerManager | null>(null);
    const userZoomLevelRef = useRef<number | null>(null);

    const [isInitialized, setIsInitialized] = useState(false);

    // Initialize map
    useEffect(() => {
        if (!apiKey || !mapContainerRef.current || mapInstanceRef.current) {
            return;
        }

        const containerId = `courier-map-${Date.now()}`;
        mapContainerRef.current.id = containerId;

        try {
            // Initialize platform
            platformRef.current = initPlatform({ apiKey });

            // Create map
            const defaultZoom = isUsCustomer ? DEFAULT_ZOOM.US : DEFAULT_ZOOM.NZ;
            const mapResult = createMap(containerId, platformRef.current, {
                center: mapCenter,
                zoom: defaultZoom,
            });

            if (!mapResult) {
                console.error('Failed to create map');
                return;
            }

            mapInstanceRef.current = mapResult.map;
            defaultLayersRef.current = mapResult.defaultLayers;

            // Strip HERE's native zoom/map-settings chrome; zoom and the layer
            // picker are rendered as MUI controls (MapZoomViewControls) so the
            // courier map matches the rest of the app — same as the dispatch map.
            mapResult.ui?.removeControl('zoom');
            mapResult.ui?.removeControl('mapsettings');

            // Create marker manager with theme-derived status colors so map
            // markers and the driver list stay in step with the palette.
            markerManagerRef.current = new CourierMarkerManager(
                mapInstanceRef.current,
                getMarkerColors(themeRef.current, displaySettingsRef.current.colorMode, customSingleColor(displaySettingsRef.current)),
                displaySettingsRef.current,
                (driver) => onMarkerTapRef.current?.(driver)
            );

            // Track user zoom changes
            mapInstanceRef.current.addEventListener('mapviewchangeend', () => {
                userZoomLevelRef.current = mapInstanceRef.current.getZoom();
            });

            setIsInitialized(true);
        } catch (error) {
            console.error('Error initializing courier map:', error);
        }

        // Cleanup
        return () => {
            if (markerManagerRef.current) {
                markerManagerRef.current.dispose();
                markerManagerRef.current = null;
            }
            if (mapInstanceRef.current) {
                mapInstanceRef.current.dispose();
                mapInstanceRef.current = null;
            }
            platformRef.current = null;
            defaultLayersRef.current = null;
            setIsInitialized(false);
        };
    }, [apiKey, isUsCustomer, mapCenter]);

    // Repaint existing markers immediately when the display settings change (a settings
    // menu edit or a template pick), rather than waiting for the next 30s poll.
    useEffect(() => {
        if (!isInitialized || !markerManagerRef.current) return;
        markerManagerRef.current.updateSettings(
            getMarkerColors(themeRef.current, displaySettings.colorMode, customSingleColor(displaySettings)),
            displaySettings
        );
    }, [isInitialized, displaySettings]);

    // Update couriers on the map
    const updateCouriers = useCallback(
        (couriers: IAvailableCourierPosition[]) => {
            if (!markerManagerRef.current || !mapInstanceRef.current) return;

            // Preserve zoom level before update
            const zoomBefore = userZoomLevelRef.current ?? mapInstanceRef.current.getZoom();

            // Filter valid coordinates
            const validCouriers = couriers.filter(
                (c) =>
                    c.latitude !== null &&
                    c.longitude !== null &&
                    !isNaN(c.latitude!) &&
                    !isNaN(c.longitude!)
            );

            markerManagerRef.current.updateMarkers(validCouriers);

            // Restore zoom if it changed unexpectedly
            const currentZoom = mapInstanceRef.current.getZoom();
            if (Math.abs(currentZoom - zoomBefore) > 0.1) {
                mapInstanceRef.current.setZoom(zoomBefore);
            }
        },
        []
    );

    // Center on a specific courier
    const centerOnCourier = useCallback(
        (driver: IAvailableCourierPosition) => {
            if (!markerManagerRef.current) return;
            markerManagerRef.current.centerOnCourier(driver);
        },
        []
    );

    // Highlight/un-highlight a driver's flag; persists through the next poll refresh since
    // CourierMarkerManager tracks selection as instance state.
    const setSelectedDriver = useCallback((courierId: number | null) => {
        markerManagerRef.current?.setSelectedCourier(courierId);
    }, []);

    // Return to overview (fit all or reset to country view)
    const returnToOverview = useCallback(() => {
        if (!mapInstanceRef.current) return;

        const countryZoom = isUsCustomer ? OVERVIEW_ZOOM.US : OVERVIEW_ZOOM.NZ;
        mapInstanceRef.current.setCenter(mapCenter);
        mapInstanceRef.current.setZoom(countryZoom);
    }, [isUsCustomer, mapCenter]);

    return {
        mapContainerRef,
        isInitialized,
        map: mapInstanceRef.current,
        platform: platformRef.current,
        defaultLayers: defaultLayersRef.current,
        updateCouriers,
        centerOnCourier,
        setSelectedDriver,
        returnToOverview,
    };
}
