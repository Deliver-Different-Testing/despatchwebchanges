/**
 * CourierMapPage Component
 *
 * Main React component for the courier map view.
 * Displays a HERE map with courier positions and a drivers panel sidebar.
 */

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {Box} from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import type { IAvailableCourierPosition } from '../../../interfaces/courier.interface';
import type { CourierMapPageProps } from './CourierMapPage.types';
import {
    US_BOUNDS,
    NZ_BOUNDS,
    REFRESH_INTERVAL_MS,
    SEARCH_DEBOUNCE_MS,
    matchesCourierSearch,
} from './CourierMapPage.types';
import { useCourierMap } from './useCourierMap';
import { DriversPanel } from './components/DriversPanel';
import { MapControls } from './components/MapControls';
import { MapZoomViewControls } from '../../components/common/dispatch-map/MapZoomViewControls';
import type { MapZoomViewControlsHandle } from '../../components/common/dispatch-map/MapZoomViewControls';
import { BELOW_APP_BAR_HEIGHT } from '../../components/common/app-toolbar/appBarMetrics';
import { queryKeys } from '../../query';
import { getAvailableCourierLocations, getAllFleetOptions } from '../../services/courierApi';
import { LIVE_TEMPLATE } from './CourierMapDisplaySettings';
import type { CourierMapDisplaySettings } from './CourierMapDisplaySettings';
import { getPreference, savePreference } from '../../services/preferencesApi';
import { StaffPreferenceKey } from '../../../enums/staff-preference-key.enum';
import { loadSelectedFleetIds, saveSelectedFleetIds } from './courierMapFleetFilterStorage';

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
    const [selectedFleetIds, setSelectedFleetIds] = useState<number[]>(() => loadSelectedFleetIds());
    const [selectedDriverId, setSelectedDriverId] = useState<number | null>(null);

    const handleFleetIdsChange = useCallback((ids: number[]) => {
        setSelectedFleetIds(ids);
        saveSelectedFleetIds(ids);
    }, []);

    // useCourierMap needs a click handler at construction time, but that handler needs
    // centerOnCourier/setSelectedDriver — which useCourierMap itself returns. This ref
    // breaks the cycle: the map always calls the *latest* handleDriverClick without
    // making onMarkerTap's identity (and therefore the map's init effect) depend on it.
    const handleDriverClickRef = useRef<(driver: IAvailableCourierPosition) => void>(() => {});

    // Display settings — defaults to the Live template until/unless a saved StaffPreference
    // loads, matching the DispatchCourierDisplayMode pattern (see courierDisplayMode.ts).
    const [displaySettings, setDisplaySettings] = useState<CourierMapDisplaySettings>(LIVE_TEMPLATE);
    const mapViewControlsRef = useRef<MapZoomViewControlsHandle>(null);

    useEffect(() => {
        let cancelled = false;
        getPreference(StaffPreferenceKey.CourierMapDisplaySettings)
            .then((raw) => {
                if (cancelled || !raw) return;
                setDisplaySettings(JSON.parse(raw) as CourierMapDisplaySettings);
            })
            .catch((err) => console.error('[CourierMapPage] failed to load display settings preference:', err));
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps -- loaded once on mount
    }, []);

    const handleDisplaySettingsChange = useCallback((next: CourierMapDisplaySettings) => {
        setDisplaySettings(next);
        savePreference(StaffPreferenceKey.CourierMapDisplaySettings, JSON.stringify(next))
            .catch((err) => console.error('[CourierMapPage] failed to save display settings preference:', err));
    }, []);

    // Drive the map's own satellite/roadmap/traffic rail from the current display settings —
    // a preset click still goes through that rail's existing logic, it's just not duplicated
    // as a second control in the settings menu.
    useEffect(() => {
        mapViewControlsRef.current?.setView(displaySettings.mapView);
        mapViewControlsRef.current?.setTrafficEnabled(displaySettings.trafficEnabled);
    }, [displaySettings.mapView, displaySettings.trafficEnabled]);

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
        setSelectedDriver,
        returnToOverview,
    } = useCourierMap({
        apiKey,
        isUsCustomer,
        mapCenter,
        displaySettings,
        onMarkerTap: (driver) => handleDriverClickRef.current(driver),
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

    // Couriers matching the current search — narrows the map's marker set the same way it
    // narrows the drivers-panel list, so a searched-for driver hidden behind others (e.g.
    // "#97") isn't lost in a crowd of unrelated markers.
    const searchMatchedCouriers = useMemo(
        () => validCouriers.filter((c) => matchesCourierSearch(c, debouncedSearchTerm)),
        [validCouriers, debouncedSearchTerm]
    );

    // Update map markers when couriers or the search narrowing them change
    useEffect(() => {
        if (isInitialized) {
            updateCouriers(searchMatchedCouriers);
        }
    }, [isInitialized, searchMatchedCouriers, updateCouriers]);

    // Handlers
    const handleDriverClick = useCallback(
        (driver: IAvailableCourierPosition) => {
            setSelectedDriverId(driver.courierId);
            centerOnCourier(driver);
        },
        [centerOnCourier]
    );

    useEffect(() => {
        handleDriverClickRef.current = handleDriverClick;
    }, [handleDriverClick]);

    // Once a search narrows the results down to exactly one courier, select and zoom to them
    // automatically — the point of hiding the rest is to stop hunting for an overlapped
    // marker, so the user shouldn't need a second click to get there. Guarded by search term
    // (not just the match count) so this fires once per distinct search rather than on every
    // poll refresh of the same unique match.
    const lastAutoSelectSearchRef = useRef<string | null>(null);
    useEffect(() => {
        const trimmed = debouncedSearchTerm.trim();
        if (!trimmed) {
            lastAutoSelectSearchRef.current = null;
            return;
        }
        if (searchMatchedCouriers.length === 1 && lastAutoSelectSearchRef.current !== trimmed) {
            lastAutoSelectSearchRef.current = trimmed;
            handleDriverClick(searchMatchedCouriers[0]);
        }
    }, [debouncedSearchTerm, searchMatchedCouriers, handleDriverClick]);

    // Keep the map's highlighted flag in step with the selected driver.
    useEffect(() => {
        setSelectedDriver(selectedDriverId);
    }, [selectedDriverId, setSelectedDriver]);

    // Clear a stale selection if that driver drops out of the current results
    // (went offline, or filtered out by the fleet filter/search).
    useEffect(() => {
        if (selectedDriverId != null && !searchMatchedCouriers.some((c) => c.courierId === selectedDriverId)) {
            setSelectedDriverId(null);
        }
    }, [searchMatchedCouriers, selectedDriverId]);

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
                    onSelectedFleetIdsChange={handleFleetIdsChange}
                    selectedDriverId={selectedDriverId}
                />

                {/* Fit-all + refresh + display settings (top-left) */}
                <MapControls
                    onFitAll={returnToOverview}
                    onRefresh={handleRefresh}
                    isLoading={isLoading}
                    displaySettings={displaySettings}
                    onDisplaySettingsChange={handleDisplaySettingsChange}
                />

                {/* Zoom + layer/traffic rail (bottom-left), shared with the dispatch map */}
                {isInitialized && map && (
                    <MapZoomViewControls
                        ref={mapViewControlsRef}
                        map={map}
                        platform={platform}
                        defaultLayers={defaultLayers}
                        placement="left"
                        defaultView={displaySettings.mapView}
                        defaultTrafficEnabled={displaySettings.trafficEnabled}
                    />
                )}
            </Box>
        </Box>
    );
}

export default CourierMapPage;
