/**
 * CourierMap Component
 *
 * Main React component for the courier map view.
 * Displays a HERE map with courier positions and a drivers panel sidebar.
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { IAvailableCourierPosition } from '../../../../interfaces/courier.interface';
import type { CourierMapProps } from './CourierMap.types';
import {
    US_BOUNDS,
    NZ_BOUNDS,
    REFRESH_INTERVAL_MS,
    SEARCH_DEBOUNCE_MS,
} from './CourierMap.types';
import { useCourierMap } from './useCourierMap';
import { DriversPanel } from './DriversPanel';
import { MapControls } from './MapControls';
import { queryKeys } from '../../../query/queryClient';
import { getAvailableCourierLocations } from '../../../services/courierApi';
import styles from './CourierMap.module.css';

interface CourierMapInternalProps extends CourierMapProps {
    apiKey: string | null;
}

export function CourierMap({
    isUsCustomer,
    mapCenter,
    apiKey,
}: CourierMapInternalProps) {
    // Panel state
    const [isPanelHidden, setIsPanelHidden] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

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
        updateCouriers,
        centerOnCourier,
        returnToOverview,
    } = useCourierMap({
        apiKey,
        isUsCustomer,
        mapCenter,
    });

    // Fetch courier locations with React Query
    const {
        data: couriers = [],
        isLoading,
        refetch,
    } = useQuery({
        queryKey: queryKeys.couriers.locations(bounds),
        queryFn: () =>
            getAvailableCourierLocations(
                bounds.minLng,
                bounds.minLat,
                bounds.maxLng,
                bounds.maxLat
            ),
        enabled: isInitialized,
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

    const handleRefresh = useCallback(() => {
        refetch();
    }, [refetch]);

    const handleTogglePanel = useCallback(() => {
        setIsPanelHidden((prev) => !prev);
    }, []);

    const handleSearchChange = useCallback((term: string) => {
        setSearchTerm(term);
    }, []);

    return (
        <div className={styles.courierMapContainer}>
            <div className={styles.mapWrapper}>
                {/* Map Container */}
                <div ref={mapContainerRef} className={styles.mapContainer} />

                {/* Drivers Panel */}
                <DriversPanel
                    drivers={validCouriers}
                    totalActiveDrivers={validCouriers.length}
                    isLoading={isLoading}
                    searchInputValue={searchTerm}
                    searchTerm={debouncedSearchTerm}
                    onSearchChange={handleSearchChange}
                    onDriverClick={handleDriverClick}
                    onRefresh={handleRefresh}
                    isPanelHidden={isPanelHidden}
                    onTogglePanel={handleTogglePanel}
                />

                {/* Map Controls */}
                <MapControls
                    onFitAll={returnToOverview}
                    onRefresh={handleRefresh}
                    isLoading={isLoading}
                />
            </div>
        </div>
    );
}

export default CourierMap;
