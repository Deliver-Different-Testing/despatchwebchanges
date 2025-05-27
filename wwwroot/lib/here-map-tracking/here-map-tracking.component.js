// here-map.component.js
angular.module('hereMapTracking.components', [])
    .directive('hereMapTracking', [() => ({
        restrict: 'E',
        scope: {
            mapId: '@',
            credentials: '=',
            config: '=',
            onMapReady: '&'
        },
        template: '<div class="here-map" id="{{mapId}}"></div>',
        controller: ['$scope', 'HereMapService', '$rootScope', '$timeout', ($scope, HereMapService, $rootScope, $timeout) => {
            let platform;
            let mapInstance;
            let fromMarker;
            let toMarker;
            let courierMarker;
            let extraMarkers = [];
            let routeLine;
            let extraRouteLines = [];

            function initialiseMap() {
                try {
                    if ($scope.credentials && $scope.mapId) {
                        // Initialize HERE platform
                        platform = HereMapService.initPlatform($scope.credentials);
                        if (!platform) {
                            console.error('Failed to initialize HERE platform');
                            return;
                        }

                        // Initialize map
                        mapInstance = HereMapService.createMap($scope.mapId, platform, $scope.config);
                        if (!mapInstance || !mapInstance.map) {
                            console.error('Failed to create map instance');
                            return;
                        }

                        console.log('Map initialized successfully');

                        // Notify parent component that map is ready
                        if ($scope.onMapReady) {
                            $scope.onMapReady({
                                map: mapInstance.map,
                                platform: platform
                            });
                        }

                        window.setTimeout(() => {
                            if (mapInstance && mapInstance.map) {
                                HereMapService.resizeMapPreserveView(mapInstance.map);
                            }
                        }, 100); // Small delay to ensure DOM has settled
                    } else {
                        console.warn('Missing credentials or mapId', {
                            hasCredentials: !!$scope.credentials,
                            hasMapId: !!$scope.mapId
                        });
                    }
                } catch (error) {
                    console.error('Error in initialiseMap:', error);
                }
            }

            $scope.refreshMap = () => {
                if ($scope.config && $scope.config.job) {
                    $scope.showJobOnMap($scope.config.job, $scope.config.courierLocation);
                }
            };

            $rootScope.$on('map-refresh-requested', () => {
                $scope.refreshMap();
            });

            //Watch for changes in config
            $scope.$watchGroup(['config', 'credentials'], (newValues, oldValues) => {
                if (newValues[0] && newValues[1]) {
                    // Setup map if no map
                    if (!mapInstance) {
                        initialiseMap();

                        // Exit early if initialization failed
                        if (!mapInstance || !mapInstance.map) {
                            console.warn('Map initialization failed');
                            return;
                        }
                    }

                    const newConfig = newValues[0];
                    const oldConfig = oldValues[0] || {}; // Ensure oldConfig exists
                    const oldJob = oldConfig.job || {};   // Ensure oldJob exists

                    // Check if this is a completely new job (different ID)
                    const isNewJob = newConfig.job && (!oldConfig.job || newConfig.job.id !== oldJob.id);

                    const hasCourierLocationChanges = (newConfig.courierLocation !== oldConfig.courierLocation) ||
                        (newConfig.courierLocation && oldConfig.courierLocation &&
                            (newConfig.courierLocation.lat !== oldConfig.courierLocation.lat ||
                                newConfig.courierLocation.lng !== oldConfig.courierLocation.lng));

                    // Check if the job has a timestamp that has changed (for force updates of the same job)
                    const hasNewTimestamp = newConfig.job && oldConfig.job &&
                        newConfig.job.timestamp !== oldJob.timestamp;

                    // Also check for changes in coordinates (might have been updated)
                    const hasCoordinateChanges = newConfig.job && oldConfig.job &&
                        (newConfig.job.pickup.lat !== oldJob.pickup.lat ||
                            newConfig.job.pickup.lng !== oldJob.pickup.lng ||
                            newConfig.job.delivery.lat !== oldJob.delivery.lat ||
                            newConfig.job.delivery.lng !== oldJob.delivery.lng);

                    if (isNewJob || hasNewTimestamp || hasCoordinateChanges || hasCourierLocationChanges) {
                        console.log('Map update triggered:',
                            isNewJob ? 'New job' :
                                hasNewTimestamp ? 'New timestamp' :
                                    hasCoordinateChanges ? 'Coordinate changes' :
                                        'Courier location changes');

                        // Update map for the job
                        $scope.showJobOnMap(newConfig.job, newConfig.courierLocation);
                    } else if (!newConfig.job) {
                        // Clear map if no job passed
                        $scope.clearMap();
                    }
                }
            });

            $scope.$watch('config.selectedJobIndex', (newValue, oldValue) => {
                if ((newValue || newValue === 0) && oldValue !== null && $scope.credentials && mapInstance.map) {
                    //one more jawn to fix - this is called when changing from one job to a new one while it's already called in showJobOnMap
                    $scope.centerMapOnIndex(newValue);
                }
            });

            $scope.$watch('config.courierLocation', (newValue, oldValue) => {
                if (newValue && newValue.lat !== null && newValue.lng !== null && (!oldValue ||
                    (newValue.lat !== oldValue.lat && newValue.lng !== oldValue.lng))) {
                    courierMarker = HereMapService.getHereCourierMarker(newValue.lat, newValue.lng, courierMarker, mapInstance.map, null, null);

                    $scope.autoZoomMapToShowAllPoints();
                }
            });

            $scope.centerMapOnIndex = selectedJobIndex => {
                const thisJob = $scope.getScopedJob(selectedJobIndex);
                HereMapService.centerHereMap(thisJob.pickup.lat,
                    thisJob.pickup.lng,
                    thisJob.delivery.lat,
                    thisJob.delivery.lng,
                    thisJob,
                    routeLine,
                    extraRouteLines,
                    mapInstance.map);
            };

            $scope.getScopedJob = selectedJobIndex => {
                let index = selectedJobIndex - 1;
                let thisJob;
                if (index !== -1) {
                    //Scope map to selected leg of job
                    thisJob = $scope.config.job.childJobs[index];
                    thisJob.index = extraRouteLines.findIndex(x => x.id.slice(-1) === index.toString());
                } else {
                    //Scope map to flight leg of job
                    index = $scope.config.job.childJobs.findIndex(x => x.flight === true);
                    thisJob = $scope.config.job.childJobs[index];
                    thisJob.index = extraRouteLines.findIndex(x => x.id.slice(-1) === index.toString());
                }
                return thisJob;
            };

            // Clear map
            $scope.clearMap = () => {
                // Check if map exists before attempting to use it
                if (!mapInstance || !mapInstance.map) {
                    console.warn('Map instance is not initialized in clearMap');
                    return;
                }

                //Remove all markers
                if (extraMarkers.length > 0) {
                    extraMarkers = HereMapService.removeExtraMarkers(extraMarkers, mapInstance.map);
                }
                if (fromMarker && toMarker) {
                    mapInstance.map.removeObjects([fromMarker, toMarker]);
                    fromMarker = null;
                    toMarker = null;
                }
                if (courierMarker) {
                    mapInstance.map.removeObject(courierMarker);
                    courierMarker = null;
                }

                //Remove all route lines
                if (extraRouteLines.length > 0) {
                    extraRouteLines = HereMapService.removeExtraRouteLines(extraRouteLines, mapInstance.map);
                }
                if (routeLine) {
                    HereMapService.removeObjectById('route', mapInstance.map);
                    routeLine = null;
                }
            };

            // Set up all job data on a map
            $scope.showJobOnMap = (job, courierLocation) => {
                // Check if required objects exist
                if (!job || !mapInstance || !mapInstance.map) {
                    console.warn('Missing required objects in showJobOnMap', {
                        hasJob: !!job,
                        hasMapInstance: !!mapInstance,
                        hasMap: mapInstance ? !!mapInstance.map : false
                    });
                    return;
                }

                try {
                    // Remove all markers and route lines
                    $scope.clearMap();

                    // Add all markers
                    fromMarker = HereMapService.getHereFromMarker(job.pickup.lat, job.pickup.lng, fromMarker, mapInstance.map);
                    toMarker = HereMapService.getHereToMarker(job.delivery.lat, job.delivery.lng, toMarker, mapInstance.map);

                    if (courierLocation && courierLocation.lat && courierLocation.lng) {
                        courierMarker = HereMapService.getHereCourierMarker(
                            courierLocation.lat,
                            courierLocation.lng,
                            courierMarker,
                            mapInstance.map,
                            job.childJobs && job.childJobs.some(x => x && x.flight === true),
                            job.pickup.lng - job.delivery.lng
                        );
                    }

                    // Get scoped job in case initialised with it
                    let scopedJob = null;
                    if ($scope.config.selectedJobIndex && $scope.config.selectedJobIndex !== 0) {
                        scopedJob = $scope.getScopedJob($scope.config.selectedJobIndex);
                    }

                    // Add all route lines (and extra markers if needed), also centers map
                    if (job.childJobs && job.childJobs.length > 0) {
                        for (let i in job.childJobs) {
                            if (i !== '0') {
                                extraMarkers = HereMapService.addExtraMarker(job.childJobs[i].pickup.lat,
                                    job.childJobs[i].pickup.lng, extraMarkers, mapInstance.map);
                            }
                            extraRouteLines = HereMapService.addExtraRouteLine(job.childJobs[i].pickup.lat,
                                job.childJobs[i].pickup.lng,
                                job.childJobs[i].delivery.lat,
                                job.childJobs[i].delivery.lng,
                                i,
                                job.childJobs[i].flight, extraRouteLines, job, mapInstance.map, platform,
                                scopedJob ? job.childJobs[i].id === scopedJob.id : null);
                        }
                    } else {
                        routeLine = HereMapService.drawRouteLine(job.pickup.lat,
                            job.pickup.lng,
                            job.delivery.lat,
                            job.delivery.lng, routeLine, job, mapInstance.map, platform, job.flight);
                    }

                    $timeout(() => {
                        $scope.autoZoomMapToShowAllPoints();
                    }, 2000);
                } catch (error) {
                    console.error('Error in showJobOnMap:', error);
                }
            };

            $scope.autoZoomMapToShowAllPoints = () => {
                if (!mapInstance || !mapInstance.map || !$scope.config || !$scope.config.job) {
                    return;
                }

                const allPoints = HereMapService.getAllVisiblePoints(
                    $scope.config.job,
                    $scope.config.courierLocation,
                    extraMarkers
                );

                if (allPoints.length > 0) {
                    $timeout(() => {
                        HereMapService.autoZoomToShowAllPoints(mapInstance.map, allPoints, 0.1);
                    }, 300);
                }
            };
        }]
    })]);
