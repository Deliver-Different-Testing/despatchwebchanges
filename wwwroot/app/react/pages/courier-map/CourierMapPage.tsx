/**
 * CourierMapPage Component
 *
 * Main React component for the courier map view.
 * Displays a HERE map with courier positions and a drivers panel sidebar.
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {Box} from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import type { IAvailableCourierPosition } from '../../../interfaces/courier.interface';
import type { CourierMapPageProps } from './CourierMapPage.types';
import {
    US_BOUNDS,
    NZ_BOUNDS,
    REFRESH_INTERVAL_MS,
    SEARCH_DEBOUNCE_MS,
} from './CourierMapPage.types';
import { useCourierMap } from './useCourierMap';
import { DriversPanel } from './components/DriversPanel';
import { MapControls } from './components/MapControls';
import { MapZoomViewControls } from '../../components/common/dispatch-map/MapZoomViewControls';
import { BELOW_APP_BAR_HEIGHT } from '../../components/common/app-toolbar/appBarMetrics';
import { queryKeys } from '../../query';
import { getAvailableCourierLocations, getAllFleetOptions } from '../../services/courierApi';

interface CourierMapPageInternalProps extends CourierMapPageProps {
    apiKey: string | null;
}

export function CourierMapPage({
    isUsCustomer,
    mapCenter,
    apiKey,
}: CourierMapPageInternalProps) {
    // Panel state
    const [isPanelHidden, setIsPanelHidden] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
    const [selectedFleetIds, setSelectedFleetIds] = useState<number[]>([]);

    // Debounce search term
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchTerm(searchTerm);
        }, SEARCH_DEBOUNCE_MS);

        return () => clearTimeout(timer);
    }, [searchTerm]);

    // Get regional bounds
    const bounds = useMemo(
        () => (isUsCustomer ? US_BOUNDS : NZ_BOUNDS),
        [isUsCustomer]
    );

    // Initialize map hook
    const {
        mapContainerRef,
        isInitialized,
        map,
        platform,
        defaultLayers,
        updateCouriers,
        centerOnCourier,
        returnToOverview,
    } = useCourierMap({
        apiKey,
        isUsCustomer,
        mapCenter,
    });

    // Fetch courier fleet options (rarely change, cache 5 minutes)
    const {
        data: fleetOptions = [],
        isLoading: isFleetOptionsLoading,
    } = useQuery({
        queryKey: queryKeys.couriers.fleetOptions,
        queryFn: () => getAllFleetOptions(),
        staleTime: 5 * 60 * 1000,
    });

    // Fetch courier locations with React Query
    const {
        data: couriers = [],
        isLoading,
        refetch,
    } = useQuery({
        queryKey: queryKeys.couriers.locations(bounds, selectedFleetIds),
        queryFn: () =>
            getAvailableCourierLocations(
                bounds.minLng,
                bounds.minLat,
                bounds.maxLng,
                bounds.maxLat,
                selectedFleetIds
            ),
        enabled: true,
        refetchInterval: REFRESH_INTERVAL_MS,
        staleTime: REFRESH_INTERVAL_MS - 5000, // Consider stale 5 seconds before next refresh
    });

    // Filter valid couriers (with coordinates)
    const validCouriers = useMemo(
        () =>
            couriers.filter(
                (c): c is IAvailableCourierPosition & { latitude: number; longitude: number } =>
                    c.latitude !== null &&
                    c.longitude !== null &&
                    !isNaN(c.latitude!) &&
                    !isNaN(c.longitude!)
            ),
        [couriers]
    );

    // Update map markers when couriers change
    useEffect(() => {
        if (isInitialized && validCouriers.length >= 0) {
            updateCouriers(validCouriers);
        }
    }, [isInitialized, validCouriers, updateCouriers]);

    // Handlers
    const handleDriverClick = useCallback(
        (driver: IAvailableCourierPosition) => {
            centerOnCourier(driver);
        },
        [centerOnCourier]
    );

    const handleRefresh = useCallback(async () => {
        await refetch();
    }, [refetch]);

    const handleTogglePanel = useCallback(() => {
        setIsPanelHidden((prev) => !prev);
    }, []);

    const handleSearchChange = useCallback((term: string) => {
        setSearchTerm(term);
    }, []);

    return (
        <Box w="100%" h={BELOW_APP_BAR_HEIGHT} style={{position: 'relative', overflow: 'hidden'}}>
            <Box w="100%" h="100%" style={{position: 'relative'}}>
                {/* Map Container — isolate the stacking context so HERE Maps' info
                    bubbles / tooltips (rendered inside at z-index ~1001) stay below the
                    sibling map controls (zIndex 10) and drivers panel (zIndex 50)
                    instead of painting over them. */}
                <Box
                    ref={mapContainerRef}
                    data-testid="courier-map-container"
                    w="100%"
                    h="100%"
                    // Inline, not a CSS module: the test asserts it with toHaveStyle,
                    // which cannot see CSS-module classes (mocked to {} in Jest).
                    style={{isolation: 'isolate'}}
                />

                {/* Drivers Panel */}
                <DriversPanel
                    drivers={validCouriers}
                    totalActiveDrivers={validCouriers.length}
                    isLoading={isLoading}
                    searchInputValue={searchTerm}
                    searchTerm={debouncedSearchTerm}
                    onSearchChange={handleSearchChange}
                    onDriverClick={handleDriverClick}
                    isPanelHidden={isPanelHidden}
                    onTogglePanel={handleTogglePanel}
                    fleetOptions={fleetOptions}
                    isFleetOptionsLoading={isFleetOptionsLoading}
                    selectedFleetIds={selectedFleetIds}
                    onSelectedFleetIdsChange={setSelectedFleetIds}
                />

                {/* Fit-all + refresh (top-left) */}
                <MapControls
                    onFitAll={returnToOverview}
                    onRefresh={handleRefresh}
                    isLoading={isLoading}
                />

                {/* Zoom + layer/traffic rail (bottom-left), shared with the dispatch map */}
                {isInitialized && map && (
                    <MapZoomViewControls
                        map={map}
                        platform={platform}
                        defaultLayers={defaultLayers}
                        placement="left"
                    />
                )}
            </Box>
        </Box>
    );
}

export default CourierMapPage;
