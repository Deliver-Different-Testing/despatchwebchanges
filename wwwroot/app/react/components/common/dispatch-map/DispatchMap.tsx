/**
 * DispatchMap Component
 *
 * Main React component for the dispatch map.
 * Displays job markers and courier positions on HERE Maps.
 */

import React, {useCallback, useEffect, useRef, useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';
import type {DispatchMapProps} from './DispatchMap.types';
import {COURIER_REFRESH_INTERVAL_MS} from './DispatchMap.types';
import {useHereMap} from './useHereMap';
import {useMapPreferences} from './useMapPreferences';
import {getDefaultMapCenter} from '../here-map/HereMap.types';
import {JobMarkerManager} from './JobMarkerManager';
import {DispatchCourierMarkerManager} from './DispatchCourierMarkerManager';
import {MapControlButtons} from './MapControlButtons';
import {MapZoomViewControls} from './MapZoomViewControls';
import {getAvailableCourierLocations, getClearListEnvelope} from '../../../services/courierApi';
import {queryKeys} from '../../../query/queryClient';
import styles from './DispatchMap.module.css';

declare const H: any;

export function DispatchMap({
    jobs,
    currentJob,
    mapCenter,
    mapZoom,
    onMarkerClick,
    showAvailableCouriers = false,
    clearListId,
    onEnvelopeUpdate,
}: DispatchMapProps) {
    // Refs for managers
    const jobMarkerManagerRef = useRef<JobMarkerManager | null>(null);
    const courierMarkerManagerRef = useRef<DispatchCourierMarkerManager | null>(null);
    const uiRef = useRef<any>(null);
    const mapInstanceRef = useRef<any>(null);
    const [defaultLayers, setDefaultLayers] = useState<any>(null);
    const [platformInstance, setPlatformInstance] = useState<any>(null);

    // Map preferences (auto zoom, couriers only, etc.)
    const {
        controlState,
        toggleAutoZoom,
        toggleCouriersOnly,
        toggleUrgentArmyOnly,
        toggleCouriersLargeView,
    } = useMapPreferences();

    // Handle map ready
    const handleMapReady = useCallback(
        (map: any, platform: any, ui: any, layers: any) => {
            uiRef.current = ui;
            setDefaultLayers(layers);
            setPlatformInstance(platform);

            // Initialize managers with UI for tooltips
            jobMarkerManagerRef.current = new JobMarkerManager(map, ui, onMarkerClick);
            courierMarkerManagerRef.current = new DispatchCourierMarkerManager(map, ui);
        },
        [onMarkerClick]
    );

    // Initialize HERE Map
    const { mapContainerRef, map, isLoading, isReady } = useHereMap({
        center: mapCenter,
        zoom: mapZoom,
        onMapReady: handleMapReady,
    });

    // Keep map ref in sync for use in async callbacks
    useEffect(() => {
        mapInstanceRef.current = map;
    }, [map]);

    // Get map bounds for courier query
    const getMapBounds = useCallback(() => {
        if (!map) return null;

        const viewBounds = map.getViewModel().getLookAtData().bounds;
        if (!viewBounds) return null;

        const bounds = viewBounds.getBoundingBox();
        if (!bounds) return null;

        return {
            minLng: bounds.getLeft(),
            minLat: bounds.getBottom(),
            maxLng: bounds.getRight(),
            maxLat: bounds.getTop(),
        };
    }, [map]);

    // Fetch courier positions
    const { data: couriers = [], refetch: refetchCouriers } = useQuery({
        queryKey: ['dispatch', 'couriers', showAvailableCouriers],
        queryFn: async () => {
            const bounds = getMapBounds();
            if (!bounds) {
                // Use default bounds based on map center
                const center = mapCenter || getDefaultMapCenter();
                const offset = 0.5;
                return getAvailableCourierLocations(
                    center.lng - offset,
                    center.lat - offset,
                    center.lng + offset,
                    center.lat + offset
                );
            }
            return getAvailableCourierLocations(
                bounds.minLng,
                bounds.minLat,
                bounds.maxLng,
                bounds.maxLat
            );
        },
        enabled: isReady && showAvailableCouriers,
        refetchInterval: COURIER_REFRESH_INTERVAL_MS,
        staleTime: COURIER_REFRESH_INTERVAL_MS - 5000,
    });

    // Update job markers when jobs change
    useEffect(() => {
        if (!jobMarkerManagerRef.current || !isReady) return;

        // Don't show job markers in couriers-only or large-view mode
        if (controlState.couriersOnlyEnabled || controlState.couriersLargeViewEnabled) {
            jobMarkerManagerRef.current.clearMarkers();
            return;
        }

        const isShowingCourierJobs = Boolean(
            currentJob?.assignedCourier && jobs && jobs.length > 1
        );

        jobMarkerManagerRef.current.updateMarkers(jobs || [], currentJob, isShowingCourierJobs).then(_ => {
            if (!jobMarkerManagerRef.current) return;

            // Auto-fit if enabled
            if (controlState.autoZoomEnabled && jobMarkerManagerRef.current.getMarkerCount() > 0) {
                const courierGroup = showAvailableCouriers
                    ? courierMarkerManagerRef.current?.getMarkerGroup()
                    : undefined;
                jobMarkerManagerRef.current.fitMapToMarkers(courierGroup);
            }
        });
    }, [jobs, currentJob, isReady, controlState.couriersOnlyEnabled, controlState.couriersLargeViewEnabled, controlState.autoZoomEnabled, showAvailableCouriers]);

    // Update courier markers when couriers or view mode changes; clear when couriers panel is off
    useEffect(() => {
        if (!courierMarkerManagerRef.current || !isReady) return;

        if (!showAvailableCouriers) {
            courierMarkerManagerRef.current.clearMarkers();
            return;
        }

        courierMarkerManagerRef.current.setAutoZoom(controlState.autoZoomEnabled);
        courierMarkerManagerRef.current.updateMarkers(
            couriers,
            controlState.couriersLargeViewEnabled ? false : controlState.urgentArmyOnlyEnabled,
            controlState.couriersLargeViewEnabled
        );
    }, [couriers, isReady, showAvailableCouriers, controlState.urgentArmyOnlyEnabled, controlState.couriersLargeViewEnabled, controlState.autoZoomEnabled]);

    // Refetch couriers on map view change
    useEffect(() => {
        if (!map || !showAvailableCouriers) return;

        let debounceTimer: NodeJS.Timeout;

        const handleMapViewChange = () => {
            // Debounce the refetch
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(async () => {
                await refetchCouriers();
            }, 500);
        };

        map.addEventListener('mapviewchangeend', handleMapViewChange);

        return () => {
            map.removeEventListener('mapviewchangeend', handleMapViewChange);
            clearTimeout(debounceTimer);
        };
    }, [map, showAvailableCouriers, refetchCouriers]);

    // Fetch envelope when clearListId changes (async-defer-await)
    const { data: envelope } = useQuery({
        queryKey: queryKeys.dispatch.clearListEnvelope(clearListId!),
        queryFn: ({ signal }) => getClearListEnvelope(clearListId!, { signal }),
        enabled: !!clearListId && isReady,
    });

    // Apply envelope bounds to map when data arrives
    useEffect(() => {
        if (!envelope || !mapInstanceRef.current) return;

        const bounds = new H.geo.Rect(
            envelope.maximumLatitude,
            envelope.minimumLongitude,
            envelope.minimumLatitude,
            envelope.maximumLongitude
        );

        mapInstanceRef.current.getViewModel().setLookAtData({ bounds });
        onEnvelopeUpdate?.(envelope);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onEnvelopeUpdate is a callback prop; only apply when envelope data changes
    }, [envelope]);

    // Update marker click callback when it changes
    useEffect(() => {
        if (jobMarkerManagerRef.current && onMarkerClick) {
            jobMarkerManagerRef.current.setOnMarkerClick(onMarkerClick);
        }
    }, [onMarkerClick]);

    // Cleanup
    useEffect(() => {
        return () => {
            jobMarkerManagerRef.current?.dispose();
            courierMarkerManagerRef.current?.dispose();
        };
    }, []);

    return (
        <Box className={styles.dispatchMapComponent}>
            {isLoading && <LinearProgress className={styles.loadingBar} />}
            <Box className={styles.dispatchMapContainer}>
                <Box className={styles.mapWrapper}>
                    <div ref={mapContainerRef} className={styles.mapContainer} />
                </Box>
                {isReady && (
                    <>
                        <MapZoomViewControls map={map} platform={platformInstance} defaultLayers={defaultLayers}/>
                        <MapControlButtons
                            controlState={controlState}
                            onToggleAutoZoom={toggleAutoZoom}
                            onToggleCouriersOnly={toggleCouriersOnly}
                            onToggleUrgentArmyOnly={toggleUrgentArmyOnly}
                            onToggleCouriersLargeView={toggleCouriersLargeView}
                        />
                    </>
                )}
            </Box>
        </Box>
    );
}

export default DispatchMap;
