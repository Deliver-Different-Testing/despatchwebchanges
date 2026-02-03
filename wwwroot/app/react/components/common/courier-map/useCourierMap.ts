/**
 * useCourierMap Hook
 *
 * Manages the HERE Map lifecycle for the courier map component.
 * Handles initialization, marker management, and view control.
 */

import { useRef, useEffect, useState, useCallback } from 'react';
import type { IAvailableCourierPosition } from '../../../../interfaces/courier.interface';
import type { UseCourierMapReturn } from './CourierMap.types';
import { DEFAULT_ZOOM, OVERVIEW_ZOOM } from './CourierMap.types';
import { initPlatform, createMap } from '../here-map/hereMapUtils';
import { CourierMarkerManager } from './CourierMarkerManager';

interface UseCourierMapOptions {
    apiKey: string | null;
    isUsCustomer: boolean;
    mapCenter: { lat: number; lng: number };
}

export function useCourierMap({
    apiKey,
    isUsCustomer,
    mapCenter,
}: UseCourierMapOptions): UseCourierMapReturn {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<any>(null);
    const platformRef = useRef<any>(null);
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

            // Create marker manager
            markerManagerRef.current = new CourierMarkerManager(
                mapInstanceRef.current,
                isUsCustomer
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
            setIsInitialized(false);
        };
    }, [apiKey, isUsCustomer, mapCenter]);

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
        updateCouriers,
        centerOnCourier,
        returnToOverview,
    };
}
