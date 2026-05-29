/**
 * useHereMap Custom Hook
 *
 * Manages the HERE Maps lifecycle and operations.
 */

import {useCallback, useEffect, useRef, useState} from 'react';
import type {
    CourierLocation,
    HereMapConfig,
    HereMapCredentials,
    IHereMapChildJob,
    IHereMapJob,
    MapInstance, UseHereMapOptions,
    UseHereMapReturn,
} from './HereMap.types';
import {MAP_CONSTANTS} from './HereMap.types';
import * as utils from './hereMapUtils';

export function useHereMap({
                               mapId,
                               credentials,
                               config,
                               onMapReady,
                           }: UseHereMapOptions): UseHereMapReturn {
    // State
    const [mapInstance, setMapInstance] = useState<MapInstance | null>(null);
    const [platform, setPlatform] = useState<any | null>(null);
    const [isInitialized, setIsInitialized] = useState(false);

    // Refs for markers and routes (don't trigger re-renders)
    const fromMarkerRef = useRef<any>(null);
    const toMarkerRef = useRef<any>(null);
    const courierMarkerRef = useRef<any>(null);
    const extraMarkersRef = useRef<any[]>([]);
    const routeLineRef = useRef<any>(null);
    const extraRouteLinesRef = useRef<any[]>([]);

    // Mirrors mapInstance state so the unmount-cleanup effect (which uses
    // `[]` deps to run exactly once) can see the current value rather than
    // closing over the initial null
    const mapInstanceRef = useRef<MapInstance | null>(null);

    // AbortController bumped on every showJobOnMap call so in-flight HERE
    // routing callbacks bail out instead of adding stale polylines to a map
    // that's already been cleared for the new job
    const routingControllerRef = useRef<AbortController | null>(null);

    // Track previous values for change detection
    const prevConfigRef = useRef<HereMapConfig | undefined>(undefined);
    const prevCredentialsRef = useRef<HereMapCredentials | undefined>(undefined);
    const prevMapIdRef = useRef<string | undefined>(undefined);
    const prevSelectedJobIndexRef = useRef<number | undefined>(undefined);
    const prevCourierLocationRef = useRef<CourierLocation | undefined>(undefined);

    /**
     * Initialize the map
     */
    const initializeMap = useCallback((): boolean => {
        if (!credentials || !mapId) {
            console.warn('Missing credentials or mapId', {
                hasCredentials: !!credentials,
                hasMapId: !!mapId,
            });
            return false;
        }

        try {
            // Initialize HERE platform
            const newPlatform = utils.initPlatform(credentials);
            if (!newPlatform) {
                console.error('Failed to initialize HERE platform');
                return false;
            }

            // Initialize map
            const newMapInstance = utils.createMap(mapId, newPlatform, config);

            if (!newMapInstance?.map) {
                console.error('Failed to create map instance');
                return false;
            }

            setPlatform(newPlatform);
            setMapInstance(newMapInstance);
            setIsInitialized(true);

            // Notify parent component that map is ready
            if (onMapReady) {
                onMapReady({
                    map: newMapInstance.map,
                    platform: newPlatform,
                    defaultLayers: newMapInstance.defaultLayers,
                });
            }

            // Resize map after DOM settles
            setTimeout(() => {
                if (newMapInstance.map) {
                    utils.resizeMapPreserveView(newMapInstance.map);
                }
            }, MAP_CONSTANTS.RESIZE_DELAY);

            return true;
        } catch (error) {
            console.error('Error in initializeMap:', error);
            return false;
        }
    }, [credentials, mapId, config, onMapReady]);

    /**
     * Clear all markers from the map
     *
     * Each marker is cleared independently so single-address jobs (which
     * never set toMarker) don't leak a stale fromMarker into the next job's
     * map state. Uses safeRemoveObject so a marker that's already detached
     * (e.g. by map disposal racing this call) logs a warning instead of
     * throwing IllegalOperationError and bringing down the React tree.
     */
    const clearAllMarkers = useCallback(() => {
        if (!mapInstance?.map) return;

        // Clear extra markers
        if (extraMarkersRef.current.length > 0) {
            extraMarkersRef.current = utils.removeExtraMarkers(
                extraMarkersRef.current,
                mapInstance.map
            );
        }

        // Clear from/to markers independently
        if (fromMarkerRef.current) {
            utils.safeRemoveObject(mapInstance.map, fromMarkerRef.current);
            fromMarkerRef.current = null;
        }
        if (toMarkerRef.current) {
            utils.safeRemoveObject(mapInstance.map, toMarkerRef.current);
            toMarkerRef.current = null;
        }

        // Clear courier marker
        if (courierMarkerRef.current) {
            utils.safeRemoveObject(mapInstance.map, courierMarkerRef.current);
            courierMarkerRef.current = null;
        }
    }, [mapInstance]);

    /**
     * Clear all route lines from the map
     */
    const clearAllRouteLines = useCallback(() => {
        if (!mapInstance?.map) return;

        // Clear extra route lines
        if (extraRouteLinesRef.current.length > 0) {
            extraRouteLinesRef.current = utils.removeExtraRouteLines(
                extraRouteLinesRef.current,
                mapInstance.map
            );
        }

        // Clear main route line
        if (routeLineRef.current) {
            utils.removeObjectById('route', mapInstance.map);
            routeLineRef.current = null;
        }
    }, [mapInstance]);

    /**
     * Clear the map of all markers and routes
     */
    const clearMap = useCallback(() => {
        if (!mapInstance?.map) {
            console.warn('Map instance is not initialized in clearMap');
            return;
        }

        clearAllMarkers();
        clearAllRouteLines();
    }, [mapInstance, clearAllMarkers, clearAllRouteLines]);

    /**
     * Get a scoped job by index
     */
    const getScopedJob = useCallback(
        (selectedJobIndex: number): IHereMapChildJob | undefined => {
            if (!config?.job?.childJobs) {
                console.warn('No child jobs available');
                return undefined;
            }

            let index = selectedJobIndex - 1;
            let thisJob: IHereMapChildJob | undefined;

            if (index !== -1) {
                // Scope map to the selected leg of a job
                thisJob = config.job.childJobs[index];
                if (thisJob) {
                    thisJob.index = extraRouteLinesRef.current.findIndex(
                        (x) => x.id?.slice(-1) === index.toString()
                    );
                }
            } else {
                // Scope map to the flight leg of a job
                index =
                    config.job.childJobs.findIndex((x) => x?.flight) ?? 0;
                thisJob = config.job.childJobs[index];
                if (thisJob) {
                    thisJob.index = extraRouteLinesRef.current.findIndex(
                        (x) => x.id?.slice(-1) === index.toString()
                    );
                }
            }

            return thisJob;
        },
        [config]
    );

    /**
     * Center the map on a specific job index
     */
    const centerMapOnIndex = useCallback(
        (selectedJobIndex: number) => {
            const thisJob = getScopedJob(selectedJobIndex);
            if (!thisJob?.pickup || !thisJob?.delivery) {
                console.warn('Invalid job for centering map');
                return;
            }

            utils.centerMap(
                thisJob.pickup.lat,
                thisJob.pickup.lng,
                thisJob.delivery.lat,
                thisJob.delivery.lng,
                thisJob,
                routeLineRef.current,
                extraRouteLinesRef.current,
                mapInstance?.map
            );
        },
        [getScopedJob, mapInstance]
    );

    /**
     * Auto-zoom the map to show all visible points
     */
    const autoZoomMapToShowAllPoints = useCallback(() => {
        if (!mapInstance?.map || !config?.job) {
            return;
        }

        // Respect preserveView setting
        if (config.preserveView) {
            return;
        }

        const allPoints = utils.getAllVisiblePoints(
            config.job,
            config.courierLocation,
            extraMarkersRef.current
        );

        if (allPoints.length > 0) {
            setTimeout(() => {
                utils.autoZoomToShowAllPoints(
                    mapInstance.map,
                    allPoints,
                    MAP_CONSTANTS.DEFAULT_PADDING
                );
            }, MAP_CONSTANTS.ZOOM_ADJUSTMENT_DELAY);
        }
    }, [mapInstance, config]);

    /**
     * Check if the job is a single address job
     */
    const isSingleAddressJob = useCallback((job: IHereMapJob): boolean => {
        return !job.delivery;
    }, []);

    /**
     * Add job markers to the map
     */
    const addJobMarkers = useCallback(
        (
            job: IHereMapJob,
            courierLocation?: CourierLocation,
            isSingleAddress: boolean = false
        ) => {
            if (!mapInstance?.map) return;

            // Add pickup marker
            if (job.pickup?.lat && job.pickup?.lng) {
                fromMarkerRef.current = utils.createFromMarker(
                    job.pickup.lat,
                    job.pickup.lng,
                    fromMarkerRef.current,
                    mapInstance.map
                );
            }

            // Add delivery marker (if not a single address)
            if (!isSingleAddress && job.delivery?.lat && job.delivery?.lng) {
                toMarkerRef.current = utils.createToMarker(
                    job.delivery.lat,
                    job.delivery.lng,
                    toMarkerRef.current,
                    mapInstance.map
                );
            }

            // Add courier marker
            if (courierLocation?.lat && courierLocation?.lng) {
                courierMarkerRef.current = utils.createCourierMarker(
                    courierLocation.lat,
                    courierLocation.lng,
                    courierMarkerRef.current,
                    mapInstance.map,
                    job.childJobs?.some((x) => x?.flight === true) || false,
                    isSingleAddress
                        ? 0
                        : job.pickup.lng - (job.delivery?.lng ?? 0)
                );
            }
        },
        [mapInstance]
    );

    /**
     * Handle a single address job
     */
    const handleSingleAddressJob = useCallback(
        (job: IHereMapJob, preserveView: boolean) => {
            if (
                !preserveView &&
                job.pickup?.lat &&
                job.pickup?.lng &&
                mapInstance?.map
            ) {
                mapInstance.map.setCenter({
                    lat: job.pickup.lat,
                    lng: job.pickup.lng,
                });
                mapInstance.map.setZoom(MAP_CONSTANTS.MAP_ZOOM_LEVEL);
            }
        },
        [mapInstance]
    );

    /**
     * Handle child jobs with multiple addresses
     */
    const handleChildJobs = useCallback(
        (
            job: IHereMapJob,
            scopedJob: IHereMapChildJob | null | undefined,
            preserveView: boolean,
            signal?: AbortSignal
        ) => {
            if (!mapInstance?.map || !platform) return;

            job.childJobs?.forEach(
                (childJob: IHereMapChildJob, index: number) => {
                    // Add extra marker for non-first child jobs
                    if (index !== 0 && childJob.pickup) {
                        extraMarkersRef.current = utils.addExtraMarker(
                            childJob.pickup.lat,
                            childJob.pickup.lng,
                            extraMarkersRef.current,
                            mapInstance.map
                        );
                    }

                    // Add extra route line
                    if (childJob.pickup && childJob.delivery) {
                        utils.addExtraRouteLine(
                            childJob.pickup.lat,
                            childJob.pickup.lng,
                            childJob.delivery.lat,
                            childJob.delivery.lng,
                            index,
                            childJob.flight,
                            extraRouteLinesRef.current,
                            job,
                            mapInstance.map,
                            platform,
                            (scopedJob
                                ? childJob.id === scopedJob.id
                                : null) ?? false,
                            preserveView,
                            undefined,
                            signal
                        );
                    }
                }
            );
        },
        [mapInstance, platform]
    );

    /**
     * Handle a simple job without child jobs
     */
    const handleSimpleJob = useCallback(
        (job: IHereMapJob, preserveView: boolean, signal?: AbortSignal) => {
            if (!mapInstance?.map || !platform) return;

            utils.drawRouteLine(
                job.pickup.lat,
                job.pickup.lng,
                job.delivery?.lat ?? 0,
                job.delivery?.lng ?? 0,
                routeLineRef.current,
                job,
                mapInstance.map,
                platform,
                job.flight ?? false,
                preserveView,
                (routeLine) => {
                    routeLineRef.current = routeLine;
                },
                signal
            );
        },
        [mapInstance, platform]
    );

    /**
     * Handle multi-address job
     */
    const handleMultiAddressJob = useCallback(
        (job: IHereMapJob, preserveView: boolean, signal?: AbortSignal) => {
            if (!job.childJobs) return;

            const scopedJob =
                config?.selectedJobIndex && config.selectedJobIndex !== 0
                    ? getScopedJob(config.selectedJobIndex)
                    : null;

            if (job.childJobs.length > 0) {
                handleChildJobs(job, scopedJob, preserveView, signal);
            } else {
                handleSimpleJob(job, preserveView, signal);
            }
        },
        [config?.selectedJobIndex, getScopedJob, handleChildJobs, handleSimpleJob]
    );

    /**
     * Show a job on the map
     */
    const showJobOnMap = useCallback(
        (job: IHereMapJob, courierLocation?: CourierLocation) => {
            if (!job || !mapInstance?.map) {
                console.warn('Missing required objects in showJobOnMap', {
                    hasJob: !!job,
                    hasMapInstance: !!mapInstance,
                    hasMap: mapInstance ? !!mapInstance.map : false,
                });
                return;
            }

            if (!job.pickup) {
                console.warn('Job missing valid pickup coordinates', job);
                return;
            }

            // Cancel any routing requests still in flight from the previous
            // job — without this, their async callbacks would add polylines
            // to a map we're about to repopulate, leaving orphan objects
            // that later removeObject calls can't find
            routingControllerRef.current?.abort();
            routingControllerRef.current = new AbortController();
            const signal = routingControllerRef.current.signal;

            try {
                // Clear existing map elements
                clearMap();

                const preserveView = config?.preserveView ?? false;
                const isSingleAddr = isSingleAddressJob(job);

                // Add markers
                addJobMarkers(job, courierLocation, isSingleAddr);

                // Handle routing
                if (isSingleAddr) {
                    handleSingleAddressJob(job, preserveView);
                } else {
                    handleMultiAddressJob(job, preserveView, signal);
                }

                // Auto-zoom if not preserving view
                if (!preserveView) {
                    setTimeout(() => {
                        autoZoomMapToShowAllPoints();
                    }, MAP_CONSTANTS.AUTO_ZOOM_DELAY);
                }
            } catch (error) {
                console.error('Error in showJobOnMap:', error);
            }
        },
        [
            mapInstance,
            config?.preserveView,
            clearMap,
            isSingleAddressJob,
            addJobMarkers,
            handleSingleAddressJob,
            handleMultiAddressJob,
            autoZoomMapToShowAllPoints,
        ]
    );

    /**
     * Refresh the map with current config
     */
    const refreshMap = useCallback(() => {
        if (config?.job && config?.courierLocation) {
            showJobOnMap(config.job, config.courierLocation);
        }
    }, [config, showJobOnMap]);

    /**
     * Check if coordinates have changed
     */
    const hasCoordinateChanges = useCallback(
        (newJob: IHereMapJob, oldJob: IHereMapJob): boolean => {
            if (!newJob || !oldJob) return false;

            const pickupChanged =
                newJob.pickup &&
                oldJob.pickup &&
                (newJob.pickup.lat !== oldJob.pickup.lat ||
                    newJob.pickup.lng !== oldJob.pickup.lng);

            const deliveryChanged =
                newJob.delivery &&
                oldJob.delivery &&
                (newJob.delivery.lat !== oldJob.delivery.lat ||
                    newJob.delivery.lng !== oldJob.delivery.lng);

            return !!(pickupChanged || deliveryChanged);
        },
        []
    );

    /**
     * Check if courier location has changed
     */
    const hasCourierLocationChanges = useCallback(
        (
            newLocation: CourierLocation | undefined,
            oldLocation: CourierLocation | undefined
        ): boolean => {
            if (!newLocation || !oldLocation) {
                return newLocation !== oldLocation;
            }

            return (
                newLocation.lat !== oldLocation.lat ||
                newLocation.lng !== oldLocation.lng
            );
        },
        []
    );

    /**
     * Determine if map should update
     */
    const shouldUpdateMap = useCallback(
        (
            newConfig: HereMapConfig,
            oldConfig: HereMapConfig
        ): { shouldUpdate: boolean; reason: string } => {
            // If there's a job in the new config and no old config, always update
            if (newConfig.job && !oldConfig.job) {
                return {shouldUpdate: true, reason: 'Initial job setup'};
            }

            // Check for a new job
            const isNewJob =
                newConfig.job &&
                oldConfig.job &&
                newConfig.job.id !== oldConfig.job.id;
            if (isNewJob) {
                return {shouldUpdate: true, reason: 'New job'};
            }

            // Check for timestamp changes
            const hasNewTimestamp = newConfig.timestamp !== oldConfig.timestamp;
            if (hasNewTimestamp && newConfig.job) {
                return {shouldUpdate: true, reason: 'Timestamp update'};
            }

            // Check for coordinate changes
            if (!newConfig.job || !oldConfig.job) {
                return {shouldUpdate: false, reason: 'No job to compare'};
            }

            const coordChanges = hasCoordinateChanges(
                newConfig.job,
                oldConfig.job
            );
            if (coordChanges) {
                return {shouldUpdate: true, reason: 'Coordinate changes'};
            }

            // Check for courier location changes
            if (newConfig.courierLocation && oldConfig.courierLocation) {
                const courierChanges = hasCourierLocationChanges(
                    newConfig.courierLocation,
                    oldConfig.courierLocation
                );
                if (courierChanges) {
                    return {
                        shouldUpdate: true,
                        reason: 'Courier location changes',
                    };
                }
            }

            return {shouldUpdate: false, reason: ''};
        },
        [hasCoordinateChanges, hasCourierLocationChanges]
    );

    // Effect: Initialize map when credentials/mapId change
    useEffect(() => {
        if (
            credentials &&
            mapId &&
            (!isInitialized ||
                credentials !== prevCredentialsRef.current ||
                mapId !== prevMapIdRef.current)
        ) {
            prevCredentialsRef.current = credentials;
            prevMapIdRef.current = mapId;

            // Clean up existing map if reinitializing
            if (mapInstance?.map) {
                try {
                    mapInstance.map.dispose();
                } catch {
                    // Ignore disposal errors
                }
            }

            initializeMap();
        }
    }, [credentials, mapId, isInitialized, mapInstance, initializeMap]);

    // Effect: Handle config changes
    useEffect(() => {
        if (!config || !credentials || !isInitialized) {
            return;
        }

        const oldConfig = prevConfigRef.current || {};
        prevConfigRef.current = config;

        // Check for updates that require map refresh
        const updateRequired = shouldUpdateMap(config, oldConfig as HereMapConfig);

        if (updateRequired.shouldUpdate) {
            showJobOnMap(config.job!, config.courierLocation);
        } else if (!config.job && mapInstance) {
            clearMap();
        }
    }, [
        config,
        credentials,
        isInitialized,
        mapInstance,
        shouldUpdateMap,
        showJobOnMap,
        clearMap,
    ]);

    // Effect: Handle selected job index changes
    useEffect(() => {
        const newValue = config?.selectedJobIndex;
        const oldValue = prevSelectedJobIndexRef.current;

        if (
            (newValue || newValue === 0) &&
            oldValue !== undefined &&
            newValue !== oldValue &&
            credentials &&
            mapInstance?.map
        ) {
            centerMapOnIndex(newValue);
        }

        prevSelectedJobIndexRef.current = newValue;
    }, [config?.selectedJobIndex, credentials, mapInstance, centerMapOnIndex]);

    // Effect: Handle courier location changes
    useEffect(() => {
        const newValue = config?.courierLocation;
        const oldValue = prevCourierLocationRef.current;

        // Skip if no valid new value
        if (
            !newValue ||
            newValue.lat === null ||
            newValue.lat === undefined ||
            newValue.lng === null ||
            newValue.lng === undefined
        ) {
            return;
        }

        // Check if courier location actually changed
        if (
            !oldValue ||
            newValue.lat !== oldValue.lat ||
            newValue.lng !== oldValue.lng
        ) {
            if (mapInstance?.map && config?.job) {
                courierMarkerRef.current = utils.createCourierMarker(
                    newValue.lat,
                    newValue.lng,
                    courierMarkerRef.current,
                    mapInstance.map,
                    config.job.childJobs?.some((x) => x?.flight === true) ||
                    false,
                    undefined
                );

                // Only auto-zoom if preserveView is not enabled
                if (!config?.preserveView) {
                    autoZoomMapToShowAllPoints();
                }
            }
        }

        prevCourierLocationRef.current = newValue;
    }, [config?.courierLocation, config?.preserveView, config?.job, mapInstance, autoZoomMapToShowAllPoints]);

    // Effect: Window resize handler
    useEffect(() => {
        const handleResize = () => {
            if (mapInstance?.map) {
                mapInstance.map.getViewPort().resize();
            }
        };

        window.addEventListener('resize', handleResize, { passive: true });

        return () => {
            window.removeEventListener('resize', handleResize);
        };
    }, [mapInstance]);

    // Effect: Keep mapInstanceRef in sync so the unmount-cleanup effect can
    // see the latest map (its `[]`-deps closure would otherwise capture null)
    useEffect(() => {
        mapInstanceRef.current = mapInstance;
    }, [mapInstance]);

    // Effect: Cleanup on unmount
    useEffect(() => {
        return () => {
            // Abort any pending routing so its async callbacks don't run
            // against a disposed map
            routingControllerRef.current?.abort();

            const inst = mapInstanceRef.current;
            if (inst?.map) {
                try {
                    // Inline minimal cleanup using the ref — calling the
                    // stateful clearMap callback here would close over the
                    // initial-mount value of mapInstance (which is null)
                    if (fromMarkerRef.current) {
                        utils.safeRemoveObject(inst.map, fromMarkerRef.current);
                        fromMarkerRef.current = null;
                    }
                    if (toMarkerRef.current) {
                        utils.safeRemoveObject(inst.map, toMarkerRef.current);
                        toMarkerRef.current = null;
                    }
                    if (courierMarkerRef.current) {
                        utils.safeRemoveObject(inst.map, courierMarkerRef.current);
                        courierMarkerRef.current = null;
                    }
                    if (extraMarkersRef.current.length > 0) {
                        extraMarkersRef.current = utils.removeExtraMarkers(
                            extraMarkersRef.current,
                            inst.map
                        );
                    }
                    inst.map.dispose();
                } catch {
                    // Ignore disposal errors during cleanup
                }
            }
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cleanup-only effect; runs on unmount
    }, []);

    return {
        mapInstance,
        platform,
        isInitialized,
        refreshMap,
        clearMap,
        showJobOnMap,
        centerMapOnIndex,
        autoZoomMapToShowAllPoints,
    };
}
