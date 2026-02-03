/**
 * DispatchMap Component
 *
 * Main React component for the dispatch map.
 * Displays job markers and courier positions on HERE Maps.
 */

import React, { useRef, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Box, LinearProgress } from '@mui/material';
import type { DispatchMapProps, IAvailableCourierPosition } from './DispatchMap.types';
import { COURIER_REFRESH_INTERVAL_MS } from './DispatchMap.types';
import { useHereMap } from './useHereMap';
import { useMapPreferences } from './useMapPreferences';
import { JobMarkerManager } from './JobMarkerManager';
import { DispatchCourierMarkerManager } from './DispatchCourierMarkerManager';
import { MapControlButtons } from './MapControlButtons';
import { getAvailableCourierLocations, getClearListEnvelope } from '../../../services/courierApi';
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
        (map: any, platform: any, ui: any) => {
            uiRef.current = ui;

            // Initialize managers with UI for tooltips
            jobMarkerManagerRef.current = new JobMarkerManager(map, ui, onMarkerClick);
            courierMarkerManagerRef.current = new DispatchCourierMarkerManager(map, ui);
        },
        [onMarkerClick]
    );

    // Initialize HERE Map
    const { mapContainerRef, map, platform, ui, isLoading, isReady } = useHereMap({
        center: mapCenter,
        zoom: mapZoom,
        onMapReady: handleMapReady,
    });

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
                const center = mapCenter || { lat: 39.8097343, lng: -98.5556199 };
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

        jobMarkerManagerRef.current.updateMarkers(jobs || [], currentJob, isShowingCourierJobs);

        // Auto-fit if enabled
        if (controlState.autoZoomEnabled && jobMarkerManagerRef.current.getMarkerCount() > 0) {
            const courierGroup = showAvailableCouriers
                ? courierMarkerManagerRef.current?.getMarkerGroup()
                : undefined;
            jobMarkerManagerRef.current.fitMapToMarkers(courierGroup);
        }
    }, [jobs, currentJob, isReady, controlState.couriersOnlyEnabled, controlState.couriersLargeViewEnabled, controlState.autoZoomEnabled, showAvailableCouriers]);

    // Update courier markers when couriers change
    useEffect(() => {
        if (!courierMarkerManagerRef.current || !isReady || !showAvailableCouriers) return;

        courierMarkerManagerRef.current.setAutoZoom(controlState.autoZoomEnabled);
        courierMarkerManagerRef.current.updateMarkers(
            couriers,
            controlState.urgentArmyOnlyEnabled,
            controlState.couriersLargeViewEnabled
        );
    }, [couriers, isReady, showAvailableCouriers, controlState.urgentArmyOnlyEnabled, controlState.couriersLargeViewEnabled, controlState.autoZoomEnabled]);

    // Clear courier markers when showAvailableCouriers is turned off
    useEffect(() => {
        if (!showAvailableCouriers && courierMarkerManagerRef.current) {
            courierMarkerManagerRef.current.clearMarkers();
        }
    }, [showAvailableCouriers]);

    // Refetch couriers on map view change
    useEffect(() => {
        if (!map || !showAvailableCouriers) return;

        let debounceTimer: NodeJS.Timeout;

        const handleMapViewChange = () => {
            // Debounce the refetch
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                refetchCouriers();
            }, 500);
        };

        map.addEventListener('mapviewchangeend', handleMapViewChange);

        return () => {
            map.removeEventListener('mapviewchangeend', handleMapViewChange);
            clearTimeout(debounceTimer);
        };
    }, [map, showAvailableCouriers, refetchCouriers]);

    // Handle couriers-only toggle
    useEffect(() => {
        if (!jobMarkerManagerRef.current || !isReady) return;

        if (controlState.couriersOnlyEnabled) {
            jobMarkerManagerRef.current.clearMarkers();
        } else if (!controlState.couriersLargeViewEnabled) {
            // Restore job markers when turning off couriers-only
            const isShowingCourierJobs = Boolean(
                currentJob?.assignedCourier && jobs && jobs.length > 1
            );
            jobMarkerManagerRef.current.updateMarkers(jobs || [], currentJob, isShowingCourierJobs);
        }
    }, [controlState.couriersOnlyEnabled, controlState.couriersLargeViewEnabled, isReady, jobs, currentJob]);

    // Handle large view toggle
    useEffect(() => {
        if (!isReady) return;

        if (controlState.couriersLargeViewEnabled) {
            // Clear job markers
            jobMarkerManagerRef.current?.clearMarkers();
            // Redraw courier markers in large view
            if (showAvailableCouriers && courierMarkerManagerRef.current) {
                courierMarkerManagerRef.current.updateMarkers(
                    couriers,
                    false, // No urgent army filter in large view
                    true // Large view enabled
                );
            }
        } else {
            // Redraw courier markers in normal view
            if (showAvailableCouriers && courierMarkerManagerRef.current) {
                courierMarkerManagerRef.current.updateMarkers(
                    couriers,
                    controlState.urgentArmyOnlyEnabled,
                    false
                );
            }
            // Restore job markers
            if (!controlState.couriersOnlyEnabled && jobMarkerManagerRef.current) {
                const isShowingCourierJobs = Boolean(
                    currentJob?.assignedCourier && jobs && jobs.length > 1
                );
                jobMarkerManagerRef.current.updateMarkers(jobs || [], currentJob, isShowingCourierJobs);
            }
        }
    }, [controlState.couriersLargeViewEnabled, isReady, showAvailableCouriers, couriers, controlState.urgentArmyOnlyEnabled, controlState.couriersOnlyEnabled, jobs, currentJob]);

    // Fetch and apply envelope when clearListId changes
    useEffect(() => {
        if (!clearListId || !map || !isReady) return;

        getClearListEnvelope(clearListId)
            .then((envelope) => {
                // Create bounds rectangle (top, left, bottom, right)
                const bounds = new H.geo.Rect(
                    envelope.maximumLatitude,
                    envelope.minimumLongitude,
                    envelope.minimumLatitude,
                    envelope.maximumLongitude
                );

                // Fit map to the envelope bounds
                map.getViewModel().setLookAtData({
                    bounds: bounds,
                });

                // Notify parent component
                onEnvelopeUpdate?.(envelope);
            })
            .catch((error) => {
                console.error('Failed to fetch clearlist envelope:', error);
            });
    }, [clearListId, map, isReady, onEnvelopeUpdate]);

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
                    <MapControlButtons
                        controlState={controlState}
                        onToggleAutoZoom={toggleAutoZoom}
                        onToggleCouriersOnly={toggleCouriersOnly}
                        onToggleUrgentArmyOnly={toggleUrgentArmyOnly}
                        onToggleCouriersLargeView={toggleCouriersLargeView}
                    />
                )}
            </Box>
        </Box>
    );
}

export default DispatchMap;
